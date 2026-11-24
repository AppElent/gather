import { daysBetween, localMidnight } from '@gather/core/civil-date'
import { fmt } from '@gather/core/i18n'

/**
 * How a date reads in a row's footnote (web-shell_final.md, "Lists"): words,
 * never digits — "vr 5 dec", "Fri, Dec 5" — and a date already past as
 * "Te laat · vr 20 nov", which the row draws in `danger` 600.
 *
 * The locale is the app's, not the browser's (ADR-0011): a page that mixes the
 * two reads as a bug.
 */
export interface RowDate {
  text: string
  overdue: boolean
}

/** The date alone, in words: weekday, day, short month. */
export function dateInWords(iso: string, locale: string): string {
  return localMidnight(iso)
    .toLocaleDateString(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
    .replace(/\./g, '')
}

/**
 * A due date on a row. `overdueTemplate` is `common.overdueOn`
 * ("Overdue · {date}"); `today` is the Group's local day.
 */
export function rowDate(
  iso: string,
  today: string,
  locale: string,
  overdueTemplate: string,
): RowDate {
  const date = dateInWords(iso, locale)
  const overdue = daysBetween(today, iso) < 0
  return { text: overdue ? fmt(overdueTemplate, { date }) : date, overdue }
}
