import { localIsoDate, todayIn } from '@gather/core/civil-date'
import { describe, expect, test } from 'vitest'
import {
  combineDateTime,
  formatEventDateHeading,
  toTimeInputValue,
} from './babyDate'

describe('date/time input round trip', () => {
  test('localIsoDate/toTimeInputValue/combineDateTime round-trips a timestamp', () => {
    const original = new Date('2026-03-15T09:45:00').getTime()
    const date = localIsoDate(original)
    const time = toTimeInputValue(original)
    expect(date).toBe('2026-03-15')
    expect(time).toBe('09:45')
    expect(combineDateTime(date, time)).toBe(original)
  })

  test('combineDateTime defaults to midnight when time is blank', () => {
    expect(combineDateTime('2026-03-15', '')).toBe(
      new Date('2026-03-15T00:00:00').getTime(),
    )
  })

  test("round-trips and formats headings in the Group's zone", () => {
    const instant = Date.parse('2026-11-24T22:30:00Z')
    expect(todayIn('Asia/Tokyo', instant)).toBe('2026-11-25')
    expect(toTimeInputValue(instant, 'Asia/Tokyo')).toBe('07:30')
    expect(combineDateTime('2026-11-25', '07:30', 'Asia/Tokyo')).toBe(instant)
    expect(formatEventDateHeading(instant, 'en', 'Asia/Tokyo')).toContain('25')
    expect(formatEventDateHeading(instant, 'en', 'Europe/Amsterdam')).toContain(
      '24',
    )
  })
})
