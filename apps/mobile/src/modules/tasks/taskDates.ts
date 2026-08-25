/**
 * The date arithmetic the Tasks taskActions needs, with no React in it.
 *
 * A due date is a **calendar day**, not a moment: the schema stores
 * `YYYY-MM-DD` and nobody means "23:59:59 in whichever timezone the server is
 * in". So everything here works on that string and on the phone's local
 * calendar, and the one thing it never does is `new Date('2026-08-22')` â€”
 * which JavaScript parses as midnight *UTC* and which is therefore the
 * previous day for anybody west of Greenwich. `parseDay` exists to make that
 * mistake impossible to make twice.
 *
 * Separated from the screens for the usual reason: a component cannot be asked
 * what it thinks "this weekend" is, and this can.
 */

/** A local `Date` at midnight on the day the `YYYY-MM-DD` string names. */
export function parseDay(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/** The `YYYY-MM-DD` for a local date. */
export function toIso(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function addDays(iso: string, days: number): string {
  const date = parseDay(iso)
  date.setDate(date.getDate() + days)
  return toIso(date)
}

/**
 * The coming Saturday â€” and today, if today *is* Saturday.
 *
 * Sunday counts as still being the weekend rather than as six days early: a
 * person tapping "This weekend" on a Sunday means today, not next week.
 */
export function weekendFrom(iso: string): string {
  const weekday = parseDay(iso).getDay()
  if (weekday === 0 || weekday === 6) return iso
  return addDays(iso, 6 - weekday)
}

/** Whole days from `from` to `to`, negative for a date already gone. */
export function daysBetween(from: string, to: string): number {
  const ms = parseDay(to).getTime() - parseDay(from).getTime()
  return Math.round(ms / 86_400_000)
}

export function isOverdue(due: string, today: string): boolean {
  return daysBetween(today, due) < 0
}

/**
 * How a due date reads on a row.
 *
 * Near dates get a word or a weekday, because "Thu" is something a person can
 * act on and "2026-08-27" is something they have to work out. Anything beyond
 * a week gets the actual date â€” by then the weekday has stopped being useful
 * and started being ambiguous about which Thursday it means.
 *
 * The locale is the *app's*, not the device's: this app has its own language
 * toggle, and a screen that mixes the two reads as a bug (ADR-0011).
 */
export function dueLabel(
  due: string,
  today: string,
  locale: string,
  words: { today: string; tomorrow: string },
): string {
  const offset = daysBetween(today, due)
  if (offset === 0) return words.today
  if (offset === 1) return words.tomorrow
  if (offset > 1 && offset < 7) {
    return parseDay(due).toLocaleDateString(locale, { weekday: 'short' })
  }
  return parseDay(due).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
  })
}

export interface MonthGrid {
  /** Midnight on the first of the month, for the header's own formatting. */
  first: Date
  /** Six rows of seven, `null` where the cell belongs to another month. */
  weeks: (string | null)[][]
}

/**
 * A month as the calendar draws it, Monday first.
 *
 * Monday because both of Gather's languages start their week there, and
 * because the weekend being two adjacent cells at the end is the whole reason
 * a person can find "this Saturday" without reading the letters.
 *
 * Always six rows. A grid that is five rows in one month and six in the next
 * makes the sheet jump when you page through it, and the empty row costs
 * nothing.
 */
export function monthGrid(year: number, month: number): MonthGrid {
  const first = new Date(year, month, 1)
  // getDay() is Sunday-first; shift so Monday is 0.
  const lead = (first.getDay() + 6) % 7
  const weeks: (string | null)[][] = []
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  let day = 1 - lead
  for (let week = 0; week < 6; week++) {
    const row: (string | null)[] = []
    for (let column = 0; column < 7; column++, day++) {
      row.push(
        day >= 1 && day <= daysInMonth
          ? toIso(new Date(year, month, day))
          : null,
      )
    }
    weeks.push(row)
  }

  return { first, weeks }
}

/** The month a calendar should open on for a task: its due date, or this one. */
export function monthOf(iso: string): { year: number; month: number } {
  const date = parseDay(iso)
  return { year: date.getFullYear(), month: date.getMonth() }
}

/** One month forward or back, without a day-of-month to overflow. */
export function shiftMonth(
  current: { year: number; month: number },
  by: 1 | -1,
): { year: number; month: number } {
  const date = new Date(current.year, current.month + by, 1)
  return { year: date.getFullYear(), month: date.getMonth() }
}
