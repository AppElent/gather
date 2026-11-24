/**
 * A task's reminder (APP-305): a moment somebody chose, never implied by a due
 * date alone (16 Sept).
 *
 * A reminder is stored as the wall clock its setter meant — a civil date, an
 * `HH:MM` time and the IANA time zone of the phone that set it — so "Saturday
 * at 9:00" stays 9:00 across a daylight-saving change, and the server can work
 * out the moment again when the due date moves. Moving the due date moves the
 * reminder by the same number of days; clearing or setting a due date leaves
 * it where it is.
 *
 * Dependency-free on purpose (ADR-0016): the server and the phone both read it.
 */

import { addDays, daysBetween, isIsoDate } from './civilDate'

/** The wall clock a reminder is set for. */
export interface ReminderClock {
  /** `YYYY-MM-DD` on the setter's calendar. */
  date: string
  /** `HH:MM`, 24-hour. */
  time: string
  /** The IANA zone the date and time are in, e.g. `Europe/Amsterdam`. */
  timeZone: string
}

/**
 * The shortcuts the Reminder sheet offers when the task has a due date: the
 * morning of the due day, and the evening before it.
 */
export const REMINDER_PRESETS = {
  dueDay: { daysBefore: 0, time: '09:00' },
  eveningBefore: { daysBefore: 1, time: '19:00' },
} as const
export type ReminderPreset = keyof typeof REMINDER_PRESETS

/** The dedupe key a task's reminder is scheduled under, one per task. */
export function taskReminderKey(taskId: string): string {
  return `task:${taskId}:reminder`
}

/** The iOS notification category that carries the Done action. */
export const TASK_REMINDER_CATEGORY = 'taskReminder'
/** The action on it that completes the task. */
export const TASK_DONE_ACTION = 'done'

const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/

export function isReminderTime(value: string): boolean {
  return CLOCK.test(value)
}

/** Whether the runtime knows this zone; an unknown one throws in `Intl`. */
export function isTimeZone(value: string): boolean {
  if (!value || value.length > 64) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
    return true
  } catch {
    return false
  }
}

/** A zone by its IANA name: `Intl` also takes an offset (`+01:00`), not one. */
export function isTimeZoneName(value: string): boolean {
  return !/^[+-]/.test(value) && isTimeZone(value)
}

export function isReminderClock(clock: ReminderClock): boolean {
  return (
    isIsoDate(clock.date) &&
    isReminderTime(clock.time) &&
    isTimeZone(clock.timeZone)
  )
}

/** A preset's wall clock for a task due on `dueDate`. */
export function presetClock(
  preset: ReminderPreset,
  dueDate: string,
  timeZone: string,
): ReminderClock {
  const { daysBefore, time } = REMINDER_PRESETS[preset]
  return { date: addDays(dueDate, -daysBefore), time, timeZone }
}

/** Which preset a clock is, for this due date; null for a custom moment. */
export function presetOf(
  clock: Pick<ReminderClock, 'date' | 'time'>,
  dueDate: string | undefined,
): ReminderPreset | null {
  if (!dueDate) return null
  for (const preset of Object.keys(REMINDER_PRESETS) as ReminderPreset[]) {
    const { daysBefore, time } = REMINDER_PRESETS[preset]
    if (clock.time === time && clock.date === addDays(dueDate, -daysBefore))
      return preset
  }
  return null
}

/**
 * The reminder after the due date moved from `from` to `to`: the same distance
 * from the due date, at the same time. Unchanged unless both dates are set.
 */
export function shiftClock<T extends ReminderClock>(
  clock: T,
  from: string | undefined,
  to: string | undefined,
): T {
  if (!from || !to || from === to) return clock
  return { ...clock, date: addDays(clock.date, daysBetween(from, to)) }
}

/** The offset of `timeZone` from UTC at `at`, in milliseconds. */
function zoneOffset(at: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(at))
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value)
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  )
  return asUtc - Math.floor(at / 1000) * 1000
}

/**
 * The moment a wall clock names, in ms since the epoch. A time that does not
 * exist (skipped by a daylight-saving change) lands just after the gap; one
 * that happens twice is one of its two moments.
 */
export function clockMoment(clock: ReminderClock): number {
  const [year, month, day] = clock.date.split('-').map(Number)
  const [hour, minute] = clock.time.split(':').map(Number)
  const wall = Date.UTC(
    year as number,
    (month as number) - 1,
    day as number,
    hour,
    minute,
  )
  const before = zoneOffset(wall, clock.timeZone)
  const first = wall - before
  const after = zoneOffset(first, clock.timeZone)
  if (after === before) return first
  const second = wall - after
  // In a gap neither guess reads back as the wall clock: take the later one,
  // which is the same minutes past the hour after the clocks moved.
  return zoneOffset(second, clock.timeZone) === after
    ? second
    : Math.max(first, second)
}

/** The wall clock in `timeZone` for a moment: what the phone's picker returns. */
export function momentClock(at: number, timeZone: string): ReminderClock {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(at))
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}`,
    timeZone,
  }
}
