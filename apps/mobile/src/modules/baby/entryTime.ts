/**
 * Moving the moment an entry is recorded at.
 *
 * An entry defaults to now, because most logging happens as it happens. But the
 * 3am feed gets written up at 7am, and a log that could only ever say "now"
 * would record the wrong time on exactly the entries a parent most wants to be
 * right. So the sheet's When row is editable, and this is the arithmetic behind
 * it — pure, so the awkward cases (a day step across a DST boundary, an hour
 * step across midnight) can be tested at a fixed instant.
 *
 * Everything works in **local time**, because a person logging a feed means
 * their own 3am. `Date`'s local getters and setters are the device's timezone,
 * which is the one the parent is standing in.
 */

/** The named parts of a moment, in local time. */
export interface TimeParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

export function partsOf(timestamp: number): TimeParts {
  const date = new Date(timestamp)
  return {
    year: date.getFullYear(),
    month: date.getMonth(),
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
  }
}

/** Seconds and milliseconds are dropped: nobody logs a feed to the second. */
export function fromParts(parts: TimeParts): number {
  return new Date(
    parts.year,
    parts.month,
    parts.day,
    parts.hour,
    parts.minute,
    0,
    0,
  ).getTime()
}

/**
 * Whole days, keeping the wall-clock time.
 *
 * Not `timestamp ± 86_400_000`: on the day a clock changes, that lands an hour
 * out, and "yesterday at 03:00" would become 02:00 or 04:00. Setting the date
 * component keeps 03:00 meaning 03:00.
 */
export function shiftDays(timestamp: number, days: number): number {
  const parts = partsOf(timestamp)
  return fromParts({ ...parts, day: parts.day + days })
}

/** Minutes, which may roll the hour and the date. */
export function shiftMinutes(timestamp: number, minutes: number): number {
  const parts = partsOf(timestamp)
  return fromParts({ ...parts, minute: parts.minute + minutes })
}

/** Hours, which may roll the date. */
export function shiftHours(timestamp: number, hours: number): number {
  const parts = partsOf(timestamp)
  return fromParts({ ...parts, hour: parts.hour + hours })
}

/**
 * Whether two moments fall on the same local day — what decides if the When row
 * shows a date at all, since "today" is the overwhelming case and printing it
 * on every entry is a word that never varies.
 */
export function isSameDay(a: number, b: number): boolean {
  const left = partsOf(a)
  const right = partsOf(b)
  return (
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day
  )
}

/** Whole local days between two moments — 0 today, 1 yesterday. */
export function daysApart(from: number, to: number): number {
  const a = new Date(from)
  const b = new Date(to)
  a.setHours(0, 0, 0, 0)
  b.setHours(0, 0, 0, 0)
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}
