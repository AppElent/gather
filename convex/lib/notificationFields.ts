/**
 * The validators behind push notifications (APP-298), apart from the code that
 * sends them so the schema can import them without importing the scheduler.
 */
import { v } from 'convex/values'

export const notificationKindValidator = v.union(
  v.literal('taskReminder'),
  v.literal('taskAssignment'),
  v.literal('eventReminder'),
  v.literal('eventAssignment'),
)

/** The record a notification opens, by id; its title is read when it sends. */
export const notificationTargetValidator = v.union(
  v.object({ type: v.literal('task'), id: v.id('tasks') }),
  v.object({ type: v.literal('event'), id: v.id('calendarEvents') }),
)

/**
 * What a caller asks to send. It names the record rather than copying it, so
 * a send reads the record as it is then: renamed, moved or deleted.
 */
export const notificationPayloadValidator = v.object({
  kind: notificationKindValidator,
  groupId: v.id('groups'),
  target: notificationTargetValidator,
})

/** A person's switches; absent means on (`resolveSwitches` in core). */
export const notificationSwitchesValidator = v.object({
  taskReminders: v.optional(v.boolean()),
  taskAssignments: v.optional(v.boolean()),
  eventReminders: v.optional(v.boolean()),
  eventAssignments: v.optional(v.boolean()),
})

export const pushPlatformValidator = v.union(
  v.literal('ios'),
  v.literal('android'),
)

export const pushLocaleValidator = v.union(v.literal('en'), v.literal('nl'))
