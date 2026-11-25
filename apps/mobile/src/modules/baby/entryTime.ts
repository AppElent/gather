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

import { dayIn, daysBetween } from '@gather/core/civil-date'
import { clockMoment } from '@gather/core/task-reminders'
import { runtimeTimeZone } from '@gather/core/time-zones'

/** The named parts of a moment, in `timeZone` or local time. */
export interface TimeParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

const pad2 = (value: number) => String(value).padStart(2, '0')

export function partsOf(timestamp: number, timeZone?: string): TimeParts {
  const zone = timeZone ? (runtimeTimeZone(timeZone) ?? undefined) : undefined
  if (zone) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: zone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hourCycle: 'h23',
      }).formatToParts(timestamp)
      const get = (type: Intl.DateTimeFormatPartTypes) =>
        Number(parts.find((part) => part.type === type)?.value)
      const hour = get('hour')
      return {
        year: get('year'),
        month: get('month') - 1,
        day: get('day'),
        hour: hour === 24 ? 0 : hour,
        minute: get('minute'),
      }
    } catch {
      // Unknown zone: local clock below.
    }
  }
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
export function fromParts(parts: TimeParts, timeZone?: string): number {
  const zone = timeZone ? (runtimeTimeZone(timeZone) ?? undefined) : undefined
  if (zone) {
    const normalized = new Date(
      Date.UTC(parts.year, parts.month, parts.day, parts.hour, parts.minute),
    )
    const date = `${String(normalized.getUTCFullYear()).padStart(4, '0')}-${pad2(normalized.getUTCMonth() + 1)}-${pad2(normalized.getUTCDate())}`
    const time = `${pad2(normalized.getUTCHours())}:${pad2(normalized.getUTCMinutes())}`
    const moment = clockMoment({ date, time, timeZone: zone })
    if (moment !== null) return moment
  }
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
export function shiftDays(
  timestamp: number,
  days: number,
  timeZone?: string,
): number {
  const parts = partsOf(timestamp, timeZone)
  return fromParts({ ...parts, day: parts.day + days }, timeZone)
}

/** Minutes, which may roll the hour and the date. */
export function shiftMinutes(
  timestamp: number,
  minutes: number,
  timeZone?: string,
): number {
  const parts = partsOf(timestamp, timeZone)
  return fromParts({ ...parts, minute: parts.minute + minutes }, timeZone)
}

/** Hours, which may roll the date. */
export function shiftHours(
  timestamp: number,
  hours: number,
  timeZone?: string,
): number {
  const parts = partsOf(timestamp, timeZone)
  return fromParts({ ...parts, hour: parts.hour + hours }, timeZone)
}

/**
 * Whether two moments fall on the same day — what decides if the When row
 * shows a date at all, since "today" is the overwhelming case and printing it
 * on every entry is a word that never varies.
 */
export function isSameDay(a: number, b: number, timeZone?: string): boolean {
  const dayAt = dayIn(timeZone)
  return dayAt(a) === dayAt(b)
}

/** Whole calendar days between two moments — 0 today, -1 yesterday. */
export function daysApart(
  from: number,
  to: number,
  timeZone?: string,
): number {
  const dayAt = dayIn(timeZone)
  return Math.round(daysBetween(dayAt(from), dayAt(to)))
}
