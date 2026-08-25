/**
 * The one-line summaries the lists show, in the reader's words.
 *
 * Thin wrappers over `@gather/core/tastings`, and thin on purpose: the *rule*
 * for which facts make a row's subtitle is shared with the web and lives in
 * core, and what lives here is only the binding of that rule to the phone's
 * message tree.
 */
import type { TastingAttributeValue, TastingKind } from '@gather/core/tastings'
import { tastingFactsLine } from '@gather/core/tastings'
import type { Messages } from '../../i18n'
import { fmt, plural } from '../../i18n'
import { type TastingWords, termResolver } from './words'

/** "Cow · France · Hard" — a subject's facts, short enough for one line. */
export function subjectFacts(
  t: TastingWords,
  kind: TastingKind,
  attributes: Record<string, TastingAttributeValue>,
): string {
  return tastingFactsLine(
    kind,
    attributes,
    termResolver(t),
    (unit) => t.units[unit],
  )
}

/** "6 entries · 14 tastings" — what the index says it is holding. */
export function indexSummary(
  t: Messages,
  locale: string,
  subjects: number,
  tastings: number,
): string {
  return fmt(t.tastings.index.summary, {
    subjects: plural(locale, subjects, t.tastings.index.subjectCount),
    tastings: plural(locale, tastings, t.tastings.index.tastingCount),
  })
}

/** "3 tastings" — the count under a row's average, never shown without it. */
export function tastingCount(
  t: Messages,
  locale: string,
  count: number,
): string {
  return plural(locale, count, t.tastings.index.tastingCount)
}
