/**
 * Where a tapped push notification opens (APP-298).
 *
 * A notification names its Group by slug and its record by the segments of a
 * `/g/<slug>/…` path (`notificationPath` in core). That path is data, not a
 * route: the router no longer has `/g/…` (APP-81), and an old `gather://g/…`
 * link opens Home instead (`+native-intent.tsx`). Only a task or an event is
 * accepted, because those are the only records a notification opens, and each
 * has an exact native detail screen. Anything else is refused before the
 * current Group changes.
 */
import { recordOfSegments } from '@gather/core/notifications'
import type { Href } from 'expo-router'

import type { Id } from '../convex/api'
import type { PendingGroupLink } from './pendingGroupLink'

/**
 * The native detail screen for the record the segments name, or `null` when
 * they name none, which must leave the current Group untouched.
 */
export function nativeDestinationForGroupLink(
  segments: readonly string[],
): Href | null {
  const record = recordOfSegments(segments)
  if (record?.type === 'task')
    return {
      pathname: '/all/tasks/task/[taskId]',
      params: { taskId: record.id },
    }
  if (record?.type === 'event')
    return {
      pathname: '/all/calendar/[eventId]',
      params: { eventId: record.id },
    }
  return null
}

/**
 * Where a notification opens: its Group and its screen, or `null` to refuse
 * it. The app names Groups by id, so the slug is resolved against the
 * Member's own Groups here and nowhere else. A slug that is not one of theirs,
 * or a record the phone cannot open, is refused before the Group changes.
 */
export function groupLinkTarget(
  link: PendingGroupLink | null,
  groups: readonly { _id: Id<'groups'>; slug: string }[],
): { groupId: Id<'groups'>; href: Href } | null {
  const href = link ? nativeDestinationForGroupLink(link.segments) : null
  const target = link
    ? groups.find((candidate) => candidate.slug === link.groupSlug)
    : undefined
  if (!href || !target) return null
  return { groupId: target._id, href }
}
