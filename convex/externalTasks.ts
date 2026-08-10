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
import {
  depthUnder,
  requireDepthWithin,
  requireValidParent,
  withDescendants,
} from './lib/taskTree'
import { capabilitiesFor, getAdapter } from './lib/taskProviders'
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

/**
 * The provider's id for a parent a new subtask is going under, with the depth
 * the placement would sit at checked against what the Backend can hold.
 *
 * The check is here rather than in the UI as well as the UI: a control the
 * capability list hid is not a control an API may assume was never used.
 */
export const resolveParent = internalQuery({
  args: {
    listId: v.id('taskLists'),
    groupSlug: v.string(),
    parentTaskId: v.id('tasks'),
  },
  handler: async (ctx, args) => {
    const { list } = await requireListAccess(ctx, args.groupSlug, args.listId)
    const parent = await ctx.db.get(args.parentTaskId)
    if (!parent || parent.listId !== args.listId) {
      throw new ConvexError('That parent task is not in this list')
    }
    if (!parent.externalId) {
      throw new ConvexError('That task is not known to the provider')
    }
    requireDepthWithin(
      await depthUnder(ctx, args.parentTaskId),
      capabilitiesFor(list.provider, list.providerConfig).maxDepth,
    )
    return parent.externalId
  },
})

/** A task and its subtasks, so a deletion here matches the provider's. */
export const cascadeIds = internalQuery({
  args: { taskId: v.id('tasks'), groupSlug: v.string() },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId)
    if (!task) return []
    await requireListAccess(ctx, args.groupSlug, task.listId)
    return await withDescendants(ctx, args.taskId)
  },
})

/**
 * The move a reparent is asking for, checked before anything is sent: the new
 * parent has to be in this list, must not be the task or anything under it,
 * and the result must sit within the Backend's depth.
 */
export const resolveMove = internalQuery({
  args: {
    taskId: v.id('tasks'),
    groupSlug: v.string(),
    parentTaskId: v.optional(v.union(v.id('tasks'), v.null())),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId)
    if (!task) throw new ConvexError('Task not found')
    const { list } = await requireListAccess(ctx, args.groupSlug, task.listId)
    if (list.provider === 'local') {
      throw new ConvexError('This list is written locally')
    }
    if (!task.externalId) {
      throw new ConvexError('That task is not known to the provider')
    }
    const parentTaskId = args.parentTaskId ?? undefined
    await requireValidParent(ctx, task, parentTaskId)
    requireDepthWithin(
      await depthUnder(ctx, parentTaskId),
      capabilitiesFor(list.provider, list.providerConfig).maxDepth,
    )
    const parent = parentTaskId ? await ctx.db.get(parentTaskId) : null
    if (parentTaskId && !parent?.externalId) {
      throw new ConvexError('That task is not known to the provider')
    }
    return {
      listId: list._id,
      externalId: task.externalId,
      parentExternalId: parent?.externalId ?? null,
      parentTaskId: parentTaskId ?? null,
    }
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
  parentExternalId: v.optional(v.string()),
})

/**
 * Write one acknowledged task into the cache.
 *
 * Unauthorised, and safe to be: its callers below have already resolved the
 * same list through `requireListAccess` against the Group in the URL.
 */
export const cacheTask = internalMutation({
  args: {
    listId: v.id('taskLists'),
    task: unifiedTaskValidator,
    parentTaskId: v.optional(v.union(v.id('tasks'), v.null())),
  },
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
      // The caller knows the parent as a row here; the provider's answer knows
      // it as an id there. Both say the same thing, and the row's is the one
      // this table can check.
      parentTaskId: args.parentTaskId ?? undefined,
      ...fields,
    })
  },
})

/** As `cacheTask`, authorised by the same callers. */
export const uncacheTask = internalMutation({
  args: { taskIds: v.array(v.id('tasks')) },
  handler: async (ctx, args) => {
    for (const taskId of args.taskIds) {
      // Already gone is fine — this is reconciling a deletion the provider has
      // already made, and the cache being ahead of us is not a failure.
      if (await ctx.db.get(taskId)) await ctx.db.delete(taskId)
    }
  },
})

/** As `cacheTask`, authorised by the same callers. */
export const setParentInCache = internalMutation({
  args: {
    taskId: v.id('tasks'),
    parentTaskId: v.union(v.id('tasks'), v.null()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.taskId, {
      parentTaskId: args.parentTaskId ?? undefined,
    })
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
    /** Makes this a subtask of another task on the same list. */
    parentTaskId: v.optional(v.id('tasks')),
  },
  handler: async (ctx, args): Promise<ExternalWriteResult> => {
    const list = await ctx.runQuery(internal.externalTasks.getWritableList, {
      listId: args.listId,
      groupSlug: args.groupSlug,
    })
    const parentExternalId = args.parentTaskId
      ? await ctx.runQuery(internal.externalTasks.resolveParent, {
          listId: args.listId,
          groupSlug: args.groupSlug,
          parentTaskId: args.parentTaskId,
        })
      : undefined
    const adapter = getAdapter(list.provider)

    let created: UnifiedTask
    try {
      created = await requireOperation(
        adapter.createTask,
        list.provider,
        'creating tasks',
      ).call(adapter, list.accessToken, list.config as SourceConfig, {
        ...toTaskInput(args),
        title: args.title,
        parentExternalId,
      })
    } catch (error) {
      toUserError(error, list.provider)
    }

    return await afterProviderAccepted(ctx, list.listId, () =>
      ctx.runMutation(internal.externalTasks.cacheTask, {
        listId: args.listId,
        task: created,
        parentTaskId: args.parentTaskId ?? null,
      }),
    )
  },
})

/**
 * Move a task under a different parent, or to the top level.
 *
 * Provider-first like every other write: Todoist decides whether the move is
 * allowed, and the cache follows only once it has.
 */
export const move = action({
  args: {
    taskId: v.id('tasks'),
    groupSlug: v.string(),
    parentTaskId: v.optional(v.union(v.id('tasks'), v.null())),
  },
  handler: async (ctx, args): Promise<ExternalWriteResult> => {
    const move = await ctx.runQuery(internal.externalTasks.resolveMove, {
      taskId: args.taskId,
      groupSlug: args.groupSlug,
      parentTaskId: args.parentTaskId,
    })
    const list = await ctx.runQuery(internal.externalTasks.getWritableList, {
      listId: move.listId,
      groupSlug: args.groupSlug,
    })
    const adapter = getAdapter(list.provider)

    try {
      await requireOperation(
        adapter.moveTask,
        list.provider,
        'moving subtasks',
      ).call(
        adapter,
        list.accessToken,
        list.config as SourceConfig,
        move.externalId,
        move.parentExternalId,
      )
    } catch (error) {
      toUserError(error, list.provider)
    }

    return await afterProviderAccepted(ctx, list.listId, () =>
      ctx.runMutation(internal.externalTasks.setParentInCache, {
        taskId: args.taskId,
        parentTaskId: move.parentTaskId,
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

    // Todoist deletes a task's subtasks with it, so the cache does too —
    // otherwise the next reader sees rows that nothing in the Module can reach
    // and that no longer exist at the provider.
    const cascade = await ctx.runQuery(internal.externalTasks.cascadeIds, {
      taskId: args.taskId,
      groupSlug: args.groupSlug,
    })
    return await afterProviderAccepted(ctx, list.listId, () =>
      ctx.runMutation(internal.externalTasks.uncacheTask, {
        taskIds: cascade,
      }),
    )
  },
})
