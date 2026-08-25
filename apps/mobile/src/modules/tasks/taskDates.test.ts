import { describe, expect, test } from 'vitest'
import { addDays, monthGrid, parseDay, toIso } from './taskDates'

describe('task date helpers', () => {
  test('keeps YYYY-MM-DD in the phone local calendar', () => {
    expect(toIso(parseDay('2026-08-24'))).toBe('2026-08-24')
    expect(addDays('2026-08-24', 2)).toBe('2026-08-26')
  })

  test('always returns six Monday-first weeks', () => {
    expect(monthGrid(2026, 7).weeks).toHaveLength(6)
    expect(monthGrid(2026, 7).weeks[0]).toHaveLength(7)
  })
})
