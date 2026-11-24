import { expect, test } from 'vitest'

import { isoDateIn } from './civilDate'
import { matchesRowFilters } from './searchFilters'

const calendar = { today: '2026-11-25', dayAt: isoDateIn('Europe/Amsterdam') }

test('isoDateIn reads a moment on the zone’s calendar, summer time included', () => {
  const day = isoDateIn('Europe/Amsterdam')
  expect(day(Date.parse('2026-11-24T22:59:00Z'))).toBe('2026-11-24')
  expect(day(Date.parse('2026-11-24T23:00:00Z'))).toBe('2026-11-25')
  expect(day(Date.parse('2026-07-01T22:00:00Z'))).toBe('2026-07-02')
  expect(() => isoDateIn('Mars/Base')).toThrow(RangeError)
})

test('a task without `done` is open, and Status leaves other types alone', () => {
  const pass = (row: { type: string; done?: boolean }, status: 'open' | 'done') =>
    matchesRowFilters(row, { status }, calendar)
  expect(pass({ type: 'task' }, 'open')).toBe(true)
  expect(pass({ type: 'task' }, 'done')).toBe(false)
  expect(pass({ type: 'note' }, 'done')).toBe(true)
})

test('a row that names no adder or day fails Who and When', () => {
  expect(matchesRowFilters({ type: 'note' }, { who: 'sam' }, calendar)).toBe(false)
  expect(matchesRowFilters({ type: 'note' }, { when: 'month' }, calendar)).toBe(false)
  expect(matchesRowFilters({ type: 'note' }, {}, calendar)).toBe(true)
})
