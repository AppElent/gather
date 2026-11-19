/**
 * Push notifications, as the rest of the backend calls them (APP-298).
 *
 * Three helpers, each run inside the caller's own mutation so a notification
 * is queued in the same transaction as the change that caused it:
 *
 * - `notify(ctx, userIds, payload)` sends now.
 * - `schedule(ctx, userId, at, payload, dedupeKey)` sends at `at` through the
 *   Convex scheduler. Scheduling a key again replaces the earlier send.
 * - `cancelScheduled(ctx, userId, dedupeKey)` withdraws it.
 *
 * ## Checked when it sends
 *
 * Nothing about whether a person *wants* a notification is decided when it is
 * queued. When it goes out, `queueDelivery` reads the person's switches, their
 * membership of the payload's Group and its mute, and the record itself; any
 * of them saying no sends nothing. So a switch turned off, a Group muted or
 * left, or a task deleted after a reminder was set all silence it, without
 * the code that set the reminder having to know.
 *
 * ## One record, one send
 *
 * A scheduled send is one `scheduledNotifications` row per (person, key). A
 * new `schedule` for the key cancels the pending job and bumps the row's
 * `generation`; the job carries the generation it was scheduled with and sends
 * only when the row still has it. A job that had already started when it was
 * replaced therefore does nothing, and a cancelled key has no row to match.
 */

import { fmt } from '@gather/core/i18n'
import { en, nl } from '@gather/core/messages'
import {
  assignmentBody,
  mayNotify,
  type NotificationKind,
  notificationPath,
} from '@gather/core/notifications'
import { TASK_REMINDER_CATEGORY } from '@gather/core/task-reminders'
import type { Infer } from 'convex/values'
import { internal } from '../_generated/api'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import type { notificationPayloadValidator } from './notificationFields'

export type NotificationPayload = Infer<typeof notificationPayloadValidator>

/** Longest `dedupeKey` a caller may use; keys are ids and short prefixes. */
export const MAX_DEDUPE_KEY = 200

/** How many people one `notify` may reach: a Group-sized audience. */
export const MAX_RECIPIENTS = 100

/** One Expo push message, as `sendPush` posts it. */
export interface PushMessage {
  to: string
  title: string
  body: string
  data: { url: string }
  sound: 'default'
  /** The iOS category, for a notification with actions (a task's Done). */
  categoryId?: string
}

const MESSAGES = { en, nl } as const

/**
 * The record behind a payload, when it still exists in the payload's Group:
 * its title and the Group it lives in. Null means there is nothing to tell.
 */
async function recordOf(
  ctx: QueryCtx,
  payload: NotificationPayload,
): Promise<{
  title: string
  group: Doc<'groups'>
  task?: Doc<'tasks'>
} | null> {
  let title: string
  let groupId: Id<'groups'>
  let task: Doc<'tasks'> | undefined
  if (payload.target.type === 'task') {
    const found = await ctx.db.get(payload.target.id)
    if (!found) return null
    // A reminder for a task already done has nothing left to remind of.
    if (found.done && payload.kind === 'taskReminder') return null
    const list = await ctx.db.get(found.listId)
    if (!list) return null
    task = found
    title = found.title
    groupId = list.groupId
  } else {
    const event = await ctx.db.get(payload.target.id)
    if (!event) return null
    const calendar = await ctx.db.get(event.calendarId)
    if (!calendar) return null
    title = event.title
    groupId = calendar.groupId
  }
  if (groupId !== payload.groupId) return null
  const group = await ctx.db.get(groupId)
  return group ? { title, group, task } : null
}

/**
 * Whether this person may be sent this payload now: their account is live,
 * they are a Member of its Group and have not muted it, and their switch for
 * its kind is on.
 */
export async function mayDeliver(
  ctx: QueryCtx,
  userId: Id<'users'>,
  payload: NotificationPayload,
): Promise<boolean> {
  const user = await ctx.db.get(userId)
  if (!user || user.deletedAt) return false
  const memberships = await ctx.db
    .query('memberships')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .collect()
  const membership = memberships.find((m) => m.groupId === payload.groupId)
  if (!membership) return false
  return mayNotify(
    payload.kind,
    user.notificationSwitches,
    membership.notificationsMuted,
  )
}

function bodyOf(
  kind: NotificationKind,
  locale: keyof typeof MESSAGES,
  groupName: string,
): string {
  return fmt(MESSAGES[locale].notifications.push[kind], { group: groupName })
}

/**
 * Title and body of one message. A task someone gave you says who and what
 * (APP-302): the Group's name over "{name} gave you a task: {title}, {date}".
 * Everything else is the record's title over its kind and Group.
 */
function messageOf(
  payload: NotificationPayload,
  locale: keyof typeof MESSAGES,
  record: { title: string; group: Doc<'groups'>; task?: Doc<'tasks'> },
  giverName: string | null,
): { title: string; body: string } {
  if (payload.kind === 'taskAssignment' && record.task) {
    return {
      title: record.group.name,
      body: assignmentBody(
        MESSAGES[locale].notifications,
        record.task,
        giverName,
      ),
    }
  }
  return {
    title: record.title,
    body: bodyOf(payload.kind, locale, record.group.name),
  }
}

/** The name of whoever gave this task, while their account is live. */
async function giverOf(
  ctx: QueryCtx,
  task: Doc<'tasks'> | undefined,
): Promise<string | null> {
  if (!task?.assignmentNotice) return null
  const giver = await ctx.db.get(task.assignmentNotice.by)
  return giver && !giver.deletedAt ? giver.name : null
}

/**
 * Check everything and, if it all says yes, hand this person's messages to
 * `sendPush`. One message per registered phone, each in that phone's Language.
 */
export async function queueDelivery(
  ctx: MutationCtx,
  userId: Id<'users'>,
  payload: NotificationPayload,
): Promise<number> {
  if (!(await mayDeliver(ctx, userId, payload))) return 0
  const record = await recordOf(ctx, payload)
  if (!record) return 0
  const devices = await ctx.db
    .query('pushDevices')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .collect()
  if (devices.length === 0) return 0
  const url = notificationPath(record.group.slug, payload.target)
  const giverName = await giverOf(ctx, record.task)
  const messages: PushMessage[] = devices.map((device) => ({
    to: device.token,
    ...messageOf(payload, device.locale, record, giverName),
    data: { url },
    sound: 'default',
    ...(payload.kind === 'taskReminder'
      ? { categoryId: TASK_REMINDER_CATEGORY }
      : {}),
  }))
  await ctx.scheduler.runAfter(0, internal.notifications.sendPush, {
    messages,
  })
  return messages.length
}

/** Send a payload to each of these people now, subject to `queueDelivery`. */
export async function notify(
  ctx: MutationCtx,
  userIds: readonly Id<'users'>[],
  payload: NotificationPayload,
): Promise<void> {
  const unique = [...new Set(userIds)]
  if (unique.length > MAX_RECIPIENTS)
    throw new Error(`notify: at most ${MAX_RECIPIENTS} recipients`)
  for (const userId of unique) await queueDelivery(ctx, userId, payload)
}

function checkKey(dedupeKey: string) {
  if (!dedupeKey || dedupeKey.length > MAX_DEDUPE_KEY)
    throw new Error('notifications: dedupeKey must be 1–200 characters')
}

async function rowsFor(
  ctx: QueryCtx,
  userId: Id<'users'>,
  dedupeKey: string,
) {
  return await ctx.db
    .query('scheduledNotifications')
    .withIndex('by_user_and_key', (q) =>
      q.eq('userId', userId).eq('dedupeKey', dedupeKey),
    )
    .collect()
}

/** Cancel a row's job if it has not started; the generation covers the rest. */
async function cancelJob(
  ctx: MutationCtx,
  jobId: Id<'_scheduled_functions'> | undefined,
) {
  if (!jobId) return
  const job = await ctx.db.system.get(jobId)
  if (job?.state.kind === 'pending') await ctx.scheduler.cancel(jobId)
}

/**
 * Send a payload to one person at `at` (ms since the epoch; a past time sends
 * now). The key names what the notification is about, for example
 * `task:<id>:reminder`: scheduling the same key again replaces the earlier
 * send rather than adding a second one.
 */
export async function schedule(
  ctx: MutationCtx,
  userId: Id<'users'>,
  at: number,
  payload: NotificationPayload,
  dedupeKey: string,
): Promise<void> {
  checkKey(dedupeKey)
  const [row, ...extra] = await rowsFor(ctx, userId, dedupeKey)
  // A second row for one key exists only after two accounts were merged
  // (`maintenance.mergeUserInto`); fold them back into one.
  for (const stale of extra) {
    await cancelJob(ctx, stale.jobId)
    await ctx.db.delete(stale._id)
  }

  if (row) {
    await cancelJob(ctx, row.jobId)
    const generation = row.generation + 1
    const jobId = await ctx.scheduler.runAt(
      at,
      internal.notifications.fireScheduled,
      { rowId: row._id, generation },
    )
    await ctx.db.patch(row._id, { at, payload, jobId, generation })
    return
  }

  const rowId = await ctx.db.insert('scheduledNotifications', {
    userId,
    dedupeKey,
    at,
    payload,
    // Set below, in this transaction: the job needs the row's id.
    generation: 0,
  })
  const jobId = await ctx.scheduler.runAt(
    at,
    internal.notifications.fireScheduled,
    { rowId, generation: 0 },
  )
  await ctx.db.patch(rowId, { jobId })
}

/** Withdraw a scheduled send. A key with nothing scheduled is not an error. */
export async function cancelScheduled(
  ctx: MutationCtx,
  userId: Id<'users'>,
  dedupeKey: string,
): Promise<void> {
  checkKey(dedupeKey)
  for (const row of await rowsFor(ctx, userId, dedupeKey)) {
    await cancelJob(ctx, row.jobId)
    await ctx.db.delete(row._id)
  }
}

/**
 * The scheduled job: send when the row is still the one it was scheduled for,
 * then forget the row.
 */
export async function fireScheduled(
  ctx: MutationCtx,
  rowId: Id<'scheduledNotifications'>,
  generation: number,
): Promise<number> {
  const row = await ctx.db.get(rowId)
  if (!row || row.generation !== generation) return 0
  for (const other of await rowsFor(ctx, row.userId, row.dedupeKey)) {
    if (other._id === row._id) continue
    await cancelJob(ctx, other.jobId)
    await ctx.db.delete(other._id)
  }
  await ctx.db.delete(row._id)
  return await queueDelivery(ctx, row.userId, row.payload)
}

/**
 * Withdraw every send still queued about a Group, for a Group being deleted:
 * each would send nothing, but its row and job would outlive the Group until
 * their time.
 */
export async function cancelGroupSends(
  ctx: MutationCtx,
  groupId: Id<'groups'>,
) {
  const queued = await ctx.db
    .query('scheduledNotifications')
    .withIndex('by_group', (q) => q.eq('payload.groupId', groupId))
    .collect()
  for (const row of queued) {
    await cancelJob(ctx, row.jobId)
    await ctx.db.delete(row._id)
  }
}

/**
 * Everything push-related a person leaves behind, for account deletion: their
 * phones and their queued sends, whose jobs are cancelled with them.
 */
export async function deletePushData(ctx: MutationCtx, userId: Id<'users'>) {
  const devices = await ctx.db
    .query('pushDevices')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .collect()
  for (const device of devices) await ctx.db.delete(device._id)
  const queued = await ctx.db
    .query('scheduledNotifications')
    .withIndex('by_user_and_key', (q) => q.eq('userId', userId))
    .collect()
  for (const row of queued) {
    await cancelJob(ctx, row.jobId)
    await ctx.db.delete(row._id)
  }
}
