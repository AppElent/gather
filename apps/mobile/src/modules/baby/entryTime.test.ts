import { describe, expect, test } from 'vitest'

import {
  daysApart,
  fromParts,
  isSameDay,
  partsOf,
  shiftDays,
  shiftHours,
  shiftMinutes,
} from './entryTime'

/** Local time throughout — this is what the parent's clock says. */
const at = (text: string) => new Date(text).getTime()

describe('stepping the day', () => {
  test('keeps the wall-clock time rather than subtracting 24 hours', () => {
    const yesterday = shiftDays(at('2026-08-20T03:15:00'), -1)
    expect(partsOf(yesterday)).toMatchObject({
      month: 7,
      day: 19,
      hour: 3,
      minute: 15,
    })
  })

  test('rolls over a month end', () => {
    expect(partsOf(shiftDays(at('2026-08-31T12:00:00'), 1))).toMatchObject({
      month: 8,
      day: 1,
    })
  })
})

describe('stepping the clock', () => {
  test('minutes roll the hour', () => {
    expect(partsOf(shiftMinutes(at('2026-08-20T14:58:00'), 5))).toMatchObject({
      hour: 15,
      minute: 3,
    })
  })

  test('hours roll backwards over midnight into the previous day', () => {
    expect(partsOf(shiftHours(at('2026-08-20T00:30:00'), -1))).toMatchObject({
      day: 19,
      hour: 23,
      minute: 30,
    })
  })

  test('seconds are dropped, because nobody logs a feed to the second', () => {
    const exact = fromParts(partsOf(at('2026-08-20T14:58:37')))
    expect(new Date(exact).getSeconds()).toBe(0)
  })
})

describe('which day a moment is on', () => {
  test('two times on one day', () => {
    expect(
      isSameDay(at('2026-08-20T00:01:00'), at('2026-08-20T23:59:00')),
    ).toBe(true)
  })

  test('a minute apart across midnight is two days', () => {
    expect(
      isSameDay(at('2026-08-20T23:59:00'), at('2026-08-21T00:01:00')),
    ).toBe(false)
  })

  test('yesterday is one day back however few hours it is', () => {
    expect(
      daysApart(at('2026-08-20T00:30:00'), at('2026-08-19T23:30:00')),
    ).toBe(-1)
  })

  test('today is zero', () => {
    expect(
      daysApart(at('2026-08-20T09:00:00'), at('2026-08-20T03:00:00')),
    ).toBe(0)
  })
})
