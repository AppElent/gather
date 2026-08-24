/**
 * How a Group's activity entry reads on the page.
 *
 * The server says what happened, to what, and who did it. Everything that
 * decides how that becomes a sentence, which Module it belongs to and where it
 * links lives here — on the client, because all three are client concepts. The
 * Module catalog in particular is one `convex/schema.ts` says out loud the
 * backend must not know, and a URL is one `groupPaths.ts` type-checks against
 * the route tree, which Convex cannot do.
 *
 * The words themselves come in as an argument rather than out of a hook: this
 * is a plain module over plain data, and it stays callable from a test without
 * a React tree around it (ADR-0011).
 */

import { fmt, plural } from '@gather/core/i18n'
import { moduleById, moduleText } from '@gather/core/modules'
import type { ActivityKind, GroupActivityEntry } from '../../convex/activity'
import type { NavMessages } from './appNavigation'

/**
 * Which Module in `MODULES` each kind of entry came out of.
 *
 * `tasting` has no honest answer here: Cheeses, Wines and Beers are three
 * Modules over one pair of tables, so the entry carries its own `moduleId` and
 * this is only what a `tasting` falls back to when it somehow does not.
 */
export const ACTIVITY_MODULE_ID: Record<ActivityKind, string> = {
  recipe: 'recipes',
  task: 'tasks',
  babyEvent: 'baby-log',
  tasting: 'cheeses',
}

/** The Module an entry belongs to — its own, where it names one. */
export function activityModuleId(
  entry: Pick<GroupActivityEntry, 'kind' | 'moduleId'>,
): string {
  return entry.moduleId ?? ACTIVITY_MODULE_ID[entry.kind]
}

/** The Module an entry belongs to, named as the rest of the app names it. */
export function activityModuleLabel(
  entry: Pick<GroupActivityEntry, 'kind' | 'moduleId'>,
  messages: NavMessages,
): string {
  const module = moduleById(activityModuleId(entry))
  return module ? moduleText(module, messages).label : ''
}

export function activityModuleIcon(
  entry: Pick<GroupActivityEntry, 'kind' | 'moduleId'>,
): string {
  return moduleById(activityModuleId(entry))?.icon ?? 'Circle'
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

/**
 * Which kinds take a connector is a fact about the data, not about English, so
 * it is settled here and the message tree only supplies words. A recipe entry
 * carries no context, so asking a translator for a connector to put in front of
 * one would be asking them to invent something.
 */
export function activityPhrase(
  kind: ActivityKind,
  messages: NavMessages,
): ActivityPhrase {
  const { verbs, connectors } = messages.shell.activity
  switch (kind) {
    case 'recipe':
      return { verb: verbs.recipe, connector: null }
    case 'task':
      return { verb: verbs.task, connector: connectors.task }
    case 'babyEvent':
      return { verb: verbs.babyEvent, connector: connectors.babyEvent }
    // The subject's own name is the title and the Module's name is already on
    // the row, so there is nothing for a connector to introduce.
    case 'tasting':
      return { verb: verbs.tasting, connector: null }
  }
}

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
 *
 * The day count needs no plural form: one day is "Yesterday", so the template
 * is only ever reached with two or more.
 */
export function formatActivityTime(
  at: number,
  messages: NavMessages,
  locale: string,
  now: number = Date.now(),
): string {
  const time = messages.shell.activity
  const elapsed = now - at
  if (elapsed < MINUTE) return time.justNow
  if (elapsed < HOUR) {
    return plural(locale, Math.floor(elapsed / MINUTE), time.minutesAgo)
  }
  if (elapsed < DAY) {
    return plural(locale, Math.floor(elapsed / HOUR), time.hoursAgo)
  }
  const days = Math.floor(elapsed / DAY)
  if (days === 1) return time.yesterday
  if (days < 7) return fmt(time.daysAgo, { count: days })
  return new Date(at).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
