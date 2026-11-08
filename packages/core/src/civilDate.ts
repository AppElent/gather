/**
 * Civil dates: a day on the calendar, written `YYYY-MM-DD`, with no moment and
 * no time zone attached.
 *
 * Due dates, event days, tastings, the diary and finance targets all store this
 * shape, because nobody means "23:59:59 in whichever timezone the server is in".
 * `new Date('2026-08-22')` parses as midnight *UTC*, and `toISOString()` writes
 * UTC back out: either one is the wrong day for somebody near midnight. So the
 * arithmetic below runs on UTC midnights it builds itself and never sees a local
 * timestamp, and only `localIsoDate` and `localMidnight` touch the local calendar.
 */

export interface CivilDateParts {
  year: number
  /** 1-12. */
  month: number
  day: number
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const DAY_MS = 86_400_000

/** The last day of a month (1-12). */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** Year, month and day of a real date; null for anything else, 31 Feb included. */
export function parseIsoDate(value: string): CivilDateParts | null {
  const match = ISO_DATE.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    return null
  }
  return { year, month, day }
}

export function isIsoDate(value: string): boolean {
  return parseIsoDate(value) !== null
}

function isoDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function utcMidnight(value: string): number {
  const parsed = parseIsoDate(value)
  return parsed ? Date.UTC(parsed.year, parsed.month - 1, parsed.day) : Number.NaN
}

/** The day it is at `at` on this device's calendar: today, by default. */
export function localIsoDate(at: Date | number = new Date()): string {
  const date = new Date(at)
  return isoDate(date.getFullYear(), date.getMonth() + 1, date.getDate())
}

/** Local midnight on the day named, for handing to a locale formatter. */
export function localMidnight(value: string): Date {
  const parsed = parseIsoDate(value)
  return parsed
    ? new Date(parsed.year, parsed.month - 1, parsed.day)
    : new Date(Number.NaN)
}

export function compareIsoDates(a: string, b: string): number {
  return utcMidnight(a) - utcMidnight(b)
}

/** Whole days from `from` to `to`, negative for a date already gone. */
export function daysBetween(from: string, to: string): number {
  return compareIsoDates(to, from) / DAY_MS
}

export function addDays(value: string, amount: number): string {
  const parsed = parseIsoDate(value)
  if (!parsed) return value
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day))
  date.setUTCDate(date.getUTCDate() + Math.trunc(amount))
  return isoDate(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
  )
}

/** Whole months, landing on a real day when the target month is shorter. */
export function addMonths(value: string, amount: number): string {
  const parsed = parseIsoDate(value)
  if (!parsed) return value
  const target = parsed.year * 12 + parsed.month - 1 + Math.trunc(amount)
  const year = Math.floor(target / 12)
  const month = (((target % 12) + 12) % 12) + 1
  return isoDate(year, month, Math.min(parsed.day, daysInMonth(year, month)))
}

/**
 * Whole months from `from` to `to`, never below zero.
 *
 * A part month counts: a target 40 days out is two months to save for, not one,
 * because the last contribution has to have somewhere to land.
 */
export function monthsUntil(from: string, to: string): number {
  const start = parseIsoDate(from)
  const end = parseIsoDate(to)
  if (!start || !end) return 0
  let months = (end.year - start.year) * 12 + (end.month - start.month)
  if (end.day > start.day) months += 1
  return Math.max(0, months)
}

export function monthStart(value: string): string {
  const parsed = parseIsoDate(value)
  return parsed ? isoDate(parsed.year, parsed.month, 1) : value
}

/** The Monday on or before a day. Both of Gather's languages start there. */
export function mondayStart(value: string): string {
  const parsed = parseIsoDate(value)
  if (!parsed) return value
  const weekday = new Date(
    Date.UTC(parsed.year, parsed.month - 1, parsed.day),
  ).getUTCDay()
  return addDays(value, -((weekday + 6) % 7))
}

/** The seven days of a day's Monday-first week. */
export function weekOf(value: string): string[] {
  const start = mondayStart(value)
  return Array.from({ length: 7 }, (_, index) => addDays(start, index))
}

/**
 * The month holding a day, as a calendar draws it: six Monday-first rows of
 * seven, `null` where a cell belongs to another month.
 *
 * Always six. A grid that is five rows in one month and six in the next makes a
 * sheet jump when you page through it, and the empty row costs nothing.
 */
export function monthGrid(value: string): (string | null)[][] {
  const first = monthStart(value)
  const parsed = parseIsoDate(first)
  if (!parsed) return []
  const start = mondayStart(first)
  const last = isoDate(
    parsed.year,
    parsed.month,
    daysInMonth(parsed.year, parsed.month),
  )
  const cells = Array.from({ length: 42 }, (_, index) => addDays(start, index))
  return Array.from({ length: 6 }, (_, row) =>
    cells
      .slice(row * 7, row * 7 + 7)
      .map((day) =>
        compareIsoDates(day, first) < 0 || compareIsoDates(day, last) > 0
          ? null
          : day,
      ),
  )
}

/** `HH:MM` for a count of minutes since midnight. */
export function minutesToClock(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}
