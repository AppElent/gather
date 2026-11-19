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
  isIsoDate,
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

/**
 * The completer's calendar day. A phone sends its own; anything else (an
 * installed app from before repeats, the web, an agent) gets the day in the
 * Netherlands. A sent day more than one day from UTC's is no device's today
 * and is ignored rather than trusted.
 */
export function completionDay(sent: string | undefined, now = Date.now()) {
  if (sent && isIsoDate(sent)) {
    const utc = new Date(now).toISOString().slice(0, 10)
    if (
      compareIsoDates(sent, addDays(utc, -1)) >= 0 &&
      compareIsoDates(sent, addDays(utc, 1)) <= 0
    ) {
      return sent
    }
  }
  return amsterdamIsoDate(now)
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
  await ctx.db.patch(task._id, { dueDate, done: false })
  const completionId = await ctx.db.insert('taskCompletions', {
    groupId,
    taskId: task._id,
    completedBy: userId,
    completedAt: Date.now(),
    completedOn: today,
    previousDueDate: task.dueDate,
    nextDueDate: dueDate,
  })
  return { completionId, dueDate }
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
