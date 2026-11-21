import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import { internalMutation, type QueryCtx } from './_generated/server'
import {
  GROCERY_HISTORY_WINDOW,
  isGroceryList,
  recentListItems,
} from './lib/groceryCategories'
import { cancelSend } from './lib/taskReminders'
import { purgeCompletionsOfTask } from './lib/taskRepeat'
import { GROCERY_HABITS_WINDOW, RECENT_GROCERIES_WINDOW } from './tasks'

/**
 * Checked grocery items each grocery list keeps (APP-404): the most that
 * Recent or the habits read per list (`RECENT_GROCERIES_WINDOW`,
 * `GROCERY_HABITS_WINDOW`), plus Recent's window again as a margin. Between
 * two daily runs up to that many of the kept items can be unchecked, deleted
 * or moved before an item the prune removed would have come into either
 * window, so both read exactly what they read without the prune.
 */
export const CHECKED_GROCERIES_KEPT =
  Math.max(GROCERY_HABITS_WINDOW, RECENT_GROCERIES_WINDOW) +
  RECENT_GROCERIES_WINDOW

/** Grocery list rows one prune step reads; it schedules itself for the rest. */
const PRUNE_PAGE_SIZE = 250

/** Lists the daily entry point reads per step. */
const LISTS_PAGE_SIZE = 100

/**
 * Which half of `by_list_and_done_at` a step reads. Only `stamped` is read:
 * every checked item has a stamp since `maintenance:backfillDoneAt`
 * (APP-445), so the range without one holds open items only. `unstamped` is
 * still accepted so a step scheduled before that deploy ends quietly; delete
 * it with the backfill.
 */
const rangeValidator = v.union(v.literal('stamped'), v.literal('unstamped'))

/**
 * A subtask, or a task with subtasks (APP-304). A grocery list makes neither,
 * but a list that had them can become one (`kitchen.setGroceryList`). The
 * prune keeps both: deleting a parent the way `tasks.remove` does would take
 * its open subtasks too, and deleting a subtask would change its parent's
 * progress. Such rows stay for good, but a list gains them only before it
 * becomes a grocery list, so their number does not grow.
 */
async function inSubtaskTree(ctx: QueryCtx, task: Doc<'tasks'>) {
  if (task.parentTaskId) return true
  const child = await ctx.db
    .query('tasks')
    .withIndex('by_parent', (q) => q.eq('parentTaskId', task._id))
    .first()
  return child !== null
}

/**
 * The daily prune of checked grocery items (APP-404), run by `crons.ts`:
 * every local grocery list gets its own prune, a page of lists at a time.
 * Only grocery lists (`isGroceryList`); other lists keep every row.
 *
 * `dryRun` only logs, per list that has any, how many items a real run
 * would delete.
 */
export const pruneCheckedGroceries = internalMutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    dryRun: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query('taskLists')
      .paginate({ cursor: args.cursor ?? null, numItems: LISTS_PAGE_SIZE })
    const groups = new Map<Id<'groups'>, Doc<'groups'> | null>()
    for (const list of page.page) {
      if (list.provider !== 'local') continue
      if (!groups.has(list.groupId))
        groups.set(list.groupId, await ctx.db.get(list.groupId))
      const group = groups.get(list.groupId)
      if (!group || !isGroceryList(group, list)) continue
      await ctx.scheduler.runAfter(
        0,
        internal.groceryPrune.pruneCheckedGroceryList,
        { listId: list._id, dryRun: args.dryRun },
      )
    }
    if (!page.isDone)
      await ctx.scheduler.runAfter(
        0,
        internal.groceryPrune.pruneCheckedGroceries,
        { cursor: page.continueCursor, dryRun: args.dryRun },
      )
    return null
  },
})

/**
 * One grocery list's prune (APP-404), a page per step. A checked item is
 * deleted, with its reminder send and completion rows as `tasks.remove`
 * deletes them, only when it is in none of these:
 *
 * - the list's newest `CHECKED_GROCERIES_KEPT` items by `doneAt`, newest
 *   check first: Recent and the habits;
 * - the list's newest `GROCERY_HISTORY_WINDOW` rows by when they were added:
 *   the history recognition reads (`recentListItems`). Their oldest moment
 *   is taken once, at the first step, and handed on (`protectFrom`).
 *
 * Open items, subtasks and tasks with subtasks are never deleted. Each step
 * reads the list again and stops when it is gone or no longer a local
 * grocery list. Safe to run again: whatever it already deleted is not read,
 * and a second run over the same list keeps the same items.
 */
export const pruneCheckedGroceryList = internalMutation({
  args: {
    listId: v.id('taskLists'),
    dryRun: v.optional(v.boolean()),
    range: v.optional(rangeValidator),
    cursor: v.optional(v.union(v.string(), v.null())),
    kept: v.optional(v.number()),
    removed: v.optional(v.number()),
    protectFrom: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const list = await ctx.db.get(args.listId)
    const group = list ? await ctx.db.get(list.groupId) : null
    if (!list || !group || list.provider !== 'local') return null
    if (!isGroceryList(group, list)) return null
    // A step queued before APP-445 for the no-stamp range: nothing to read.
    if (args.range === 'unstamped') return null

    let protectFrom = args.protectFrom
    if (protectFrom === undefined) {
      const newest = await recentListItems(ctx, list._id)
      // Fewer rows than recognition reads: every one is still its history.
      if (newest.length < GROCERY_HISTORY_WINDOW) return null
      protectFrom = newest[newest.length - 1]._creationTime
    }

    const page = await ctx.db
      .query('tasks')
      .withIndex('by_list_and_done_at', (q) =>
        q.eq('listId', list._id).gt('doneAt', 0),
      )
      .order('desc')
      .paginate({ cursor: args.cursor ?? null, numItems: PRUNE_PAGE_SIZE })

    let kept = args.kept ?? 0
    let removed = args.removed ?? 0
    for (const task of page.page) {
      if (!task.done) continue
      if (kept < CHECKED_GROCERIES_KEPT) {
        kept++
        continue
      }
      if (task._creationTime >= protectFrom) continue
      if (await inSubtaskTree(ctx, task)) continue
      removed++
      if (args.dryRun) continue
      await cancelSend(ctx, task)
      await purgeCompletionsOfTask(ctx, task._id)
      await ctx.db.delete(task._id)
    }

    const next = { listId: list._id, dryRun: args.dryRun, protectFrom }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.groceryPrune.pruneCheckedGroceryList,
        { ...next, cursor: page.continueCursor, kept, removed },
      )
      return null
    }
    if (removed)
      console.log(
        `checked-groceries prune list=${list._id} ` +
          `${args.dryRun ? 'wouldRemove' : 'removed'}=${removed}`,
      )
    return null
  },
})
