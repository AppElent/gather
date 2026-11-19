/**
 * Keeping a task's reminder and its scheduled send in step (APP-305).
 *
 * The reminder is a field on the task (`tasks.reminder`); the send is a
 * `scheduledNotifications` row under `taskReminderKey(task)`, one per task.
 * Every write that changes what the reminder means ends by calling `syncSend`
 * with the task as it now is, so there is one rule for when it is queued:
 * the task is open, has a reminder, and its moment is still ahead. Anything
 * else withdraws it.
 *
 * Whether the person still wants it — their switch, the Group's mute, still
 * being a Member — is checked when it sends (`lib/notifications.ts`), not
 * here.
 */

import {
  clockMoment,
  isReminderClock,
  type ReminderClock,
  shiftClock,
  taskReminderKey,
} from '@gather/core/task-reminders'
import { ConvexError } from 'convex/values'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { cancelScheduled, schedule } from './notifications'

export type TaskReminder = NonNullable<Doc<'tasks'>['reminder']>

/**
 * How far in the past a new reminder may be and still send, at once: the
 * minute the person was looking at when they pressed Save.
 */
export const REMINDER_SLACK_MS = 60_000

/** The refusals `tasks.setReminder` throws. */
export const INVALID_REMINDER = 'That is not a reminder time'
export const REMINDER_PASSED = 'That time has passed'

/** A clock from a client, checked: a real date and time in a known zone. */
export function checkedClock(clock: ReminderClock): ReminderClock {
  if (!isReminderClock(clock)) throw new ConvexError(INVALID_REMINDER)
  return { date: clock.date, time: clock.time, timeZone: clock.timeZone }
}

/** The reminder after the due date moved: the same distance from it. */
export function shiftedReminder(
  reminder: TaskReminder | undefined,
  fromDue: string | undefined,
  toDue: string | undefined,
): TaskReminder | undefined {
  return reminder ? shiftClock(reminder, fromDue, toDue) : undefined
}

/**
 * Queue or withdraw the send for a task as it now is. `previous` is the
 * reminder before this write, so a reminder handed to somebody else stops
 * going to the person it went to.
 *
 * A moment already gone sends nothing — a due date moved into the past does
 * not fire a stale reminder — except with `late`, for a reminder just set
 * for the minute the person was looking at: that one sends now.
 */
export async function syncSend(
  ctx: MutationCtx,
  task: Doc<'tasks'>,
  groupId: Id<'groups'>,
  previous: TaskReminder | undefined,
  { late = false }: { late?: boolean } = {},
): Promise<void> {
  const key = taskReminderKey(task._id)
  const reminder = task.reminder
  if (previous && previous.userId !== reminder?.userId)
    await cancelScheduled(ctx, previous.userId, key)
  if (!reminder) return
  const now = Date.now()
  const at = clockMoment(reminder)
  const due = at > now || (late && at >= now - REMINDER_SLACK_MS)
  if (task.done || !due) {
    await cancelScheduled(ctx, reminder.userId, key)
    return
  }
  await schedule(
    ctx,
    reminder.userId,
    Math.max(at, now),
    { kind: 'taskReminder', groupId, target: { type: 'task', id: task._id } },
    key,
  )
}

/** Withdraw a task's send, for a task about to be deleted. */
export async function cancelSend(ctx: MutationCtx, task: Doc<'tasks'>) {
  if (task.reminder)
    await cancelScheduled(ctx, task.reminder.userId, taskReminderKey(task._id))
}

/**
 * A departing Member's reminders in one Group go with them, sends included:
 * nothing would reach them there, and the task should not show a reminder
 * for somebody who is not in the household.
 */
export async function dropMemberReminders(
  ctx: MutationCtx,
  userId: Id<'users'>,
  groupId: Id<'groups'>,
) {
  const lists = await ctx.db
    .query('taskLists')
    .withIndex('by_group', (q) => q.eq('groupId', groupId))
    .collect()
  for (const list of lists) {
    const tasks = await ctx.db
      .query('tasks')
      .withIndex('by_list', (q) => q.eq('listId', list._id))
      .collect()
    for (const task of tasks) {
      if (task.reminder?.userId !== userId) continue
      await cancelSend(ctx, task)
      await ctx.db.patch(task._id, { reminder: undefined })
    }
  }
}
