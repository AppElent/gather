import { describe, expect, it } from 'vitest'
import {
  addYears,
  amsterdamIsoDate,
  clampedIsoDate,
  isoWeekday,
} from './civilDate'
import {
  describeRepeat,
  firstScheduledDate,
  nextDueDate,
  normalizeRepeat,
  reanchorRepeat,
  type TaskRepeat,
  upcomingDates,
} from './taskRepeat'

const fixed = (rule: Omit<TaskRepeat, 'mode'>): TaskRepeat => ({
  mode: 'fixed',
  ...rule,
})
const afterDone = (unit: TaskRepeat['unit'], every: number): TaskRepeat => ({
  mode: 'afterDone',
  unit,
  every,
})

describe('shared date helpers', () => {
  it('clamps a day that does not exist to the last day of its month', () => {
    expect(clampedIsoDate(2026, 2, 31)).toBe('2026-02-28')
    expect(clampedIsoDate(2028, 2, 31)).toBe('2028-02-29')
    expect(clampedIsoDate(2026, 4, 31)).toBe('2026-04-30')
    expect(clampedIsoDate(2026, 1, 31)).toBe('2026-01-31')
  })

  it('adds years, 29 February landing on the 28th', () => {
    expect(addYears('2028-02-29', 1)).toBe('2029-02-28')
    expect(addYears('2028-02-29', 4)).toBe('2032-02-29')
  })

  it('numbers weekdays Monday 1 to Sunday 7', () => {
    expect(isoWeekday('2026-11-16')).toBe(1)
    expect(isoWeekday('2026-11-21')).toBe(6)
    expect(isoWeekday('2026-11-22')).toBe(7)
  })

  it('reads the Dutch day across midnight and summer time', () => {
    // 23:30 UTC in winter is 00:30 the next day in Amsterdam.
    expect(amsterdamIsoDate(Date.UTC(2026, 10, 19, 23, 30))).toBe('2026-11-20')
    expect(amsterdamIsoDate(Date.UTC(2026, 10, 19, 22, 30))).toBe('2026-11-19')
    // 22:30 UTC in summer is already 00:30.
    expect(amsterdamIsoDate(Date.UTC(2026, 6, 1, 22, 30))).toBe('2026-07-02')
    expect(amsterdamIsoDate(Date.UTC(2026, 6, 1, 21, 30))).toBe('2026-07-01')
    // Summer time starts 01:00 UTC on 29 March 2026 and ends 25 October.
    expect(amsterdamIsoDate(Date.UTC(2026, 2, 29, 22, 30))).toBe('2026-03-30')
    expect(amsterdamIsoDate(Date.UTC(2026, 9, 25, 22, 30))).toBe('2026-10-25')
  })
})

describe('normalizeRepeat', () => {
  it('fills a weekly rule with the weekday of its anchor', () => {
    expect(
      normalizeRepeat({ mode: 'fixed', unit: 'week', every: 1 }, '2026-11-21'),
    ).toEqual({ mode: 'fixed', unit: 'week', every: 1, weekdays: [6] })
  })

  it('sorts and dedupes weekdays, and refuses an empty set', () => {
    expect(
      normalizeRepeat(fixed({ unit: 'week', every: 2, weekdays: [4, 2, 4] }), '2026-11-21')
        ?.weekdays,
    ).toEqual([2, 4])
    expect(
      normalizeRepeat(fixed({ unit: 'week', every: 1, weekdays: [] }), '2026-11-21'),
    ).toBeNull()
    expect(
      normalizeRepeat(fixed({ unit: 'week', every: 1, weekdays: [0] }), '2026-11-21'),
    ).toBeNull()
  })

  it('takes the day and month of the anchor for monthly and yearly rules', () => {
    expect(normalizeRepeat(fixed({ unit: 'month', every: 1 }), '2026-01-31')).toEqual(
      { mode: 'fixed', unit: 'month', every: 1, monthDay: 31 },
    )
    expect(normalizeRepeat(fixed({ unit: 'year', every: 1 }), '2028-02-29')).toEqual(
      { mode: 'fixed', unit: 'year', every: 1, month: 2, monthDay: 29 },
    )
  })

  it('drops the fields a unit does not use', () => {
    expect(
      normalizeRepeat(
        { mode: 'afterDone', unit: 'day', every: 3, weekdays: [1], monthDay: 4 },
        '2026-11-21',
      ),
    ).toEqual({ mode: 'afterDone', unit: 'day', every: 3 })
    expect(
      normalizeRepeat(fixed({ unit: 'day', every: 2, month: 3 }), '2026-11-21'),
    ).toEqual({ mode: 'fixed', unit: 'day', every: 2 })
  })

  it('refuses every N outside 1 to 99, fractions, a year after done and 30 February', () => {
    expect(normalizeRepeat(fixed({ unit: 'day', every: 0 }), '2026-11-21')).toBeNull()
    expect(normalizeRepeat(fixed({ unit: 'day', every: 100 }), '2026-11-21')).toBeNull()
    expect(normalizeRepeat(fixed({ unit: 'day', every: 1.5 }), '2026-11-21')).toBeNull()
    expect(normalizeRepeat(afterDone('year', 1), '2026-11-21')).toBeNull()
    expect(
      normalizeRepeat(fixed({ unit: 'year', every: 1, month: 2, monthDay: 30 }), '2026-11-21'),
    ).toBeNull()
    expect(
      normalizeRepeat(fixed({ unit: 'month', every: 1, monthDay: 32 }), '2026-11-21'),
    ).toBeNull()
  })
})

describe('fixed schedule', () => {
  it('daily, every N, from the due date', () => {
    const rule = fixed({ unit: 'day', every: 1 })
    expect(nextDueDate(rule, { dueDate: '2026-11-21', today: '2026-11-21' })).toBe(
      '2026-11-22',
    )
    const every3 = fixed({ unit: 'day', every: 3 })
    expect(nextDueDate(every3, { dueDate: '2026-11-21', today: '2026-11-21' })).toBe(
      '2026-11-24',
    )
  })

  it('completing early moves to the date after the current one', () => {
    const rule = fixed({ unit: 'week', every: 1, weekdays: [6] })
    // Due Saturday 28 Nov, done on Wednesday 25th: next is 5 Dec, not the 28th.
    expect(nextDueDate(rule, { dueDate: '2026-11-28', today: '2026-11-25' })).toBe(
      '2026-12-05',
    )
  })

  it('completing late skips the dates already gone, keeping the schedule', () => {
    const rule = fixed({ unit: 'day', every: 3 })
    // Due 1 Nov, every 3 days: 4, 7, … 19, 22. Done on the 20th: the 22nd.
    expect(nextDueDate(rule, { dueDate: '2026-11-01', today: '2026-11-20' })).toBe(
      '2026-11-22',
    )
    const weekly = fixed({ unit: 'week', every: 1, weekdays: [2] })
    // Due Tue 3 Nov, done Fri 20 Nov: Tue 24 Nov.
    expect(nextDueDate(weekly, { dueDate: '2026-11-03', today: '2026-11-20' })).toBe(
      '2026-11-24',
    )
    // Done on a scheduled day while late: that day counts as done.
    expect(nextDueDate(weekly, { dueDate: '2026-11-03', today: '2026-11-24' })).toBe(
      '2026-12-01',
    )
  })

  it('weekly on several weekdays walks through the week', () => {
    const rule = fixed({ unit: 'week', every: 1, weekdays: [2, 4] })
    expect(nextDueDate(rule, { dueDate: '2026-11-17', today: '2026-11-17' })).toBe(
      '2026-11-19',
    )
    expect(nextDueDate(rule, { dueDate: '2026-11-19', today: '2026-11-19' })).toBe(
      '2026-11-24',
    )
  })

  it('every 2 weeks keeps the phase of the due date’s week', () => {
    const rule = fixed({ unit: 'week', every: 2, weekdays: [2, 4] })
    // Week of Mon 16 Nov is on; the week of 23 Nov is off; 30 Nov is on.
    expect(upcomingDates(rule, '2026-11-17', 4)).toEqual([
      '2026-11-19',
      '2026-12-01',
      '2026-12-03',
      '2026-12-15',
    ])
    // Late by a week (done 24 Nov, an off week): the next on week.
    expect(nextDueDate(rule, { dueDate: '2026-11-19', today: '2026-11-24' })).toBe(
      '2026-12-01',
    )
  })

  it('weekly over a year boundary', () => {
    const rule = fixed({ unit: 'week', every: 1, weekdays: [5] })
    expect(nextDueDate(rule, { dueDate: '2026-12-25', today: '2026-12-25' })).toBe(
      '2027-01-01',
    )
  })

  it('monthly on the 31st uses the last day of shorter months and comes back to the 31st', () => {
    const rule = fixed({ unit: 'month', every: 1, monthDay: 31 })
    expect(upcomingDates(rule, '2026-01-31', 4)).toEqual([
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
      '2026-05-31',
    ])
    // A leap year's February has a 29th.
    expect(upcomingDates(rule, '2028-01-31', 2)).toEqual(['2028-02-29', '2028-03-31'])
  })

  it('monthly on the 29th and 30th clamp only where they must', () => {
    expect(
      upcomingDates(fixed({ unit: 'month', every: 1, monthDay: 30 }), '2026-01-30', 2),
    ).toEqual(['2026-02-28', '2026-03-30'])
    expect(
      upcomingDates(fixed({ unit: 'month', every: 1, monthDay: 29 }), '2027-01-29', 2),
    ).toEqual(['2027-02-28', '2027-03-29'])
  })

  it('every 3 months from the due date’s month', () => {
    const rule = fixed({ unit: 'month', every: 3, monthDay: 15 })
    expect(upcomingDates(rule, '2026-11-15', 3)).toEqual([
      '2027-02-15',
      '2027-05-15',
      '2027-08-15',
    ])
    // Done late, in January: the February date is still ahead.
    expect(nextDueDate(rule, { dueDate: '2026-11-15', today: '2027-01-10' })).toBe(
      '2027-02-15',
    )
  })

  it('yearly on 29 February lands on the 28th outside leap years', () => {
    const rule = fixed({ unit: 'year', every: 1, month: 2, monthDay: 29 })
    expect(upcomingDates(rule, '2028-02-29', 5)).toEqual([
      '2029-02-28',
      '2030-02-28',
      '2031-02-28',
      '2032-02-29',
      '2033-02-28',
    ])
  })

  it('every 2 years keeps its phase', () => {
    const rule = fixed({ unit: 'year', every: 2, month: 6, monthDay: 1 })
    expect(nextDueDate(rule, { dueDate: '2026-06-01', today: '2027-07-01' })).toBe(
      '2028-06-01',
    )
  })

  it('a task with no due date is anchored on today', () => {
    const rule = fixed({ unit: 'week', every: 1, weekdays: [6] })
    expect(nextDueDate(rule, { today: '2026-11-18' })).toBe('2026-11-21')
    expect(firstScheduledDate(rule, '2026-11-18', '2026-11-18')).toBe('2026-11-21')
    expect(firstScheduledDate(rule, '2026-11-21', '2026-11-21')).toBe('2026-11-21')
  })
})

describe('after done', () => {
  it('counts days, weeks and months from the day it was completed', () => {
    expect(nextDueDate(afterDone('day', 3), { dueDate: '2026-11-01', today: '2026-11-20' })).toBe(
      '2026-11-23',
    )
    expect(nextDueDate(afterDone('week', 2), { today: '2026-11-20' })).toBe('2026-12-04')
    expect(nextDueDate(afterDone('month', 3), { dueDate: '2027-06-01', today: '2026-11-20' })).toBe(
      '2027-02-20',
    )
  })

  it('from the 31st lands on the last day of a shorter month', () => {
    expect(nextDueDate(afterDone('month', 1), { today: '2026-01-31' })).toBe('2026-02-28')
    expect(nextDueDate(afterDone('month', 1), { today: '2028-01-31' })).toBe('2028-02-29')
  })
})

describe('reanchorRepeat', () => {
  it('follows a moved due date for monthly, yearly and single-day weekly rules', () => {
    expect(reanchorRepeat(fixed({ unit: 'month', every: 1, monthDay: 31 }), '2026-12-05'))
      .toMatchObject({ monthDay: 5 })
    expect(
      reanchorRepeat(fixed({ unit: 'year', every: 1, month: 2, monthDay: 29 }), '2026-03-10'),
    ).toMatchObject({ month: 3, monthDay: 10 })
    expect(
      reanchorRepeat(fixed({ unit: 'week', every: 1, weekdays: [6] }), '2026-11-22'),
    ).toMatchObject({ weekdays: [7] })
    expect(
      reanchorRepeat(fixed({ unit: 'week', every: 1, weekdays: [2, 4] }), '2026-11-22'),
    ).toMatchObject({ weekdays: [2, 4] })
    expect(reanchorRepeat(afterDone('day', 3), '2026-11-22')).toEqual(afterDone('day', 3))
  })
})

describe('describeRepeat', () => {
  const words = {
    every: {
      day: { one: 'Every day', other: 'Every {count} days' },
      week: { one: 'Every week', other: 'Every {count} weeks' },
      month: { one: 'Every month', other: 'Every {count} months' },
      year: { one: 'Every year', other: 'Every {count} years' },
    },
    afterDone: {
      day: { one: '1 day after done', other: '{count} days after done' },
      week: { one: '1 week after done', other: '{count} weeks after done' },
      month: { one: '1 month after done', other: '{count} months after done' },
    },
    onDays: '{every}, {days}',
    onMonthDay: '{every} on day {day}',
    onDate: '{every} on {date}',
  }

  it('reads as a short phrase', () => {
    expect(describeRepeat(fixed({ unit: 'week', every: 1, weekdays: [6] }), words, 'en')).toBe(
      'Every week, Sat',
    )
    expect(
      describeRepeat(fixed({ unit: 'week', every: 2, weekdays: [2, 4] }), words, 'nl'),
    ).toBe('Every 2 weeks, di, do')
    expect(describeRepeat(fixed({ unit: 'month', every: 1, monthDay: 31 }), words, 'en')).toBe(
      'Every month on day 31',
    )
    expect(
      describeRepeat(fixed({ unit: 'year', every: 1, month: 2, monthDay: 29 }), words, 'en-GB'),
    ).toBe('Every year on 29 Feb')
    expect(describeRepeat(afterDone('day', 3), words, 'en')).toBe('3 days after done')
    expect(describeRepeat(afterDone('month', 1), words, 'en')).toBe('1 month after done')
  })
})
