/**
 * One change a paired watch made (APP-653), through the same code the apps'
 * own mutations use (`tasks.prepareTask`, `tasks.changeTask`).
 *
 * Each change is its own transaction, so one that is refused leaves the rest of
 * an outbox alone, and it is applied once per key: a watch that lost the answer
 * sends the change again. The receipt is an `idempotencyKeys` row in the same
 * transaction. Unlike `createOnce`, a receipt whose row has since been deleted
 * still counts: an item somebody took off the list must not come back because
 * a watch was late.
 */
import { groceryAddFields } from '@gather/core/groceries'
import type { WatchRefusalCode } from '@gather/core/refusals'
import { v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import { internalMutation, type MutationCtx } from './_generated/server'
import { isGroceryList } from './lib/groceryCategories'
import {
  resolveWatch,
  type WatchCaller,
  watchGroceryList,
} from './lib/watchAccess'
import { changeTask, prepareTask } from './tasks'

export const watchChangeValidator = v.union(
  v.object({ kind: v.literal('grocery.check'), taskId: v.string() }),
  v.object({ kind: v.literal('grocery.uncheck'), taskId: v.string() }),
  v.object({ kind: v.literal('grocery.add'), text: v.string() }),
  v.object({
    kind: v.literal('task.done'),
    taskId: v.string(),
    /** The due date the watch showed, so a repeating task moves on once. */
    occurrence: v.optional(v.union(v.string(), v.null())),
  }),
)

type Refused = { ok: false; code: WatchRefusalCode }
const refused = (code: WatchRefusalCode): Refused => ({ ok: false, code })

/** A local task of the watch's Group: elsewhere and nowhere are one answer. */
async function taskInGroup(
  ctx: MutationCtx,
  { group }: WatchCaller,
  taskId: string,
): Promise<{ ok: true; task: Doc<'tasks'>; list: Doc<'taskLists'> } | Refused> {
  const id = ctx.db.normalizeId('tasks', taskId)
  const task = id && (await ctx.db.get(id))
  const list = task && (await ctx.db.get(task.listId))
  if (!task || !list || list.groupId !== group._id) return refused('not-found')
  if (list.provider !== 'local') return refused('read-only')
  return { ok: true, task, list }
}

export const apply = internalMutation({
  args: {
    keyHash: v.string(),
    key: v.string(),
    change: watchChangeValidator,
  },
  handler: async (
    ctx,
    { keyHash, key, change },
  ): Promise<
    | { ok: true; taskId: Id<'tasks'> }
    | Refused
    | { ok: false; refused: 'not-signed-in' | 'not-a-member' }
  > => {
    const caller = await resolveWatch(ctx, keyHash)
    if (!caller.ok) return { ok: false, refused: caller.reason }
    const { user, group } = caller

    // Kept apart from a connected app's keys, and from another kind of change.
    const receiptKey = `watch:${change.kind}:${key}`
    const receipt = await ctx.db
      .query('idempotencyKeys')
      .withIndex('by_user_and_key', (q) =>
        q.eq('userId', user._id).eq('key', receiptKey),
      )
      // `first`, not `unique`: merging duplicate accounts may leave two rows.
      .first()
    if (receipt) {
      const taskId = receipt.docId as Id<'tasks'>
      if ('taskId' in change && change.taskId !== taskId)
        return refused('key-reused')
      return { ok: true, taskId }
    }
    const done = async (taskId: Id<'tasks'>) => {
      await ctx.db.insert('idempotencyKeys', {
        userId: user._id,
        key: receiptKey,
        table: 'tasks',
        docId: taskId,
      })
      return { ok: true as const, taskId }
    }

    if (change.kind === 'grocery.add') {
      const list = await watchGroceryList(ctx, caller)
      if (!list) return refused('not-found')
      const insert = await prepareTask(
        ctx,
        { user, group, list },
        { listId: list._id, ...groceryAddFields(change.text) },
      )
      return await done(await insert())
    }

    const found = await taskInGroup(ctx, caller, change.taskId)
    if (!found.ok) return found
    const { task, list } = found
    if (change.kind !== 'task.done' && !isGroceryList(group, list))
      return refused('not-found')
    await changeTask(
      ctx,
      { user, group, list, task },
      {
        taskId: task._id,
        done: change.kind !== 'grocery.uncheck',
        ...(change.kind === 'task.done' && change.occurrence !== undefined
          ? { occurrence: change.occurrence }
          : {}),
      },
    )
    return await done(task._id)
  },
})
