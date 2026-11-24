/**
 * Completing a repeating task, on the server (APP-303).
 *
 * The rules are `@gather/core/task-repeat`'s; this file applies them to a row:
 * the due date moves on, the task stays open, and a `taskCompletions` row
 * records who completed it and from which date, so the completion can be
 * undone. Every path that completes a task goes through `completeOccurrence`,
 * including `toggleDone` from an installed app that knows nothing of repeats.
 */
import {
  addDays,
  amsterdamIsoDate,
  compareIsoDates,
  daysBetween,
  isIsoDate,
  todayIn,
} from '@gather/core/civil-date'
import {
  firstScheduledDate,
  nextDueDate,
  normalizeRepeat,
  type TaskRepeat,
} from '@gather/core/task-repeat'
import { ConvexError } from 'convex/values'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { reopenSubtasks, shiftSubtaskDates } from './subtasks'
import { shiftedReminder, syncSend } from './taskReminders'

/**
 * The completer's calendar day. A phone sends its own; anything else (an
 * installed app from before repeats, the web, an agent) gets the Group's day,
 * or the one in the Netherlands when the Group has no zone. A sent day more
 * than one day from UTC's is nobody's today and is ignored.
 */
export function completionDay(
  sent: string | undefined,
  timeZone?: string,
  now = Date.now(),
) {
  if (sent && isIsoDate(sent)) {
    const utc = new Date(now).toISOString().slice(0, 10)
    if (
      compareIsoDates(sent, addDays(utc, -1)) >= 0 &&
      compareIsoDates(sent, addDays(utc, 1)) <= 0
    ) {
      return sent
    }
  }
  return timeZone === undefined ? amsterdamIsoDate(now) : todayIn(timeZone, now)
}

/** A rule as stored, anchored on `anchor`, or a refusal. */
export function checkedRepeat(rule: TaskRepeat, anchor: string): TaskRepeat {
  const normalized = normalizeRepeat(rule, anchor)
  if (!normalized) throw new ConvexError('That is not a repeat')
  return normalized
}

/**
 * The due date a task gets when a fixed rule is set on it without one: the
 * first scheduled day from today. An after-done rule needs no date until the
 * task is first completed.
 */
export function firstDueDate(
  rule: TaskRepeat,
  dueDate: string | undefined,
  today: string,
): string | undefined {
  if (dueDate || rule.mode !== 'fixed') return dueDate
  return firstScheduledDate(rule, today, today)
}

export interface Completion {
  completionId: Id<'taskCompletions'>
  dueDate: string
}

/**
 * Complete the open occurrence of a repeating task: move its due date to the
 * next one and record the completion. The task stays open.
 *
 * `occurrence` is the due date the caller saw (null for none). When the task
 * has moved on since, this completion already happened, so a retry answers
 * `null` instead of skipping a second date.
 *
 * A reminder (APP-305) moves with the due date, the same days on, so it is
 * about the next occurrence: completing early withdraws the one queued for
 * the occurrence just done.
 *
 * Its checked subtasks open again for the next occurrence (APP-304); the
 * completion keeps which, so undoing it checks them again. Its dated subtasks
 * move as many days as it did (APP-451); undo moves them back the same days,
 * from the completion's two dates.
 */
export async function completeOccurrence(
  ctx: MutationCtx,
  {
    task,
    groupId,
    userId,
    today,
    occurrence,
  }: {
    task: Doc<'tasks'> & { repeat: TaskRepeat }
    groupId: Id<'groups'>
    userId: Id<'users'>
    today: string
    occurrence?: string | null
  },
): Promise<Completion | null> {
  if (occurrence !== undefined && (occurrence ?? undefined) !== task.dueDate) {
    return null
  }
  const dueDate = nextDueDate(task.repeat, { dueDate: task.dueDate, today })
  // `doneAt` goes with `done`: an open task carries no check stamp (APP-516).
  await ctx.db.patch(task._id, { dueDate, done: false, doneAt: undefined })
  await moveReminder(ctx, task, groupId, dueDate)
  const reopened = await reopenSubtasks(ctx, task._id, groupId)
  await shiftSubtaskDates(ctx, task._id, groupId, movedDays(task.dueDate, dueDate))
  const completionId = await ctx.db.insert('taskCompletions', {
    groupId,
    taskId: task._id,
    completedBy: userId,
    completedAt: Date.now(),
    completedOn: today,
    previousDueDate: task.dueDate,
    nextDueDate: dueDate,
    ...(reopened.length ? { reopenedSubtaskIds: reopened } : {}),
  })
  return { completionId, dueDate }
}

/**
 * How many calendar days a due date moved: none when either end has no date
 * (an after-done task completed for the first time), as with a reminder.
 */
export function movedDays(
  from: string | undefined,
  to: string | undefined,
): number {
  return from && to ? daysBetween(from, to) : 0
}

/**
 * Keep a task's reminder at the same distance from its due date after the
 * date moved to `dueDate`, and queue or withdraw its send to match. Undo
 * moves it back the same way.
 */
export async function moveReminder(
  ctx: MutationCtx,
  task: Doc<'tasks'>,
  groupId: Id<'groups'>,
  dueDate: string | undefined,
): Promise<void> {
  if (!task.reminder) return
  const reminder = shiftedReminder(task.reminder, task.dueDate, dueDate)
  if (reminder !== task.reminder) await ctx.db.patch(task._id, { reminder })
  await syncSend(
    ctx,
    { ...task, reminder, dueDate, done: false },
    groupId,
    task.reminder,
  )
}

export function isRepeating(
  task: Doc<'tasks'>,
): task is Doc<'tasks'> & { repeat: TaskRepeat } {
  return task.repeat !== undefined
}

/** A task's completions, newest first. */
export async function completionsOf(ctx: MutationCtx, taskId: Id<'tasks'>) {
  return await ctx.db
    .query('taskCompletions')
    .withIndex('by_task', (q) => q.eq('taskId', taskId))
    .order('desc')
    .collect()
}

/** Delete a task's history: with the task, or with its list. */
export async function purgeCompletionsOfTask(
  ctx: MutationCtx,
  taskId: Id<'tasks'>,
) {
  for (const row of await completionsOf(ctx, taskId)) {
    await ctx.db.delete(row._id)
  }
}
