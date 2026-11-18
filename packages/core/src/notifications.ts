/**
 * Push notifications as the server and the phone both see them (APP-298).
 *
 * Four kinds, two Modules by two reasons. A person's switches are personal
 * defaults that hold in every Group; a per-Group mute sits on top of them.
 * An absent switch is on, so somebody who never opened the screen gets the
 * notifications the product promises.
 *
 * A notification names its record, never carries a copy of it: the server
 * reads the task or event when it sends, so a renamed record sends its new
 * title and a deleted one sends nothing. The tap target is a `/g/<slug>/…`
 * address the phone already resolves for links (`shell/groupLink.ts`), so a
 * tap and a link open the same screen in the same Group.
 *
 * Dependency-free on purpose (ADR-0016).
 */

export const NOTIFICATION_KINDS = [
  'taskReminder',
  'taskAssignment',
  'eventReminder',
  'eventAssignment',
] as const
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number]

/** The personal switch each kind answers to. */
export const NOTIFICATION_SWITCHES = [
  'taskReminders',
  'taskAssignments',
  'eventReminders',
  'eventAssignments',
] as const
export type NotificationSwitch = (typeof NOTIFICATION_SWITCHES)[number]

export const SWITCH_OF_KIND = {
  taskReminder: 'taskReminders',
  taskAssignment: 'taskAssignments',
  eventReminder: 'eventReminders',
  eventAssignment: 'eventAssignments',
} as const satisfies Record<NotificationKind, NotificationSwitch>

/** The stored switches: each one optional, absent meaning on. */
export type NotificationSwitches = Partial<Record<NotificationSwitch, boolean>>

/** Every switch resolved, with the default (on) filled in. */
export function resolveSwitches(
  stored: NotificationSwitches | undefined,
): Record<NotificationSwitch, boolean> {
  return {
    taskReminders: stored?.taskReminders ?? true,
    taskAssignments: stored?.taskAssignments ?? true,
    eventReminders: stored?.eventReminders ?? true,
    eventAssignments: stored?.eventAssignments ?? true,
  }
}

/**
 * Whether a kind may be sent to this person in this Group: their switch for
 * it is on and they have not muted the Group. Checked when the notification
 * is sent, not when it is queued, so a switch turned off after a reminder was
 * set still silences it.
 */
export function mayNotify(
  kind: NotificationKind,
  switches: NotificationSwitches | undefined,
  groupMuted: boolean | undefined,
): boolean {
  if (groupMuted) return false
  return resolveSwitches(switches)[SWITCH_OF_KIND[kind]]
}

/** The record a notification opens. */
export type NotificationTarget =
  | { type: 'task'; id: string }
  | { type: 'event'; id: string }

/** Convex ids, and nothing a path segment could be confused by. */
const RECORD_ID = /^[a-z0-9]{1,64}$/i

/**
 * The address a tap opens: the Group's slug and the record's native screen,
 * in the `/g/<slug>/…` form `shell/groupLink.ts` resolves.
 */
export function notificationPath(
  groupSlug: string,
  target: NotificationTarget,
): string {
  const slug = encodeURIComponent(groupSlug)
  return target.type === 'task'
    ? `/g/${slug}/tasks/task/${target.id}`
    : `/g/${slug}/calendar/${target.id}`
}

/**
 * The record segments of a `/g/<slug>/…` address, or null when they name
 * none. The inverse of `notificationPath` past the slug.
 */
export function recordOfSegments(
  segments: readonly string[],
): NotificationTarget | null {
  const [first, second, third] = segments
  if (
    segments.length === 3 &&
    first === 'tasks' &&
    second === 'task' &&
    third &&
    RECORD_ID.test(third)
  )
    return { type: 'task', id: third }
  if (
    segments.length === 2 &&
    first === 'calendar' &&
    second &&
    RECORD_ID.test(second)
  )
    return { type: 'event', id: second }
  return null
}

/**
 * The `/g/<slug>/…` path in a notification's data, split into its Group and
 * segments, or null when the data carries none. The phone trusts nothing in
 * a notification beyond this shape: the handoff validates the slug against
 * the person's own Groups before anything changes.
 */
export function notificationLink(
  data: unknown,
): { groupSlug: string; segments: string[] } | null {
  if (!data || typeof data !== 'object') return null
  const url = (data as { url?: unknown }).url
  if (typeof url !== 'string' || url.length > 300) return null
  const parts = url.split('/')
  // ['', 'g', slug, ...segments]
  if (parts[0] !== '' || parts[1] !== 'g' || !parts[2]) return null
  const segments = parts.slice(3)
  if (!recordOfSegments(segments)) return null
  let groupSlug: string
  try {
    groupSlug = decodeURIComponent(parts[2])
  } catch {
    return null
  }
  return { groupSlug, segments }
}

/** An Expo push token as Expo issues it. */
const EXPO_PUSH_TOKEN = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{1,200}\]$/

export function isExpoPushToken(value: string): boolean {
  return EXPO_PUSH_TOKEN.test(value)
}
