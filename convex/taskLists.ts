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
import type { QueryCtx } from './_generated/server'
import { reconcileList } from './lib/taskCache'
import { capabilitiesFor, getAdapter } from './lib/taskProviders'
import {
  type ExternalProviderId,
  ProviderAuthError,
  type ProviderId,
  type TaskCapabilities,
  type UnifiedTask,
} from './lib/taskProviders/types'
import { requireGroupBySlug } from './lib/groupAccess'
import { requireListAccess } from './lib/taskAccess'

const providerConfigValidator = v.object({
  connectionId: v.id('integrationConnections'),
  sourceId: v.string(),
  sourceName: v.optional(v.string()),
  propertyMapping: v.optional(
    v.object({
      title: v.string(),
      done: v.string(),
      dueDate: v.optional(v.string()),
      priority: v.optional(v.string()),
      labels: v.optional(v.string()),
    }),
  ),
})

/**
 * The lists of the Group in the URL, and of no other.
 *
 * An external list comes back saying where it reads from — which provider,
 * which of the Group's connections, and which source at that connection. A
 * list that does not say which of two Todoist accounts it is showing is a list
 * whose contents nobody can account for; the token behind that connection is
 * still not in the answer.
 */
export const list = query({
  args: { groupSlug: v.string() },
  handler: async (ctx, args) => {
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    const lists = await ctx.db
      .query('taskLists')
      .withIndex('by_group', (q) => q.eq('groupId', group._id))
      .collect()
    return await Promise.all(
      lists
        .sort((a, b) => a.order - b.order)
        .map(async (l) => ({
          _id: l._id,
          name: l.name,
          provider: l.provider,
          source: await describeSource(ctx, l),
        })),
    )
  },
})

export interface TaskListSourceView {
  connectionId: Id<'integrationConnections'>
  /** Absent when the connection has been removed outright. */
  accountLabel: string | null
  connectionStatus: 'connected' | 'disconnected' | 'missing'
  sourceId: string
  sourceName: string | null
}

/** What an external list reads from, in words, with no token in it. */
async function describeSource(
  ctx: QueryCtx,
  list: Doc<'taskLists'>,
): Promise<TaskListSourceView | null> {
  const config = list.providerConfig
  if (list.provider === 'local' || !config) return null
  const conn = await ctx.db.get(config.connectionId)
  return {
    connectionId: config.connectionId,
    accountLabel: conn?.accountLabel ?? null,
    connectionStatus: !conn
      ? 'missing'
      : conn.accessToken
        ? 'connected'
        : 'disconnected',
    sourceId: config.sourceId,
    sourceName: config.sourceName ?? null,
  }
}

export const create = mutation({
  args: {
    name: v.string(),
    provider: v.union(
      v.literal('local'),
      v.literal('notion'),
      v.literal('todoist'),
    ),
    providerConfig: v.optional(providerConfigValidator),
    groupSlug: v.string(),
  },
  handler: async (ctx, args) => {
    // A list belongs to the Group in the URL, and the connection it links to
    // has to belong there too — both read the same groupId, so a slug cannot
    // be used to borrow another Group's Notion token.
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    const groupId = group._id

    if (args.provider === 'local') {
      if (args.providerConfig) {
        throw new ConvexError('Local lists take no provider config')
      }
    } else {
      if (!args.providerConfig) {
        throw new ConvexError('External lists need a provider config')
      }
      if (args.provider === 'notion' && !args.providerConfig.propertyMapping) {
        throw new ConvexError('Notion lists need a property mapping')
      }
      const conn = await ctx.db.get(args.providerConfig.connectionId)
      if (!conn || conn.groupId !== groupId || conn.provider !== args.provider) {
        throw new ConvexError('That connection does not belong to this group')
      }
      if (!conn.accessToken) {
        throw new ConvexError(
          'That connection is disconnected — reconnect it first',
        )
      }
    }

    const existing = await ctx.db
      .query('taskLists')
      .withIndex('by_group', (q) => q.eq('groupId', groupId))
      .collect()
    // existing.length collides with a sibling's order once any list has
    // been deleted, so derive the next order from the current max instead.
    const nextOrder =
      existing.reduce((max, l) => Math.max(max, l.order), -1) + 1
    return await ctx.db.insert('taskLists', {
      groupId,
      name: args.name,
      provider: args.provider,
      providerConfig: args.providerConfig,
      order: nextOrder,
    })
  },
})

export const rename = mutation({
  args: {
    listId: v.id('taskLists'),
    groupSlug: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    await requireListAccess(ctx, args.groupSlug, args.listId)
    await ctx.db.patch(args.listId, { name: args.name })
  },
})

export const remove = mutation({
  args: { listId: v.id('taskLists'), groupSlug: v.string() },
  handler: async (ctx, args) => {
    await requireListAccess(ctx, args.groupSlug, args.listId)
    const tasks = await ctx.db
      .query('tasks')
      .withIndex('by_list', (q) => q.eq('listId', args.listId))
      .collect()
    await Promise.all(tasks.map((t) => ctx.db.delete(t._id)))
    await ctx.db.delete(args.listId)
  },
})

/**
 * The list behind `getTasks`, authorised for the caller. Internal because it
 * carries `providerConfig`, not because it is trusted: an action has no `ctx.db`
 * and the caller's identity reaches this query, so the Group is checked here.
 */
export const getList = internalQuery({
  args: { listId: v.id('taskLists'), groupSlug: v.string() },
  handler: async (ctx, args) => {
    const { list } = await requireListAccess(ctx, args.groupSlug, args.listId)
    return list
  },
})

/**
 * What kind of Backend a list has, what it can do, and — for an external one —
 * how current what you are reading is.
 *
 * The Tasks Module reads this instead of asking which provider it is holding
 * (ADR-0014). Everything it needs to decide what to offer is here, and nothing
 * a token could be recovered from is.
 */
export interface TaskListBackendView {
  provider: ProviderId
  capabilities: TaskCapabilities
  source: TaskListSourceView | null
  sync: TaskListSyncView | null
  /**
   * True when no write may be offered *at all*, whatever the capabilities say
   * — the provider cannot be reached, so accepting one would mean writing a
   * change into the cache that nothing authoritative ever agreed to.
   */
  readOnly: boolean
}

export interface TaskListSyncView {
  /** null until the list has been read once. */
  lastSyncedAt: number | null
  /** Nothing has been fetched yet: the first open is what fetches it. */
  neverSynced: boolean
  state: 'ready' | 'stale' | 'reconnect' | 'unconfigured'
  /**
   * The provider accepted a write that the cache did not record. What is on
   * screen is knowingly behind what is true, and a refresh settles it.
   */
  pendingReconciliation: boolean
}

export const backend = query({
  args: { listId: v.id('taskLists'), groupSlug: v.string() },
  handler: async (ctx, args): Promise<TaskListBackendView> => {
    const { list } = await requireListAccess(ctx, args.groupSlug, args.listId)
    if (list.provider === 'local') {
      return {
        provider: 'local',
        capabilities: capabilitiesFor('local'),
        source: null,
        sync: null,
        readOnly: false,
      }
    }

    const config = list.providerConfig
    const conn = config ? await ctx.db.get(config.connectionId) : null
    const state: TaskListSyncView['state'] = !config
      ? 'unconfigured'
      : !conn?.accessToken
        ? // The account behind this list is disconnected or gone. What is
          // cached stays readable — it is still the last thing the provider
          // said — but nothing may be written through a connection that is not
          // there (ADR-0013).
          'reconnect'
        : list.lastSyncFailedAt
          ? 'stale'
          : 'ready'

    return {
      provider: list.provider,
      capabilities: capabilitiesFor(list.provider, config),
      source: await describeSource(ctx, list),
      sync: {
        lastSyncedAt: list.lastSyncedAt ?? null,
        neverSynced: list.lastSyncedAt === undefined,
        state,
        pendingReconciliation: list.pendingReconciliation === true,
      },
      readOnly: state !== 'ready',
    }
  },
})

export type RefreshResult =
  | { status: 'ok'; added: number; updated: number; deleted: number }
  | { status: 'reconnect'; provider: ExternalProviderId }
  | { status: 'error'; message: string }

/**
 * Read the provider and write what it said into the cache.
 *
 * The only thing that fetches. It runs when a list is first opened and when a
 * Member asks for it, and never on a schedule (ADR-0013) — a household that has
 * not opened Tasks today does not need gather spending their provider quota.
 *
 * A failure leaves the cache alone and marks the list stale: what is on screen
 * is still the last thing the provider said, and saying so is more useful than
 * blanking it.
 */
export const refresh = action({
  args: { listId: v.id('taskLists'), groupSlug: v.string() },
  handler: async (ctx, args): Promise<RefreshResult> => {
    const list = await ctx.runQuery(internal.taskLists.getList, {
      listId: args.listId,
      groupSlug: args.groupSlug,
    })

    if (list.provider === 'local') {
      // Local lists are already what they are. Refreshing one is a no-op
      // rather than an error, so the Module can offer one control.
      return { status: 'ok', added: 0, updated: 0, deleted: 0 }
    }

    const config = list.providerConfig
    if (!config) {
      return {
        status: 'error',
        message: 'This list is missing its provider configuration',
      }
    }
    const conn = await ctx.runQuery(internal.integrations.getConnection, {
      connectionId: config.connectionId,
    })
    if (!conn?.accessToken) {
      await ctx.runMutation(internal.taskLists.markSyncFailed, {
        listId: args.listId,
      })
      return { status: 'reconnect', provider: list.provider }
    }

    let tasks: UnifiedTask[]
    try {
      tasks = await getAdapter(list.provider).fetchTasks(
        conn.accessToken,
        config,
      )
    } catch (error) {
      await ctx.runMutation(internal.taskLists.markSyncFailed, {
        listId: args.listId,
      })
      if (error instanceof ProviderAuthError) {
        return { status: 'reconnect', provider: list.provider }
      }
      return {
        status: 'error',
        message: `Could not load tasks from ${list.provider} — try refreshing`,
      }
    }

    const counts = await ctx.runMutation(internal.taskLists.applyRefresh, {
      listId: args.listId,
      tasks,
    })
    return { status: 'ok', ...counts }
  },
})

const unifiedTaskValidator = v.object({
  externalId: v.string(),
  title: v.string(),
  done: v.boolean(),
  dueDate: v.optional(v.string()),
  priority: v.optional(
    v.union(v.literal(1), v.literal(2), v.literal(3), v.literal(4)),
  ),
  labels: v.optional(v.array(v.string())),
  url: v.optional(v.string()),
  parentExternalId: v.optional(v.string()),
})

/**
 * Write one provider answer into the cache.
 *
 * Unauthorised, and safe to be, because its only caller is `refresh` above,
 * which has already resolved the same list through `requireListAccess` against
 * the Group in the URL. Nothing else may call it; a second caller would have to
 * do that check for itself first.
 */
export const applyRefresh = internalMutation({
  args: {
    listId: v.id('taskLists'),
    tasks: v.array(unifiedTaskValidator),
  },
  handler: async (ctx, args) => {
    const counts = await reconcileList(ctx, args.listId, args.tasks)
    await ctx.db.patch(args.listId, {
      lastSyncedAt: Date.now(),
      lastSyncFailedAt: undefined,
      // Settled: whatever the cache was behind on, it has just been read from
      // the provider directly.
      pendingReconciliation: undefined,
    })
    return counts
  },
})

/** As `applyRefresh`, and authorised by the same caller. */
export const markSyncFailed = internalMutation({
  args: { listId: v.id('taskLists') },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.listId, { lastSyncFailedAt: Date.now() })
  },
})
