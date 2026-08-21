import { describe, expect, test } from 'vitest'

import { millisecondsUntilNextMinute } from './clock'

describe('the log clock', () => {
  test('refreshes tile ages on the next minute boundary', () => {
    expect(millisecondsUntilNextMinute(1_234_567)).toBe(25_433)
  })

  test('waits a whole minute when the clock is exactly on a boundary', () => {
    expect(millisecondsUntilNextMinute(1_200_000)).toBe(60_000)
  })
})
