/**
 * How old a Child is, in words.
 *
 * Portable because both clients ask it and there must be one answer: a phone
 * and a browser disagreeing about whether a baby is 8 weeks or 2 months old is
 * the kind of split ADR-0016 exists to prevent. The words and the locale arrive
 * as arguments (ADR-0011's third rule), so the web's PDF export and a Node test
 * can both call it with no React tree.
 */
import {
  type CivilDateParts,
  daysBetween,
  parseIsoDate,
  todayIn,
} from './civilDate'
import { fmt, plural } from './i18n'
import type { Messages } from './messages'

/** Whole months between `birth` and `now` (0 if `now` is before `birth`). */
function monthsBetween(birth: CivilDateParts, now: CivilDateParts): number {
  let months = (now.year - birth.year) * 12 + (now.month - birth.month)
  if (now.day < birth.day) months--
  return Math.max(0, months)
}

/** Age as of `atMs` (defaults to now), e.g. "5 days old", "3 months old". */
export type AgeMessages = Messages['baby']['log']['child']['age']

/**
 * How old the child is, in the largest unit that still says something useful.
 *
 * The words and the locale come in as arguments: this is a plain function the
 * PDF export calls too, and English's one/other plural is not every language's
 * (ADR-0011). When `timeZone` is given (a Group's zone), "today" is read in
 * that zone rather than the device's.
 */
export function formatAge(
  birthDate: string,
  m: AgeMessages,
  locale: string,
  atMs: number = Date.now(),
  timeZone?: string,
): string {
  const birth = parseIsoDate(birthDate)
  const today = todayIn(timeZone, atMs)
  const now = parseIsoDate(today)
  if (!birth || !now) return plural(locale, 0, m.days)
  const days = Math.max(0, Math.floor(daysBetween(birthDate, today)))
  if (days < 14) return plural(locale, days, m.days)
  if (days < 60) return plural(locale, Math.floor(days / 7), m.weeks)
  const months = monthsBetween(birth, now)
  if (months < 24) return plural(locale, months, m.months)
  const years = Math.floor(months / 12)
  const remMonths = months % 12
  return remMonths === 0
    ? plural(locale, years, m.years)
    : fmt(m.yearsMonths, { years, months: remMonths })
}
