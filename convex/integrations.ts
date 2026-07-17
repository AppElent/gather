import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server'
import type { ActionCtx } from './_generated/server'
import { getAdapter } from './lib/taskProviders'
import {
  type ExternalProviderId,
  ProviderAuthError,
  type ProviderSource,
  type SourceProperty,
} from './lib/taskProviders/types'
import { getCurrentUser, getMyGroupIds } from './lib/sharing'

const externalProvider = v.union(v.literal('notion'), v.literal('todoist'))

// ---------- public queries/mutations (no tokens ever leave here) ----------

export const listConnections = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    if (!user?.defaultGroupId) return []
    const groupId = user.defaultGroupId
    const rows = await ctx.db
      .query('integrationConnections')
      .withIndex('by_group_provider', (q) => q.eq('groupId', groupId))
      .collect()
    return await Promise.all(
      rows.map(async (r) => ({
        _id: r._id,
        provider: r.provider,
        accountLabel: r.accountLabel,
        connectedByName: (await ctx.db.get(r.connectedBy))?.name ?? 'Unknown',
      })),
    )
  },
})

export const disconnect = mutation({
  args: { connectionId: v.id('integrationConnections') },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new ConvexError('Not authenticated')
    const conn = await ctx.db.get(args.connectionId)
    if (!conn) return
    const groupIds = await getMyGroupIds(ctx, user._id)
    if (!groupIds.includes(conn.groupId)) {
      throw new ConvexError('Not a member of that group')
    }
    // Linked lists keep their (now dangling) connectionId — they surface a
    // reconnect prompt until the provider is connected again (spec §5.1/§7).
    await ctx.db.delete(args.connectionId)
  },
})

// ---------- internal (may touch tokens) ----------

export const getViewer = internalQuery({
  args: {},
  handler: async (ctx) => await getCurrentUser(ctx),
})

export const getConnection = internalQuery({
  args: { connectionId: v.id('integrationConnections') },
  handler: async (ctx, args) => await ctx.db.get(args.connectionId),
})

export const getMyConnection = internalQuery({
  args: { provider: externalProvider },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.defaultGroupId) return null
    const groupId = user.defaultGroupId
    return await ctx.db
      .query('integrationConnections')
      .withIndex('by_group_provider', (q) =>
        q.eq('groupId', groupId).eq('provider', args.provider),
      )
      .unique()
  },
})

export const storeConnection = internalMutation({
  args: {
    groupId: v.id('groups'),
    provider: externalProvider,
    accessToken: v.string(),
    accountLabel: v.string(),
    connectedBy: v.id('users'),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('integrationConnections')
      .withIndex('by_group_provider', (q) =>
        q.eq('groupId', args.groupId).eq('provider', args.provider),
      )
      .unique()
    if (existing) {
      await ctx.db.patch(existing._id, {
        accessToken: args.accessToken,
        accountLabel: args.accountLabel,
        connectedBy: args.connectedBy,
      })
      return existing._id
    }
    return await ctx.db.insert('integrationConnections', args)
  },
})

// ---------- actions ----------

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new ConvexError(
      `Integration not configured — the ${name} Convex env var is missing`,
    )
  }
  return value
}

export const getAuthorizeUrl = action({
  args: {
    provider: externalProvider,
    redirectUri: v.string(),
    state: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new ConvexError('Not authenticated')
    if (args.provider === 'notion') {
      const url = new URL('https://api.notion.com/v1/oauth/authorize')
      url.searchParams.set('client_id', requireEnv('NOTION_CLIENT_ID'))
      url.searchParams.set('response_type', 'code')
      url.searchParams.set('owner', 'user')
      url.searchParams.set('redirect_uri', args.redirectUri)
      url.searchParams.set('state', args.state)
      return url.toString()
    }
    const url = new URL('https://todoist.com/oauth/authorize')
    url.searchParams.set('client_id', requireEnv('TODOIST_CLIENT_ID'))
    url.searchParams.set('scope', 'data:read')
    url.searchParams.set('state', args.state)
    return url.toString()
  },
})

export const completeOAuth = action({
  args: {
    provider: externalProvider,
    code: v.string(),
    redirectUri: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    const user = await ctx.runQuery(internal.integrations.getViewer, {})
    if (!user) throw new ConvexError('Not authenticated')
    if (!user.defaultGroupId) {
      throw new ConvexError('Set a default group on the Groups page first')
    }

    let accessToken: string
    let accountLabel: string
    if (args.provider === 'notion') {
      const clientId = requireEnv('NOTION_CLIENT_ID')
      const clientSecret = requireEnv('NOTION_CLIENT_SECRET')
      const res = await fetch('https://api.notion.com/v1/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code: args.code,
          redirect_uri: args.redirectUri,
        }),
      })
      if (!res.ok) {
        throw new ConvexError('Notion rejected the connection — try again')
      }
      const data = (await res.json()) as {
        access_token: string
        workspace_name?: string
      }
      accessToken = data.access_token
      accountLabel = data.workspace_name ?? 'Notion workspace'
    } else {
      const body = new URLSearchParams({
        client_id: requireEnv('TODOIST_CLIENT_ID'),
        client_secret: requireEnv('TODOIST_CLIENT_SECRET'),
        code: args.code,
      })
      const res = await fetch('https://todoist.com/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      })
      if (!res.ok) {
        throw new ConvexError('Todoist rejected the connection — try again')
      }
      const data = (await res.json()) as { access_token: string }
      accessToken = data.access_token
      accountLabel = 'Todoist'
    }

    await ctx.runMutation(internal.integrations.storeConnection, {
      groupId: user.defaultGroupId,
      provider: args.provider,
      accessToken,
      accountLabel,
      connectedBy: user._id,
    })
  },
})

async function requireMyConnection(ctx: ActionCtx, provider: ExternalProviderId) {
  const conn = await ctx.runQuery(internal.integrations.getMyConnection, {
    provider,
  })
  if (!conn) {
    throw new ConvexError(
      `No ${provider} connection for your group — connect it in Settings`,
    )
  }
  return conn
}

function toUserError(error: unknown, provider: ExternalProviderId): never {
  if (error instanceof ProviderAuthError) {
    throw new ConvexError(
      `Your ${provider} connection expired — reconnect it in Settings`,
    )
  }
  if (error instanceof ConvexError) throw error
  throw new ConvexError(`Could not reach ${provider} — try again`)
}

export const listSources = action({
  args: { provider: externalProvider },
  handler: async (ctx, args): Promise<ProviderSource[]> => {
    const conn = await requireMyConnection(ctx, args.provider)
    try {
      return await getAdapter(args.provider).listAvailableSources(
        conn.accessToken,
      )
    } catch (error) {
      toUserError(error, args.provider)
    }
  },
})

export const getSourceSchema = action({
  args: { provider: externalProvider, sourceId: v.string() },
  handler: async (ctx, args): Promise<SourceProperty[]> => {
    const conn = await requireMyConnection(ctx, args.provider)
    try {
      return await getAdapter(args.provider).getSourceSchema(
        conn.accessToken,
        args.sourceId,
      )
    } catch (error) {
      toUserError(error, args.provider)
    }
  },
})
