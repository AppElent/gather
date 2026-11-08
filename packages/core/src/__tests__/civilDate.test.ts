import { describe, expect, test } from 'vitest'

import {
  addDays,
  addMonths,
  compareIsoDates,
  daysBetween,
  isIsoDate,
  localIsoDate,
  localMidnight,
  minutesToClock,
  monthGrid,
  monthStart,
  monthsUntil,
  parseIsoDate,
  weekOf,
} from '../civilDate'

describe('parsing', () => {
  test('refuses something that is not a date', () => {
    expect(parseIsoDate('2026-13-01')).toBeNull()
    expect(parseIsoDate('tomorrow')).toBeNull()
    expect(parseIsoDate('2026-8-1')).toBeNull()
  })

  test('refuses a day the month does not have', () => {
    expect(isIsoDate('2024-02-29')).toBe(true)
    expect(isIsoDate('2023-02-29')).toBe(false)
  })
})

describe('the local calendar', () => {
  test('writes today the way everything else stores a date', () => {
    expect(localIsoDate(new Date(2026, 7, 5))).toBe('2026-08-05')
  })

  test('stays on the local day just after local midnight', () => {
    const justAfter = new Date(2026, 7, 5, 0, 30)
    expect(localIsoDate(justAfter)).toBe('2026-08-05')
    expect(localIsoDate(justAfter.getTime())).toBe('2026-08-05')
  })

  test('round-trips through local midnight', () => {
    expect(localIsoDate(localMidnight('2026-08-24'))).toBe('2026-08-24')
  })
})

describe('arithmetic', () => {
  test('crosses a leap day and a month boundary', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
    expect(addDays('2024-03-10', -1)).toBe('2024-03-09')
    expect(addDays('2026-08-24', 2)).toBe('2026-08-26')
  })

  test('lands on a real day when a month is shorter', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29')
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-15')
  })

  test('counts a part month as a month to save in', () => {
    expect(monthsUntil('2026-08-25', '2028-02-01')).toBe(18)
    expect(monthsUntil('2026-08-01', '2026-09-01')).toBe(1)
    expect(monthsUntil('2026-08-25', '2026-01-01')).toBe(0)
  })

  test('measures whole days, signed', () => {
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2)
    expect(daysBetween('2026-03-30', '2026-03-28')).toBe(-2)
    expect(compareIsoDates('2026-03-28', '2026-03-28')).toBe(0)
  })
})

describe('weeks and months', () => {
  test('keeps a Monday-first week', () => {
    expect(weekOf('2026-09-16')).toEqual([
      '2026-09-14',
      '2026-09-15',
      '2026-09-16',
      '2026-09-17',
      '2026-09-18',
      '2026-09-19',
      '2026-09-20',
    ])
    expect(weekOf('2026-09-20')[0]).toBe('2026-09-14')
  })

  test('always draws six Monday-first rows of seven', () => {
    const grid = monthGrid('2026-09-16')
    expect(grid).toHaveLength(6)
    expect(grid[0]).toEqual([
      null,
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
      '2026-09-04',
      '2026-09-05',
      '2026-09-06',
    ])
    expect(grid[5].every((day) => day === null)).toBe(true)
  })

  test('starts a month on its first', () => {
    expect(monthStart('2026-09-16')).toBe('2026-09-01')
  })
})

describe('clock strings', () => {
  test('pads minutes since midnight', () => {
    expect(minutesToClock(0)).toBe('00:00')
    expect(minutesToClock(9 * 60 + 5)).toBe('09:05')
    expect(minutesToClock(23 * 60 + 59)).toBe('23:59')
  })
})
