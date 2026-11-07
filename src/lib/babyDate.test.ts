import { describe, expect, test } from 'vitest'
import {
  combineDateTime,
  toDateInputValue,
  toTimeInputValue,
} from './babyDate'

describe('date/time input round trip', () => {
  test('toDateInputValue/toTimeInputValue/combineDateTime round-trips a timestamp', () => {
    const original = new Date('2026-03-15T09:45:00').getTime()
    const date = toDateInputValue(original)
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
})
