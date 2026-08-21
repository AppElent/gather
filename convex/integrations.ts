import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import type { ActionCtx } from './_generated/server'
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server'
import { requireGroupBySlug } from './lib/groupAccess'
import { getAdapter } from './lib/taskProviders'
import {
  type ExternalProviderId,
  ProviderAuthError,
  type ProviderSource,
  type SourceProperty,
} from './lib/taskProviders/types'

const externalProvider = v.union(v.literal('notion'), v.literal('todoist'))

// ---------- public queries/mutations (no tokens ever leave here) ----------

/**
 * The connections belonging to the Group in the URL, and to no other.
 *
 * A connection is Group-scoped content: the token belongs to the household that
 * authorised it. Reading them for the Group in the URL is what stops the Tasks
 * page inside one Group from offering another Group's connection — and what
 * comes back is the label and who connected it, never the token.
 */
export const listConnections = query({
  args: { groupSlug: v.string() },
  handler: async (ctx, args) => {
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    const rows = await ctx.db
      .query('integrationConnections')
      .withIndex('by_group_provider', (q) => q.eq('groupId', group._id))
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

/**
 * Take a connection out of the Group it belongs to.
 *
 * It has to be in *that* Group, not in any Group the caller happens to be in:
 * standing in one household is not standing to disconnect another one's Notion.
 * A connection that is not in this Group and one that has already gone are the
 * same no-op, so neither can be used to find out that the other exists.
 */
export const disconnect = mutation({
  args: {
    connectionId: v.id('integrationConnections'),
    groupSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    const conn = await ctx.db.get(args.connectionId)
    if (!conn || conn.groupId !== group._id) return
    // Linked lists keep their (now dangling) connectionId — they surface a
    // reconnect prompt until the provider is connected again (spec §5.1/§7).
    await ctx.db.delete(args.connectionId)
  },
})

// ---------- internal (may touch tokens) ----------

/**
 * The caller and the Group they named, for an action, which has no `ctx.db`.
 *
 * `requireGroupBySlug` refuses anyone who is not a Member, so an action holding
 * this result is holding an authorised Group — which is the one `completeOAuth`
 * may store a token against.
 */
export const getAuthorisedGroup = internalQuery({
  args: { groupSlug: v.string() },
  handler: async (ctx, args) => {
    const { user, group } = await requireGroupBySlug(ctx, args.groupSlug)
    return { userId: user._id, groupId: group._id }
  },
})

export const getConnection = internalQuery({
  args: { connectionId: v.id('integrationConnections') },
  handler: async (ctx, args) => await ctx.db.get(args.connectionId),
})

/**
 * A Group's connection for one provider, token and all.
 *
 * Named for the Group rather than for the caller on purpose: "my connection"
 * was the caller-wide framing this replaces, which read `defaultGroupId` and so
 * answered the same whichever Group's page had asked. The Group is authorised
 * here, and only a Member of it gets the row.
 */
export const getGroupConnection = internalQuery({
  args: { groupSlug: v.string(), provider: externalProvider },
  handler: async (ctx, args) => {
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    return await ctx.db
      .query('integrationConnections')
      .withIndex('by_group_provider', (q) =>
        q.eq('groupId', group._id).eq('provider', args.provider),
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
    const connectionId = existing
      ? existing._id
      : await ctx.db.insert('integrationConnections', args)
    if (existing) {
      await ctx.db.patch(existing._id, {
        accessToken: args.accessToken,
        accountLabel: args.accountLabel,
        connectedBy: args.connectedBy,
      })
    }

    // Reconnecting after a disconnect creates a *new* connection document
    // (the old one was deleted), so any lists still pointing at the old,
    // now-dangling connectionId need repointing to the new one — otherwise
    // they'd stay stuck showing "reconnect" forever even though the
    // provider is connected again.
    const lists = await ctx.db
      .query('taskLists')
      .withIndex('by_group', (q) => q.eq('groupId', args.groupId))
      .collect()
    for (const list of lists) {
      if (
        list.provider === args.provider &&
        list.providerConfig &&
        list.providerConfig.connectionId !== connectionId
      ) {
        await ctx.db.patch(list._id, {
          providerConfig: { ...list.providerConfig, connectionId },
        })
      }
    }

    return connectionId
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

/**
 * Finish a provider's OAuth round trip and store the token for one Group.
 *
 * The Group is the one the connect flow set out from, carried through the
 * provider in `sessionStorage` and authorised here. This is the write, and so
 * the one point in the round trip where a Group has to be established.
 */
export const completeOAuth = action({
  args: {
    provider: externalProvider,
    groupSlug: v.string(),
    code: v.string(),
    redirectUri: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    const { userId, groupId } = await ctx.runQuery(
      internal.integrations.getAuthorisedGroup,
      { groupSlug: args.groupSlug },
    )

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
      groupId,
      provider: args.provider,
      accessToken,
      accountLabel,
      connectedBy: userId,
    })
  },
})

async function requireGroupConnection(
  ctx: ActionCtx,
  groupSlug: string,
  provider: ExternalProviderId,
) {
  const conn = await ctx.runQuery(internal.integrations.getGroupConnection, {
    groupSlug,
    provider,
  })
  if (!conn) {
    throw new ConvexError(
      `No ${provider} connection for this group — connect one in its settings`,
    )
  }
  return conn
}

function toUserError(error: unknown, provider: ExternalProviderId): never {
  if (error instanceof ProviderAuthError) {
    throw new ConvexError(
      `This group's ${provider} connection expired — reconnect it in its settings`,
    )
  }
  if (error instanceof ConvexError) throw error
  throw new ConvexError(`Could not reach ${provider} — try again`)
}

export const listSources = action({
  args: { provider: externalProvider, groupSlug: v.string() },
  handler: async (ctx, args): Promise<ProviderSource[]> => {
    const conn = await requireGroupConnection(
      ctx,
      args.groupSlug,
      args.provider,
    )
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
  args: {
    provider: externalProvider,
    groupSlug: v.string(),
    sourceId: v.string(),
  },
  handler: async (ctx, args): Promise<SourceProperty[]> => {
    const conn = await requireGroupConnection(
      ctx,
      args.groupSlug,
      args.provider,
    )
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
