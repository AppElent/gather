/**
 * How a Group's activity entry reads on the page.
 *
 * The server says what happened, to what, and who did it. Everything that
 * decides how that becomes a sentence, which Module it belongs to and where it
 * links lives here — on the client, because all three are client concepts. The
 * Module catalog in particular is one `convex/schema.ts` says out loud the
 * backend must not know, and a URL is one `groupPaths.ts` type-checks against
 * the route tree, which Convex cannot do.
 */

import type { ActivityKind } from '../../convex/activity'
import { moduleById } from './modules'

/** Which Module in `MODULES` each kind of entry came out of. */
export const ACTIVITY_MODULE_ID: Record<ActivityKind, string> = {
  recipe: 'recipes',
  task: 'tasks',
  babyEvent: 'baby-log',
}

/** The Module an entry belongs to, named as the rest of the app names it. */
export function activityModuleLabel(kind: ActivityKind): string {
  return moduleById(ACTIVITY_MODULE_ID[kind])?.label ?? ''
}

export function activityModuleIcon(kind: ActivityKind): string {
  return moduleById(ACTIVITY_MODULE_ID[kind])?.icon ?? 'Circle'
}

/**
 * The sentence around the title: what the person did, and how the entry's
 * context hangs off it — a task goes *to* a list, a log entry is *for* a child,
 * a recipe has nothing after it.
 */
export interface ActivityPhrase {
  verb: string
  connector: string | null
}

export const ACTIVITY_PHRASES: Record<ActivityKind, ActivityPhrase> = {
  recipe: { verb: 'added the recipe', connector: null },
  task: { verb: 'added the task', connector: 'to' },
  // No article: it has to read as well for "Growth" and "Sleep" as it does for
  // "Feeding", and eight event labels do not share one.
  babyEvent: { verb: 'logged', connector: 'for' },
}

/** What the stream calls somebody whose `users` row has since gone. */
export const UNKNOWN_ACTOR = 'Someone'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * When something happened, in the terms an activity stream is read in.
 *
 * Relative up to a week, because "yesterday" is the question being asked; an
 * absolute date after that, because "43 days ago" is not an answer anybody
 * wants. A time in the future — a clock skewed by a few seconds, most likely —
 * reads as just now rather than as a negative number of minutes.
 */
export function formatActivityTime(
  at: number,
  now: number = Date.now(),
): string {
  const elapsed = now - at
  if (elapsed < MINUTE) return 'Just now'
  if (elapsed < HOUR) {
    const minutes = Math.floor(elapsed / MINUTE)
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  }
  if (elapsed < DAY) {
    const hours = Math.floor(elapsed / HOUR)
    return `${hours} hour${hours === 1 ? '' : 's'} ago`
  }
  const days = Math.floor(elapsed / DAY)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return new Date(at).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
