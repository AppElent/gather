import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import {
  availablePresets,
  clockOfDate,
  dateOfClock,
  initialPick,
  reminderLabel,
  reminderPassed,
} from './reminder'

const words = { today: 'Today', tomorrow: 'Tomorrow', reminderAt: '{day} {time}' }

// Thursday 19 November 2026, 10:00 on this phone's clock.
const now = new Date(2026, 10, 19, 10, 0)

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(now)
})
afterEach(() => vi.useRealTimers())

describe('the wall clock', () => {
  test('a picked moment reads back as the same date and time', () => {
    const clock = clockOfDate(new Date(2026, 10, 21, 9, 5), 'Europe/Amsterdam')
    expect(clock).toEqual({
      date: '2026-11-21',
      time: '09:05',
      timeZone: 'Europe/Amsterdam',
    })
    expect(dateOfClock(clock)).toEqual(new Date(2026, 10, 21, 9, 5))
  })

  test('passed is behind the clock, to the minute', () => {
    expect(reminderPassed({ date: '2026-11-19', time: '10:00' }, now)).toBe(true)
    expect(reminderPassed({ date: '2026-11-19', time: '10:01' }, now)).toBe(false)
  })
})

describe('the sheet', () => {
  test('offers the presets still ahead, and none without a due date', () => {
    expect(availablePresets('2026-11-21', now)).toEqual(['dueDay', 'eveningBefore'])
    // Due tomorrow at 10:00 today: this evening is still ahead.
    expect(availablePresets('2026-11-20', now)).toEqual(['dueDay', 'eveningBefore'])
    // Due today: 9:00 has gone, and so has yesterday evening.
    expect(availablePresets('2026-11-19', now)).toEqual([])
    expect(availablePresets(undefined, now)).toEqual([])
  })

  test('starts at the reminder, else 9:00 on the due day, else the next hour', () => {
    expect(initialPick({ date: '2026-11-20', time: '19:00' }, '2026-11-21', now)).toEqual(
      new Date(2026, 10, 20, 19, 0),
    )
    expect(initialPick(undefined, '2026-11-21', now)).toEqual(
      new Date(2026, 10, 21, 9, 0),
    )
    expect(initialPick({ date: '2026-11-01', time: '09:00' }, '2026-11-19', now)).toEqual(
      new Date(2026, 10, 19, 11, 0),
    )
  })
})

describe('the row', () => {
  test('a word near today, a weekday this week, a date beyond', () => {
    const today = '2026-11-19'
    expect(reminderLabel({ date: '2026-11-19', time: '19:00' }, today, 'en', words)).toBe(
      'Today 19:00',
    )
    expect(reminderLabel({ date: '2026-11-20', time: '09:00' }, today, 'en', words)).toBe(
      'Tomorrow 09:00',
    )
    expect(reminderLabel({ date: '2026-11-21', time: '09:00' }, today, 'nl', words)).toBe(
      'Za 09:00',
    )
    expect(reminderLabel({ date: '2026-12-01', time: '09:00' }, today, 'nl', words)).toBe(
      '1 dec 09:00',
    )
  })
})
