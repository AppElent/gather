/**
 * A task's reminder as a device handles it (APP-305): the wall clock it is
 * set for, read off and written back to this device's own calendar.
 *
 * The server keeps the wall clock and the zone it was set in, and works out
 * the moment itself (`@gather/core/task-reminders`). A device only ever sets
 * a reminder for itself, so it reads its own zone and its own local fields and
 * needs no time-zone arithmetic of its own.
 */
import { localIsoDate } from './civilDate'
import { fmt } from './i18n'
import { dueLabel } from './taskDates'
import {
  presetClock,
  REMINDER_PRESETS,
  type ReminderClock,
  type ReminderPreset,
} from './taskReminders'
import { deviceTimeZone } from './timeZones'

const pad = (value: number) => String(value).padStart(2, '0')

/** The wall clock a picked `Date` shows on this device. */
export function clockOfDate(date: Date, timeZone = deviceTimeZone()): ReminderClock {
  return {
    date: localIsoDate(date),
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
    timeZone,
  }
}

/** A wall clock on this device's calendar as a `Date`, for the picker. */
export function dateOfClock(clock: Pick<ReminderClock, 'date' | 'time'>): Date {
  const [year, month, day] = clock.date.split('-').map(Number)
  const [hour, minute] = clock.time.split(':').map(Number)
  return new Date(
    year as number,
    (month as number) - 1,
    day as number,
    hour,
    minute,
  )
}

/** The presets a task can take now: it needs a due date, and the time ahead. */
export function availablePresets(
  dueDate: string | undefined,
  now: Date,
): ReminderPreset[] {
  if (!dueDate) return []
  return (Object.keys(REMINDER_PRESETS) as ReminderPreset[]).filter(
    (preset) =>
      dateOfClock(presetClock(preset, dueDate, deviceTimeZone())) > now,
  )
}

/**
 * Where the picker starts: the reminder there is, else 9:00 on the due day,
 * else the next whole hour — whichever of them is still ahead.
 */
export function initialPick(
  reminder: Pick<ReminderClock, 'date' | 'time'> | undefined,
  dueDate: string | undefined,
  now: Date,
): Date {
  const candidates = [
    reminder ? dateOfClock(reminder) : null,
    dueDate ? dateOfClock({ date: dueDate, time: '09:00' }) : null,
  ]
  for (const candidate of candidates) if (candidate && candidate > now) return candidate
  const next = new Date(now)
  next.setHours(now.getHours() + 1, 0, 0, 0)
  return next
}

/** How the Reminder row reads: `Za 09:00`, `Today 19:00`, `21 Nov 09:00`. */
export function reminderLabel(
  reminder: Pick<ReminderClock, 'date' | 'time'>,
  today: string,
  locale: string,
  words: { today: string; tomorrow: string; reminderAt: string },
): string {
  const day = dueLabel(reminder.date, today, locale, words)
  const capitalised = day.charAt(0).toLocaleUpperCase(locale) + day.slice(1)
  return fmt(words.reminderAt, { day: capitalised, time: reminder.time })
}

/** Whether a reminder's moment is already behind this device's clock. */
export function reminderPassed(
  reminder: Pick<ReminderClock, 'date' | 'time'>,
  now: Date,
): boolean {
  return dateOfClock(reminder) <= now
}
