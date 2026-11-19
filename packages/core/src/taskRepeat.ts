/**
 * How a repeating task comes back (APP-303).
 *
 * A task repeats on a **fixed schedule** (every N days, weeks on chosen
 * weekdays, months on a day of the month, or years on a date) or **after
 * done** (N days, weeks or months after it was last completed). Either way a
 * repeating task is one row with one open occurrence: completing it moves its
 * due date on and leaves it open, so a missed one stays overdue instead of
 * piling up copies (the redesign record, 16 Sept).
 *
 * The rules, decided in the issue:
 *
 * - **Fixed** advances to the first scheduled date after both the current due
 *   date and today. Completing early skips to the date after the current one;
 *   completing late skips the dates already gone, so the next one is in the
 *   future.
 * - **After done** counts from the day it was completed.
 * - A day that does not exist in a month (the 31st, 29 February) lands on that
 *   month's last day, and the rule keeps its own day, so the next month is the
 *   31st again. Calendar recurrence (not built yet) skips such a month instead,
 *   which is why these rules live here and only the date helpers are shared
 *   (`civilDate.ts`).
 *
 * Every function is pure and takes dates as `YYYY-MM-DD` civil days.
 */
import {
  addDays,
  addMonths,
  clampedIsoDate,
  compareIsoDates,
  daysBetween,
  isoWeekday,
  mondayStart,
  parseIsoDate,
} from './civilDate'

export const REPEAT_MODES = ['fixed', 'afterDone'] as const
export type RepeatMode = (typeof REPEAT_MODES)[number]

export const REPEAT_UNITS = ['day', 'week', 'month', 'year'] as const
export type RepeatUnit = (typeof REPEAT_UNITS)[number]

/** After done counts in days, weeks or months; "a year after" is 12 months. */
export const AFTER_DONE_UNITS = ['day', 'week', 'month'] as const
export type AfterDoneUnit = (typeof AFTER_DONE_UNITS)[number]

/** The largest N in "every N": enough for "every 52 weeks", bounded for the picker. */
export const REPEAT_EVERY_MAX = 99

/** Monday 1 to Sunday 7, the order the weekday toggles show them in. */
export const ISO_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const

/**
 * A repeat as stored on a task. Flat, with the fields one unit needs:
 * `weekdays` for a fixed weekly rule, `monthDay` for monthly and yearly, and
 * `month` for yearly. `normalizeRepeat` drops the rest.
 */
export interface TaskRepeat {
  mode: RepeatMode
  unit: RepeatUnit
  every: number
  /** ISO weekdays (Monday 1 … Sunday 7), sorted, at least one. */
  weekdays?: number[]
  /** 1-31: the day of the month it falls on, clamped in shorter months. */
  monthDay?: number
  /** 1-12: the month of a yearly rule. */
  month?: number
}

const isInt = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= min &&
  value <= max

/**
 * A repeat in its one stored form, with its anchors filled in from `anchor`
 * (the task's due date, or today) where the rule left them out, or `null` for
 * a rule that cannot repeat: an unknown mode or unit, N outside 1-99, a year
 * after done, or a weekday, day or month out of range.
 */
export function normalizeRepeat(
  rule: TaskRepeat,
  anchor: string,
): TaskRepeat | null {
  const date = parseIsoDate(anchor)
  if (!date) return null
  if (!(REPEAT_MODES as readonly string[]).includes(rule.mode)) return null
  if (!(REPEAT_UNITS as readonly string[]).includes(rule.unit)) return null
  if (!isInt(rule.every, 1, REPEAT_EVERY_MAX)) return null
  const base = { mode: rule.mode, unit: rule.unit, every: rule.every }
  if (rule.mode === 'afterDone') {
    return (AFTER_DONE_UNITS as readonly string[]).includes(rule.unit)
      ? base
      : null
  }
  switch (rule.unit) {
    case 'day':
      return base
    case 'week': {
      const weekdays = rule.weekdays ?? [isoWeekday(anchor)]
      if (weekdays.length === 0 || !weekdays.every((d) => isInt(d, 1, 7))) {
        return null
      }
      return { ...base, weekdays: [...new Set(weekdays)].sort((a, b) => a - b) }
    }
    case 'month': {
      const monthDay = rule.monthDay ?? date.day
      return isInt(monthDay, 1, 31) ? { ...base, monthDay } : null
    }
    case 'year': {
      const month = rule.month ?? date.month
      const monthDay = rule.monthDay ?? date.day
      if (!isInt(month, 1, 12) || !isInt(monthDay, 1, 31)) return null
      // 30 February is no date in any year; 29 February is, in some.
      if (monthDay > maxDayOfMonth(month)) return null
      return { ...base, month, monthDay }
    }
  }
}

/** The longest a month gets: 29 for February, since leap years exist. */
function maxDayOfMonth(month: number): number {
  return month === 2 ? 29 : [4, 6, 9, 11].includes(month) ? 30 : 31
}

/**
 * The same rule following a due date the person moved: a monthly or yearly
 * rule takes the new day (and month), and a weekly rule on one weekday takes
 * the new weekday. A weekly rule on several days keeps them, and the new date
 * stands as a one-off until it is completed.
 */
export function reanchorRepeat(rule: TaskRepeat, dueDate: string): TaskRepeat {
  const date = parseIsoDate(dueDate)
  if (!date || rule.mode !== 'fixed') return rule
  switch (rule.unit) {
    case 'week':
      return rule.weekdays && rule.weekdays.length === 1
        ? { ...rule, weekdays: [isoWeekday(dueDate)] }
        : rule
    case 'month':
      return { ...rule, monthDay: date.day }
    case 'year':
      return { ...rule, month: date.month, monthDay: date.day }
    default:
      return rule
  }
}

/**
 * The first date of a fixed schedule strictly after `after`.
 *
 * The schedule is anchored on `anchor` (the current due date): every N days
 * from it, every N weeks from its week, every N months from its month, every
 * N years from its year. A rule that `normalizeRepeat` would refuse answers
 * `after` plus one day rather than looping.
 */
export function nextScheduledDate(
  rule: TaskRepeat,
  anchor: string,
  after: string,
): string {
  const start = parseIsoDate(anchor)
  const from = parseIsoDate(after)
  const every = Math.max(1, Math.trunc(rule.every))
  if (!start || !from) return addDays(after, 1)
  switch (rule.unit) {
    case 'day': {
      const steps = Math.floor(daysBetween(anchor, after) / every) + 1
      return addDays(anchor, steps * every)
    }
    case 'week': {
      const days = (rule.weekdays ?? [isoWeekday(anchor)])
        .filter((d) => d >= 1 && d <= 7)
        .sort((a, b) => a - b)
      if (days.length === 0) return addDays(after, 1)
      const firstWeek = mondayStart(anchor)
      const weeksIn = Math.floor(daysBetween(firstWeek, mondayStart(after)) / 7)
      // Start at the scheduled week holding `after` (or the one before it);
      // the second or third candidate week always has a later day.
      for (let k = Math.floor(weeksIn / every); ; k += 1) {
        const week = addDays(firstWeek, k * every * 7)
        for (const day of days) {
          const date = addDays(week, day - 1)
          if (compareIsoDates(date, after) > 0) return date
        }
      }
    }
    case 'month': {
      const monthDay = rule.monthDay ?? start.day
      const first = start.year * 12 + start.month - 1
      const target = from.year * 12 + from.month - 1
      for (let k = Math.floor((target - first) / every); ; k += 1) {
        const index = first + k * every
        const date = clampedIsoDate(
          Math.floor(index / 12),
          (index % 12) + 1,
          monthDay,
        )
        if (compareIsoDates(date, after) > 0) return date
      }
    }
    case 'year': {
      const month = rule.month ?? start.month
      const monthDay = rule.monthDay ?? start.day
      for (let k = Math.floor((from.year - start.year) / every); ; k += 1) {
        const date = clampedIsoDate(start.year + k * every, month, monthDay)
        if (compareIsoDates(date, after) > 0) return date
      }
    }
  }
}

/** The first date of a fixed schedule on or after `day`. */
export function firstScheduledDate(
  rule: TaskRepeat,
  anchor: string,
  day: string,
): string {
  return nextScheduledDate(rule, anchor, addDays(day, -1))
}

/**
 * The due date a repeating task moves to when it is completed on `today`.
 *
 * Fixed: the first scheduled date after both the current due date and today
 * (a task with no due date is anchored on today). After done: N units after
 * `today`, the 31st landing on a shorter month's last day.
 */
export function nextDueDate(
  rule: TaskRepeat,
  { dueDate, today }: { dueDate?: string; today: string },
): string {
  if (rule.mode === 'afterDone') {
    const every = Math.max(1, Math.trunc(rule.every))
    switch (rule.unit) {
      case 'day':
        return addDays(today, every)
      case 'week':
        return addDays(today, every * 7)
      case 'month':
        return addMonths(today, every)
      case 'year':
        return addMonths(today, every * 12)
    }
  }
  const anchor = dueDate && parseIsoDate(dueDate) ? dueDate : today
  const after = compareIsoDates(anchor, today) > 0 ? anchor : today
  return nextScheduledDate(rule, anchor, after)
}

/**
 * The next `count` dates of a fixed schedule after `from`, for the Repeat
 * sheet's "Next" preview ("After Sat 21 Nov: Sat 28 Nov, Sat 5 Dec, …").
 */
export function upcomingDates(
  rule: TaskRepeat,
  from: string,
  count: number,
): string[] {
  const dates: string[] = []
  let after = from
  for (let i = 0; i < count; i += 1) {
    after = nextScheduledDate(rule, from, after)
    dates.push(after)
  }
  return dates
}

/** Whether two rules repeat the same way. */
export function sameRepeat(
  a: TaskRepeat | undefined | null,
  b: TaskRepeat | undefined | null,
): boolean {
  if (!a || !b) return !a && !b
  return (
    a.mode === b.mode &&
    a.unit === b.unit &&
    a.every === b.every &&
    a.monthDay === b.monthDay &&
    a.month === b.month &&
    (a.weekdays ?? []).join() === (b.weekdays ?? []).join()
  )
}

/** The words `describeRepeat` needs, from `tasks.repeat.summary`. */
export interface RepeatSummaryWords {
  every: Record<RepeatUnit, { one: string; other: string }>
  afterDone: Record<AfterDoneUnit, { one: string; other: string }>
  /** `{every}, {days}`: "Every week, Sat". */
  onDays: string
  /** `{every} on day {day}`. */
  onMonthDay: string
  /** `{every} on {date}`. */
  onDate: string
}

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? String(values[key]) : whole,
  )

/**
 * A repeat in a few words for a row: "Every week, Sat", "Every month on day
 * 31", "3 days after done". Weekday and month names come from `Intl` in the
 * app's locale, the way due dates are written.
 */
export function describeRepeat(
  rule: TaskRepeat,
  words: RepeatSummaryWords,
  locale: string,
): string {
  const count = (forms: { one: string; other: string }) =>
    fill(rule.every === 1 ? forms.one : forms.other, { count: rule.every })
  if (rule.mode === 'afterDone') {
    const unit = rule.unit === 'year' ? 'month' : rule.unit
    return count(words.afterDone[unit])
  }
  const every = count(words.every[rule.unit])
  switch (rule.unit) {
    case 'week':
      return fill(words.onDays, {
        every,
        days: (rule.weekdays ?? []).map((d) => weekdayName(d, locale)).join(', '),
      })
    case 'month':
      return rule.monthDay === undefined
        ? every
        : fill(words.onMonthDay, { every, day: rule.monthDay })
    case 'year':
      return rule.month === undefined || rule.monthDay === undefined
        ? every
        : fill(words.onDate, {
            every,
            // A leap year, so 29 February has a name.
            date: new Date(Date.UTC(2024, rule.month - 1, rule.monthDay))
              .toLocaleDateString(locale, {
                day: 'numeric',
                month: 'short',
                timeZone: 'UTC',
              }),
          })
    default:
      return every
  }
}

/** "Sat" or "za" for ISO weekday 6: 2024-01-01 was a Monday. */
export function weekdayName(
  isoDay: number,
  locale: string,
  width: 'short' | 'long' = 'short',
): string {
  return new Date(Date.UTC(2024, 0, isoDay)).toLocaleDateString(locale, {
    weekday: width,
    timeZone: 'UTC',
  })
}
