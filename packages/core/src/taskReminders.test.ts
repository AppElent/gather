import { describe, expect, test } from 'vitest'

import {
  clockMoment,
  isReminderClock,
  isTimeZone,
  momentClock,
  presetClock,
  presetOf,
  shiftClock,
  taskReminderKey,
} from './taskReminders'

const AMS = 'Europe/Amsterdam'

describe('clockMoment', () => {
  test('a winter and a summer 9:00 in Amsterdam', () => {
    expect(
      new Date(
        clockMoment({ date: '2026-11-21', time: '09:00', timeZone: AMS }),
      ).toISOString(),
    ).toBe('2026-11-21T08:00:00.000Z')
    expect(
      new Date(
        clockMoment({ date: '2026-07-04', time: '09:00', timeZone: AMS }),
      ).toISOString(),
    ).toBe('2026-07-04T07:00:00.000Z')
  })

  test('other zones, either side of UTC', () => {
    expect(
      new Date(
        clockMoment({
          date: '2026-11-21',
          time: '19:00',
          timeZone: 'America/New_York',
        }),
      ).toISOString(),
    ).toBe('2026-11-22T00:00:00.000Z')
    expect(
      new Date(
        clockMoment({ date: '2026-11-21', time: '00:30', timeZone: 'UTC' }),
      ).toISOString(),
    ).toBe('2026-11-21T00:30:00.000Z')
  })

  test('a time skipped by the spring change lands after the gap', () => {
    // 29 March 2026: Amsterdam goes from 02:00 straight to 03:00.
    expect(
      new Date(
        clockMoment({ date: '2026-03-29', time: '02:30', timeZone: AMS }),
      ).toISOString(),
    ).toBe('2026-03-29T01:30:00.000Z')
  })

  test('the day after a change keeps its wall clock', () => {
    const before = clockMoment({ date: '2026-03-28', time: '09:00', timeZone: AMS })
    const after = clockMoment({ date: '2026-03-29', time: '09:00', timeZone: AMS })
    expect(after - before).toBe(23 * 3_600_000)
  })

  test('momentClock reads a moment back as the wall clock', () => {
    const clock = { date: '2026-11-21', time: '09:05', timeZone: AMS }
    expect(momentClock(clockMoment(clock), AMS)).toEqual(clock)
  })
})

describe('presets', () => {
  test('the due day at 9:00 and the evening before at 19:00', () => {
    expect(presetClock('dueDay', '2026-11-21', AMS)).toEqual({
      date: '2026-11-21',
      time: '09:00',
      timeZone: AMS,
    })
    expect(presetClock('eveningBefore', '2026-12-01', AMS)).toEqual({
      date: '2026-11-30',
      time: '19:00',
      timeZone: AMS,
    })
  })

  test('presetOf recognises a preset only for its due date', () => {
    expect(presetOf({ date: '2026-11-20', time: '19:00' }, '2026-11-21')).toBe(
      'eveningBefore',
    )
    expect(presetOf({ date: '2026-11-21', time: '09:00' }, '2026-11-21')).toBe(
      'dueDay',
    )
    expect(presetOf({ date: '2026-11-21', time: '09:00' }, '2026-11-22')).toBe(
      null,
    )
    expect(presetOf({ date: '2026-11-21', time: '09:00' }, undefined)).toBe(
      null,
    )
  })
})

describe('shiftClock', () => {
  const clock = { date: '2026-11-20', time: '19:00', timeZone: AMS }

  test('moves with the due date, by the same number of days', () => {
    expect(shiftClock(clock, '2026-11-21', '2026-11-28').date).toBe(
      '2026-11-27',
    )
    expect(shiftClock(clock, '2026-11-21', '2026-11-19').date).toBe(
      '2026-11-18',
    )
  })

  test('stays put when a due date is set or cleared', () => {
    expect(shiftClock(clock, undefined, '2026-11-28')).toBe(clock)
    expect(shiftClock(clock, '2026-11-21', undefined)).toBe(clock)
  })
})

describe('validation', () => {
  test('a real date, a 24-hour time and a known zone', () => {
    expect(isReminderClock({ date: '2026-11-21', time: '09:00', timeZone: AMS })).toBe(true)
    expect(isReminderClock({ date: '2026-02-30', time: '09:00', timeZone: AMS })).toBe(false)
    expect(isReminderClock({ date: '2026-11-21', time: '24:00', timeZone: AMS })).toBe(false)
    expect(isReminderClock({ date: '2026-11-21', time: '9:00', timeZone: AMS })).toBe(false)
    expect(isTimeZone('Mars/Olympus')).toBe(false)
    expect(isTimeZone('')).toBe(false)
  })

  test('one dedupe key per task', () => {
    expect(taskReminderKey('abc')).toBe('task:abc:reminder')
  })
})
