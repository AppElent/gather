/**
 * Calendar arithmetic in whole months, on the `YYYY-MM-DD` strings the rest of
 * the app stores dates as.
 *
 * Everything in Finances that has a date is either a month away from now (a
 * fixed rate ending, a goal's target) or a day somebody wrote down (a snapshot).
 * Neither needs a time zone, and involving one is how "18 months" becomes 17 on
 * the wrong side of midnight in the wrong country.
 */

/** Year, month and day out of a `YYYY-MM-DD` string. Invalid input gives null. */
export function parseIsoDate(
  iso: string,
): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return { year, month, day }
}

function toIso(year: number, month: number, day: number): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)}`
}

/** The last day of a month, so adding months to the 31st lands on a real date. */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function addMonths(iso: string, months: number): string {
  const parts = parseIsoDate(iso)
  if (!parts) return iso
  const shifted = parts.year * 12 + (parts.month - 1) + Math.trunc(months)
  const year = Math.floor(shifted / 12)
  const month = (shifted % 12) + 1
  return toIso(year, month, Math.min(parts.day, daysInMonth(year, month)))
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

/** Today, as the same `YYYY-MM-DD` everything else is written in. */
export function todayIso(now: Date = new Date()): string {
  return toIso(now.getFullYear(), now.getMonth() + 1, now.getDate())
}
