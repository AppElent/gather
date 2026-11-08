/**
 * The native destinations Gather accepts from an old `/g/<slug>/…` link.
 *
 * The web does not have these addresses (ADR-0031), but links to them are
 * still in messages and bookmarks, and the phone keeps honouring the ones it
 * can. This map is deliberately strict: an unimplemented detail page is not
 * "close enough" to a tab root, because accepting it would make an invalid
 * link change the ambient Group. A supported link therefore always has an
 * exact equivalent in the native shell — and that equivalent is
 * `moduleDestination`'s, so a link and a tap on All open the same screen.
 */
import { MODULES, type ModuleId, moduleById } from '@gather/core/modules'
import type { Href } from 'expo-router'

import type { Id } from '../convex/api'
import { moduleDestination } from '../modules/moduleDestination'
import type { PendingGroupLink } from './pendingGroupLink'

/**
 * The segment the web used for a Module's index, where it was not the
 * Module's id. Every other Module was addressed by its id.
 */
const WEB_SEGMENT: Partial<Record<ModuleId, string>> = { 'baby-log': 'baby' }

/** The segment `/g/<slug>/<segment>` used for this Module's index. */
export function webSegmentOf(moduleId: ModuleId): string {
  return WEB_SEGMENT[moduleId] ?? moduleId
}

const MODULE_BY_WEB_SEGMENT = new Map<string, ModuleId>(
  MODULES.map((module) => [webSegmentOf(module.id), module.id]),
)

/**
 * Translate the part after `/g/<slug>` into a destination in the ambient
 * native shell. `null` means the link is not supported here and must leave
 * the current Group untouched.
 */
export function nativeDestinationForGroupLink(
  segments: readonly string[],
): Href | null {
  if (segments.length === 0) return '/home'

  const [first, second] = segments

  if (segments.length === 1) {
    if (first === 'all') return '/all'
    const moduleId = first ? MODULE_BY_WEB_SEGMENT.get(first) : undefined
    return moduleId ? moduleDestination(moduleId) : null
  }

  // `/g/<slug>/all/<moduleId>` is the only nested destination. Its Module
  // check means a mistyped segment cannot switch the current Group.
  if (first === 'all' && segments.length === 2 && second) {
    const module = moduleById(second)
    return module ? moduleDestination(module.id) : null
  }

  return null
}

/**
 * Where a `/g/<slug>` link opens: its Group and its screen, or `null` to
 * refuse it. The link names its Group by slug, which is what the web's address
 * carried; the app names Groups by id, so the slug is resolved against the
 * Member's own Groups here and nowhere else. A slug that is not one of theirs,
 * or a destination the phone does not have, is refused before the Group
 * changes.
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
