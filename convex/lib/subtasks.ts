/**
 * Subtasks on the server (APP-304): the parent rules every write checks, and
 * what a parent's completion, repeat and deletion do to its subtasks. The
 * shared rules are `@gather/core/subtasks`.
 *
 * - A subtask sits on its parent's list, and its parent has no parent: one
 *   level deep, checked here on every write that sets `parentTaskId`.
 * - A subtask does not repeat on its own.
 * - A repeating parent's next occurrence reopens its subtasks; the completion
 *   remembers which were checked, so its undo checks them again.
 * - It also moves each dated subtask by as many days as the parent moved
 *   (APP-451), with its reminder, so a weekly step is not overdue from the
 *   second week on. Undo moves them back by the same days.
 * - Deleting a parent deletes its subtasks.
 */
import { addDays } from '@gather/core/civil-date'
import { taskRefusal } from '@gather/core/refusals'
import { ConvexError } from 'convex/values'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { isGroceryList } from './groceryCategories'
import { cancelSend, shiftedReminder, syncSend } from './taskReminders'

/** A task's subtasks, in no particular order. */
export async function subtasksOfTask(
  ctx: QueryCtx,
  parentId: Id<'tasks'>,
): Promise<Doc<'tasks'>[]> {
  return await ctx.db
    .query('tasks')
    .withIndex('by_parent', (q) => q.eq('parentTaskId', parentId))
    .collect()
}

/**
 * The parent a subtask on `list` may have, or a refusal: a task of the same
 * Group (anything else is "not found", ADR-0009), on the same list, that is
 * not a subtask itself. A grocery list has items, not steps: the app draws no
 * subtasks there, so none may be made.
 */
export async function requireParentFor(
  ctx: QueryCtx,
  list: Doc<'taskLists'>,
  parentId: Id<'tasks'>,
): Promise<Doc<'tasks'>> {
  const parent = await ctx.db.get(parentId)
  const parentList = parent ? await ctx.db.get(parent.listId) : null
  if (!parent || !parentList || parentList.groupId !== list.groupId) {
    throw new ConvexError(taskRefusal('not-found'))
  }
  if (parent.listId !== list._id) {
    throw new ConvexError(taskRefusal('subtask-list'))
  }
  const group = await ctx.db.get(list.groupId)
  if (group && isGroceryList(group, list)) {
    throw new ConvexError(taskRefusal('subtask-grocery'))
  }
  if (parent.parentTaskId) throw new ConvexError(taskRefusal('subtask-depth'))
  return parent
}

/** A task, checked or unchecked, with its reminder's send kept in step. */
async function setDone(
  ctx: MutationCtx,
  task: Doc<'tasks'>,
  groupId: Id<'groups'>,
  done: boolean,
) {
  await ctx.db.patch(task._id, { done, doneAt: done ? Date.now() : undefined })
  if (task.reminder) {
    await syncSend(ctx, { ...task, done }, groupId, task.reminder)
  }
}

/** "Complete all": every open subtask of the parent is checked too. */
export async function completeSubtasks(
  ctx: MutationCtx,
  parentId: Id<'tasks'>,
  groupId: Id<'groups'>,
): Promise<void> {
  for (const subtask of await subtasksOfTask(ctx, parentId)) {
    if (!subtask.done) await setDone(ctx, subtask, groupId, true)
  }
}

/**
 * A repeating parent moved on to its next occurrence: its checked subtasks
 * open again. Answers which were checked, for the completion's undo.
 */
export async function reopenSubtasks(
  ctx: MutationCtx,
  parentId: Id<'tasks'>,
  groupId: Id<'groups'>,
): Promise<Id<'tasks'>[]> {
  const reopened: Id<'tasks'>[] = []
  for (const subtask of await subtasksOfTask(ctx, parentId)) {
    if (!subtask.done) continue
    await setDone(ctx, subtask, groupId, false)
    reopened.push(subtask._id)
  }
  return reopened
}

/**
 * Undo of a completion that reopened subtasks: those still under the parent
 * and still open are checked again. One deleted or moved since stays as it is.
 */
export async function recheckSubtasks(
  ctx: MutationCtx,
  parentId: Id<'tasks'>,
  groupId: Id<'groups'>,
  ids: readonly Id<'tasks'>[],
): Promise<void> {
  for (const id of ids) {
    const subtask = await ctx.db.get(id)
    if (subtask && subtask.parentTaskId === parentId && !subtask.done) {
      await setDone(ctx, subtask, groupId, true)
    }
  }
}

/**
 * A repeating parent's due date moved `days` calendar days (back, when
 * negative): each dated subtask moves the same days, and its reminder keeps
 * its distance from the subtask's date (`moveReminder` for a subtask). An
 * undated subtask stays undated.
 *
 * `createdBefore` limits it to subtasks created before that `_creationTime`:
 * an undo passes its completion's, so it moves back only the subtasks that
 * completion could have moved, not one added since.
 */
export async function shiftSubtaskDates(
  ctx: MutationCtx,
  parentId: Id<'tasks'>,
  groupId: Id<'groups'>,
  days: number,
  { createdBefore }: { createdBefore?: number } = {},
): Promise<void> {
  if (!days) return
  for (const subtask of await subtasksOfTask(ctx, parentId)) {
    if (!subtask.dueDate) continue
    if (createdBefore !== undefined && subtask._creationTime >= createdBefore)
      continue
    const dueDate = addDays(subtask.dueDate, days)
    const reminder = shiftedReminder(subtask.reminder, subtask.dueDate, dueDate)
    await ctx.db.patch(subtask._id, {
      dueDate,
      ...(reminder !== subtask.reminder ? { reminder } : {}),
    })
    if (subtask.reminder) {
      await syncSend(
        ctx,
        { ...subtask, dueDate, reminder },
        groupId,
        subtask.reminder,
      )
    }
  }
}

/**
 * A parent is being deleted: its subtasks go with it, each with its queued
 * reminder and any history.
 */
export async function deleteSubtasks(
  ctx: MutationCtx,
  parentId: Id<'tasks'>,
): Promise<void> {
  for (const subtask of await subtasksOfTask(ctx, parentId)) {
    await cancelSend(ctx, subtask)
    for (const row of await ctx.db
      .query('taskCompletions')
      .withIndex('by_task', (q) => q.eq('taskId', subtask._id))
      .collect()) {
      await ctx.db.delete(row._id)
    }
    await ctx.db.delete(subtask._id)
  }
}
