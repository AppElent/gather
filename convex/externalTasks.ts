/**
 * Writing to a Task list whose Backend is somebody else's system.
 *
 * Every one of these goes to the provider first and touches the cache only
 * after the provider has acknowledged it (ADR-0013). That order is the whole
 * point: a change the provider did not accept did not happen, and must never
 * be shown as though it had.
 *
 * The three outcomes, all of which the caller can act on:
 *
 * - **`ok`** — the provider took it and the cache says so.
 * - **`savedRemotely`** — the provider took it and the cache update did not
 *   land. Not an error: retrying would write it to the provider twice. The
 *   list is marked for reconciliation and the next refresh settles it.
 * - **a refusal** — the provider did not take it. The cache is untouched, and
 *   which refusal it was decides what the reader is told to do: reconnect,
 *   wait, or fix what they sent.
 *
 * Local lists are not here. They are written by the mutations in `tasks.ts`,
 * where a transaction is both available and correct.
 */

import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import type { ActionCtx } from './_generated/server'
import { action, internalMutation, internalQuery } from './_generated/server'
import { requireListAccess } from './lib/taskAccess'
import { getAdapter } from './lib/taskProviders'
import {
  type ExternalProviderId,
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderRequestError,
  ProviderUnsupportedError,
  type SourceConfig,
  type TaskInput,
  type UnifiedTask,
} from './lib/taskProviders/types'

const priorityValidator = v.union(
  v.literal(1),
  v.literal(2),
  v.literal(3),
  v.literal(4),
)

/** As the local mutations: null clears, absent leaves alone. */
const taskInputValidator = {
  title: v.optional(v.string()),
  dueDate: v.optional(v.union(v.string(), v.null())),
  priority: v.optional(v.union(priorityValidator, v.null())),
  labels: v.optional(v.union(v.array(v.string()), v.null())),
}

export type ExternalWriteResult =
  | { status: 'ok' }
  /** The provider took it; only gather's copy is behind. */
  | { status: 'savedRemotely' }

// ---------- authorisation ----------

/**
 * The list a write is about, with the token to reach it, refused unless the
 * caller is a Member of the Group in the URL.
 *
 * Internal because it carries the token. Not trusted because it is internal:
 * `requireListAccess` runs inside it, against the Group the request named, so
 * an action holding this result is holding an authorised list.
 */
export const getWritableList = internalQuery({
  args: { listId: v.id('taskLists'), groupSlug: v.string() },
  handler: async (ctx, args) => {
    const { list } = await requireListAccess(ctx, args.groupSlug, args.listId)
    if (list.provider === 'local') {
      throw new ConvexError('This list is written locally')
    }
    const config = list.providerConfig
    if (!config) {
      throw new ConvexError('This list is missing its provider configuration')
    }
    const conn = await ctx.db.get(config.connectionId)
    if (!conn || conn.groupId !== list.groupId) {
      throw new ConvexError('That connection does not belong to this group')
    }
    if (!conn.accessToken) {
      throw new ConvexError(
        `This group's ${list.provider} connection is disconnected — reconnect it in its settings`,
      )
    }
    return {
      listId: list._id,
      provider: list.provider,
      config,
      accessToken: conn.accessToken,
    }
  },
})

/**
 * The cached row a write is about, and the list it belongs to.
 *
 * A task carries no Group — it hangs off a list — so the Group is checked on
 * the list and the task follows, exactly as the local mutations do it. "No such
 * task" and "that task is in another Group's list" are one answer.
 */
export const getWritableTask = internalQuery({
  args: { taskId: v.id('tasks'), groupSlug: v.string() },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId)
    if (!task) throw new ConvexError('Task not found')
    const { list } = await requireListAccess(ctx, args.groupSlug, task.listId)
    if (list.provider === 'local') {
      throw new ConvexError('This list is written locally')
    }
    if (!task.externalId) {
      // A row on an external list with no provider identity is not something
      // the provider can be asked about, and reconciliation removes it.
      throw new ConvexError('That task is not known to the provider')
    }
    return { taskId: task._id, listId: list._id, externalId: task.externalId }
  },
})

// ---------- cache updates, after the provider has agreed ----------

const unifiedTaskValidator = v.object({
  externalId: v.string(),
  title: v.string(),
  done: v.boolean(),
  dueDate: v.optional(v.string()),
  priority: v.optional(priorityValidator),
  labels: v.optional(v.array(v.string())),
  url: v.optional(v.string()),
})

/**
 * Write one acknowledged task into the cache.
 *
 * Unauthorised, and safe to be: its callers below have already resolved the
 * same list through `requireListAccess` against the Group in the URL.
 */
export const cacheTask = internalMutation({
  args: { listId: v.id('taskLists'), task: unifiedTaskValidator },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('tasks')
      .withIndex('by_list_external', (q) =>
        q.eq('listId', args.listId).eq('externalId', args.task.externalId),
      )
      .unique()
    const fields = {
      title: args.task.title,
      done: args.task.done,
      dueDate: args.task.dueDate,
      priority: args.task.priority,
      labels: args.task.labels,
      url: args.task.url,
    }
    if (existing) {
      await ctx.db.patch(existing._id, fields)
      return
    }
    // A task created here goes to the end until the next refresh reads the
    // provider's own order back.
    const siblings = await ctx.db
      .query('tasks')
      .withIndex('by_list', (q) => q.eq('listId', args.listId))
      .collect()
    await ctx.db.insert('tasks', {
      listId: args.listId,
      externalId: args.task.externalId,
      order: siblings.reduce((max, t) => Math.max(max, t.order), -1) + 1,
      ...fields,
    })
  },
})

/** As `cacheTask`, authorised by the same callers. */
export const uncacheTask = internalMutation({
  args: { taskId: v.id('tasks') },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.taskId)
  },
})

/** As `cacheTask`, authorised by the same callers. */
export const setDoneInCache = internalMutation({
  args: { taskId: v.id('tasks'), done: v.boolean() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.taskId, { done: args.done })
  },
})

/**
 * Remember that the provider is ahead of the cache, so the list can say so
 * until a refresh settles it.
 */
export const markPendingReconciliation = internalMutation({
  args: { listId: v.id('taskLists') },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.listId, { pendingReconciliation: true })
  },
})

// ---------- the writes ----------

/**
 * Run the cache update for a write the provider has already accepted.
 *
 * Nothing here may report failure as failure. The provider took the change;
 * only gather's copy is behind, and telling the reader it failed would invite
 * them to send it again. The flag is best-effort for the same reason — if even
 * that cannot be written, the outcome is still `savedRemotely`.
 */
async function afterProviderAccepted(
  ctx: ActionCtx,
  listId: Id<'taskLists'>,
  updateCache: () => Promise<unknown>,
): Promise<ExternalWriteResult> {
  try {
    await updateCache()
    return { status: 'ok' }
  } catch {
    try {
      await ctx.runMutation(internal.externalTasks.markPendingReconciliation, {
        listId,
      })
    } catch {
      // Nothing further to try. The next refresh reconciles regardless.
    }
    return { status: 'savedRemotely' }
  }
}

/** What a provider failure means to the person who asked for the write. */
function toUserError(error: unknown, provider: ExternalProviderId): never {
  if (error instanceof ProviderAuthError) {
    throw new ConvexError(
      `This group's ${provider} connection expired — reconnect it in its settings`,
    )
  }
  if (error instanceof ProviderRateLimitError) {
    throw new ConvexError(
      `${provider} is busy — wait a moment and try again`,
    )
  }
  if (error instanceof ProviderUnsupportedError) {
    throw new ConvexError(error.message)
  }
  if (error instanceof ProviderRequestError) {
    // 404 is the interesting one: it usually means somebody deleted the task
    // in the provider while this reader was looking at the cached copy.
    throw new ConvexError(
      error.status === 404
        ? `That task is no longer in ${provider} — refresh the list`
        : `${provider} refused that change — check the list in ${provider}`,
    )
  }
  if (error instanceof ConvexError) throw error
  throw new ConvexError(`Could not reach ${provider} — try again`)
}

/** The adapter method for one operation, or a refusal naming the operation. */
function requireOperation<T>(
  method: T | undefined,
  provider: ExternalProviderId,
  operation: string,
): T {
  if (!method) throw new ProviderUnsupportedError(provider, operation)
  return method
}

function toTaskInput(args: {
  title?: string
  dueDate?: string | null
  priority?: 1 | 2 | 3 | 4 | null
  labels?: string[] | null
}): TaskInput {
  return {
    title: args.title,
    dueDate: args.dueDate,
    priority: args.priority,
    labels: args.labels,
  }
}

export const create = action({
  args: {
    listId: v.id('taskLists'),
    groupSlug: v.string(),
    ...taskInputValidator,
    // A new task has to be called something, so `title` is required here even
    // though an edit may leave it alone.
    title: v.string(),
  },
  handler: async (ctx, args): Promise<ExternalWriteResult> => {
    const list = await ctx.runQuery(internal.externalTasks.getWritableList, {
      listId: args.listId,
      groupSlug: args.groupSlug,
    })
    const adapter = getAdapter(list.provider)

    let created: UnifiedTask
    try {
      created = await requireOperation(
        adapter.createTask,
        list.provider,
        'creating tasks',
      ).call(
        adapter,
        list.accessToken,
        list.config as SourceConfig,
        { ...toTaskInput(args), title: args.title },
      )
    } catch (error) {
      toUserError(error, list.provider)
    }

    return await afterProviderAccepted(ctx, list.listId, () =>
      ctx.runMutation(internal.externalTasks.cacheTask, {
        listId: args.listId,
        task: created,
      }),
    )
  },
})

export const update = action({
  args: {
    taskId: v.id('tasks'),
    groupSlug: v.string(),
    ...taskInputValidator,
  },
  handler: async (ctx, args): Promise<ExternalWriteResult> => {
    const task = await ctx.runQuery(internal.externalTasks.getWritableTask, {
      taskId: args.taskId,
      groupSlug: args.groupSlug,
    })
    const list = await ctx.runQuery(internal.externalTasks.getWritableList, {
      listId: task.listId,
      groupSlug: args.groupSlug,
    })
    const adapter = getAdapter(list.provider)

    let updated: UnifiedTask
    try {
      updated = await requireOperation(
        adapter.updateTask,
        list.provider,
        'editing tasks',
      ).call(
        adapter,
        list.accessToken,
        list.config as SourceConfig,
        task.externalId,
        toTaskInput(args),
      )
    } catch (error) {
      toUserError(error, list.provider)
    }

    return await afterProviderAccepted(ctx, list.listId, () =>
      ctx.runMutation(internal.externalTasks.cacheTask, {
        listId: task.listId,
        task: updated,
      }),
    )
  },
})

export const setDone = action({
  args: {
    taskId: v.id('tasks'),
    groupSlug: v.string(),
    done: v.boolean(),
  },
  handler: async (ctx, args): Promise<ExternalWriteResult> => {
    const task = await ctx.runQuery(internal.externalTasks.getWritableTask, {
      taskId: args.taskId,
      groupSlug: args.groupSlug,
    })
    const list = await ctx.runQuery(internal.externalTasks.getWritableList, {
      listId: task.listId,
      groupSlug: args.groupSlug,
    })
    const adapter = getAdapter(list.provider)

    try {
      await requireOperation(
        adapter.setDone,
        list.provider,
        'completing tasks',
      ).call(
        adapter,
        list.accessToken,
        list.config as SourceConfig,
        task.externalId,
        args.done,
      )
    } catch (error) {
      toUserError(error, list.provider)
    }

    return await afterProviderAccepted(ctx, list.listId, () =>
      ctx.runMutation(internal.externalTasks.setDoneInCache, {
        taskId: args.taskId,
        done: args.done,
      }),
    )
  },
})

export const remove = action({
  args: { taskId: v.id('tasks'), groupSlug: v.string() },
  handler: async (ctx, args): Promise<ExternalWriteResult> => {
    const task = await ctx.runQuery(internal.externalTasks.getWritableTask, {
      taskId: args.taskId,
      groupSlug: args.groupSlug,
    })
    const list = await ctx.runQuery(internal.externalTasks.getWritableList, {
      listId: task.listId,
      groupSlug: args.groupSlug,
    })
    const adapter = getAdapter(list.provider)

    try {
      await requireOperation(
        adapter.deleteTask,
        list.provider,
        'deleting tasks',
      ).call(
        adapter,
        list.accessToken,
        list.config as SourceConfig,
        task.externalId,
      )
    } catch (error) {
      toUserError(error, list.provider)
    }

    return await afterProviderAccepted(ctx, list.listId, () =>
      ctx.runMutation(internal.externalTasks.uncacheTask, {
        taskId: args.taskId,
      }),
    )
  },
})
