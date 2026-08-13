import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
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
import { requireGroupBySlug } from './lib/groupAccess'

const externalProvider = v.union(v.literal('notion'), v.literal('todoist'))

// ---------- public queries/mutations (no tokens ever leave here) ----------

/**
 * The connections belonging to the Group in the URL, and to no other.
 *
 * A connection is Group-scoped content: the token belongs to the household that
 * authorised it. Reading them for the Group in the URL is what stops the Tasks
 * page inside one Group from offering another Group's connection — and what
 * comes back is the label and who connected it, never the token.
 *
 * Several per provider is ordinary, so this is a list to choose from rather
 * than a set of slots to fill: a disconnected connection is returned too, with
 * `status` saying so, because it is still the account a linked list is waiting
 * on and the thing the reader has to reconnect.
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
        status: connectionStatus(r),
        connectedByName: (await ctx.db.get(r.connectedBy))?.name ?? 'Unknown',
      })),
    )
  },
})

export type ConnectionStatus = 'connected' | 'disconnected'

/** A connection with no token is one waiting to be reconnected. */
function connectionStatus(
  conn: Doc<'integrationConnections'>,
): ConnectionStatus {
  return conn.accessToken ? 'connected' : 'disconnected'
}

/**
 * Take a connection's token out of the Group it belongs to.
 *
 * It has to be in *that* Group, not in any Group the caller happens to be in:
 * standing in one household is not standing to disconnect another one's Notion.
 * A connection that is not in this Group and one that has already gone are the
 * same no-op, so neither can be used to find out that the other exists.
 *
 * The **token** goes; the row stays. Deleting the row was the earlier shape and
 * it lost two things a Group needs: the lists linked to it were left pointing
 * at an id that named nothing, so they could not say which account they wanted
 * back, and reconnecting minted a fresh row that had to be guessed back onto
 * them. A tokenless row says "this account, disconnected", and connecting the
 * same account again fills it back in.
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
    await ctx.db.patch(args.connectionId, {
      accessToken: undefined,
      disconnectedAt: Date.now(),
    })
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
 * One named connection, token and all, authorised against the Group in the URL.
 *
 * Named for the Group *and* for the connection, because neither alone is an
 * identity any more: "my connection" was the caller-wide framing the Group
 * rebuild removed, and "the Group's Todoist" stopped being one the moment a
 * Group could connect two Todoist accounts. A list says which connection it
 * reads through; this is where that id is checked against the Group before its
 * token is used.
 */
export const getGroupConnection = internalQuery({
  args: {
    groupSlug: v.string(),
    connectionId: v.id('integrationConnections'),
  },
  handler: async (ctx, args) => {
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    const conn = await ctx.db.get(args.connectionId)
    if (!conn || conn.groupId !== group._id) return null
    return conn
  },
})

/**
 * Store the result of an OAuth round trip against the Group it was started in.
 *
 * Which row it lands on is decided by `externalAccountId` — the account at the
 * provider, not the token and not the provider alone. Re-authorising an account
 * the Group already has refills that row (including one whose token was
 * disconnected, which is what makes reconnect put every list linked to it back
 * to work); authorising a *different* account adds a row beside it.
 *
 * One-shot: a row stored before this field existed has no account id, and the
 * first re-authorisation adopts it rather than leaving a duplicate behind. See
 * `docs/migrations/0007-connection-account-identity.md` for what retires that.
 */
export const storeConnection = internalMutation({
  args: {
    groupId: v.id('groups'),
    provider: externalProvider,
    accessToken: v.string(),
    accountLabel: v.string(),
    externalAccountId: v.string(),
    connectedBy: v.id('users'),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('integrationConnections')
      .withIndex('by_group_provider', (q) =>
        q.eq('groupId', args.groupId).eq('provider', args.provider),
      )
      .collect()

    const existing =
      rows.find((r) => r.externalAccountId === args.externalAccountId) ??
      rows.find((r) => r.externalAccountId === undefined)

    if (existing) {
      await ctx.db.patch(existing._id, {
        accessToken: args.accessToken,
        accountLabel: args.accountLabel,
        externalAccountId: args.externalAccountId,
        connectedBy: args.connectedBy,
        disconnectedAt: undefined,
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
    // Read *and* write: Todoist is a writable Backend, and a token that can
    // only read would make every write fail at the provider with nothing gather
    // could do about it. A connection authorised before this line changed still
    // has the narrower scope and has to be reconnected once to gain writes —
    // which is what the permission failure it reports says to do.
    url.searchParams.set('scope', 'data:read_write')
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
      const data = (await res.json()) as { access_token: string }
      accessToken = data.access_token
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
    }

    // Which account this token speaks for, asked of the provider rather than
    // assumed from the provider's name — it is what decides whether this is a
    // second account for the Group or the same one, reconnected.
    const account = await getAdapter(args.provider).getAccountIdentity(
      accessToken,
    )

    await ctx.runMutation(internal.integrations.storeConnection, {
      groupId,
      provider: args.provider,
      accessToken,
      accountLabel: account.accountLabel,
      externalAccountId: account.externalAccountId,
      connectedBy: userId,
    })
  },
})

/**
 * The token behind one connection id, refused unless that connection is in the
 * Group the caller named and still connected.
 */
async function requireGroupConnection(
  ctx: ActionCtx,
  groupSlug: string,
  connectionId: Id<'integrationConnections'>,
) {
  const conn = await ctx.runQuery(internal.integrations.getGroupConnection, {
    groupSlug,
    connectionId,
  })
  // "Not in this Group" and "no such connection" are one answer, so a
  // connection id cannot be used to find out that another Group holds it.
  if (!conn) throw new ConvexError('Connection not found')
  if (!conn.accessToken) {
    throw new ConvexError(
      `This group's ${conn.provider} connection is disconnected — reconnect it in its settings`,
    )
  }
  return { ...conn, accessToken: conn.accessToken }
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

/**
 * The sources a *named connection* can see — its Todoist projects, its Notion
 * databases. Named by connection rather than by provider, because a Group with
 * two Todoist accounts has two different answers to "which projects".
 */
export const listSources = action({
  args: {
    connectionId: v.id('integrationConnections'),
    groupSlug: v.string(),
  },
  handler: async (ctx, args): Promise<ProviderSource[]> => {
    const conn = await requireGroupConnection(
      ctx,
      args.groupSlug,
      args.connectionId,
    )
    try {
      return await getAdapter(conn.provider).listAvailableSources(
        conn.accessToken,
      )
    } catch (error) {
      toUserError(error, conn.provider)
    }
  },
})

export const getSourceSchema = action({
  args: {
    connectionId: v.id('integrationConnections'),
    groupSlug: v.string(),
    sourceId: v.string(),
  },
  handler: async (ctx, args): Promise<SourceProperty[]> => {
    const conn = await requireGroupConnection(
      ctx,
      args.groupSlug,
      args.connectionId,
    )
    try {
      return await getAdapter(conn.provider).getSourceSchema(
        conn.accessToken,
        args.sourceId,
      )
    } catch (error) {
      toUserError(error, conn.provider)
    }
  },
})
