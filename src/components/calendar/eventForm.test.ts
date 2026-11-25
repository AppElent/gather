import { describe, expect, test } from 'vitest'
import {
  clockToMinutes,
  defaultStart,
  emptyEvent,
  isChanged,
  moveStart,
  savedFields,
} from './eventForm'

const timed = (startMinutes: number | null, endMinutes: number | null) => ({
  ...emptyEvent('2026-11-24', 'c1'),
  allDay: false,
  startMinutes,
  endMinutes,
})

test('a new event is all day and unchanged', () => {
  const event = emptyEvent('2026-11-24', 'c1')
  expect(event.allDay).toBe(true)
  expect(isChanged(event, emptyEvent('2026-11-24', 'c1'))).toBe(false)
  expect(isChanged({ ...event, title: 'x' }, event)).toBe(true)
})

test('the default start is the next hour today, nine on another day', () => {
  expect(defaultStart('2026-11-24', '2026-11-24', 13)).toBe(14 * 60)
  expect(defaultStart('2026-11-24', '2026-11-24', 23)).toBe(23 * 60)
  expect(defaultStart('2026-11-25', '2026-11-24', 13)).toBe(9 * 60)
})

test('a new start keeps the length, within the day', () => {
  expect(moveStart(timed(600, 690), 720)).toEqual({
    startMinutes: 720,
    endMinutes: 810,
  })
  expect(moveStart(timed(600, 690), 1410).endMinutes).toBe(1439)
  expect(moveStart(timed(null, null), 600).endMinutes).toBe(660)
  expect(moveStart(timed(600, 690), null)).toEqual({
    startMinutes: null,
    endMinutes: 690,
  })
})

describe('savedFields', () => {
  test('trims, and clears the times of an all-day event', () => {
    expect(
      savedFields({
        ...timed(600, 660),
        allDay: true,
        title: ' Doctor ',
        location: '  ',
        notes: ' bring ',
      }),
    ).toMatchObject({
      title: 'Doctor',
      startMinutes: null,
      endMinutes: null,
      location: null,
      notes: 'bring',
    })
  })
})

test('reads a time field', () => {
  expect(clockToMinutes('08:30')).toBe(510)
  expect(clockToMinutes('')).toBeNull()
})
