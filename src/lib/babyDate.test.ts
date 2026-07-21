import { describe, expect, test } from 'vitest'
import {
  endOfDayMs,
  formatAge,
  fromDatetimeLocalValue,
  startOfDayMs,
  toDatetimeLocalValue,
} from './babyDate'

const DAY = 24 * 60 * 60 * 1000

describe('formatAge', () => {
  test('under two weeks reports days', () => {
    const birth = '2026-01-01'
    const at = new Date('2026-01-01T00:00:00').getTime() + 5 * DAY
    expect(formatAge(birth, at)).toBe('5 days old')
  })

  test('singular day', () => {
    const birth = '2026-01-01'
    const at = new Date('2026-01-01T00:00:00').getTime() + 1 * DAY
    expect(formatAge(birth, at)).toBe('1 day old')
  })

  test('two to eight weeks reports weeks', () => {
    const birth = '2026-01-01'
    const at = new Date('2026-01-01T00:00:00').getTime() + 21 * DAY
    expect(formatAge(birth, at)).toBe('3 weeks old')
  })

  test('two months and beyond reports months', () => {
    expect(
      formatAge('2026-01-01', new Date('2026-04-01T00:00:00').getTime()),
    ).toBe('3 months old')
  })

  test('two years and beyond reports years, with leftover months', () => {
    expect(
      formatAge('2024-01-01', new Date('2026-07-01T00:00:00').getTime()),
    ).toBe('2y 6m old')
  })

  test('exact whole years with no leftover months', () => {
    expect(
      formatAge('2024-01-01', new Date('2026-01-01T00:00:00').getTime()),
    ).toBe('2 years old')
  })
})

describe('datetime-local round trip', () => {
  test('toDatetimeLocalValue/fromDatetimeLocalValue round-trips a timestamp', () => {
    const original = new Date('2026-03-15T09:45:00').getTime()
    const value = toDatetimeLocalValue(original)
    expect(value).toBe('2026-03-15T09:45')
    expect(fromDatetimeLocalValue(value)).toBe(original)
  })
})

describe('startOfDayMs / endOfDayMs', () => {
  test('bracket a full local day', () => {
    const start = startOfDayMs('2026-03-15')
    const end = endOfDayMs('2026-03-15')
    expect(new Date(start).getHours()).toBe(0)
    expect(new Date(start).getMinutes()).toBe(0)
    expect(new Date(end).getHours()).toBe(23)
    expect(end).toBeGreaterThan(start)
    expect(end - start).toBeLessThan(DAY)
  })
})
