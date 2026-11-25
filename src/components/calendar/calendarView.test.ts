import { normalizeCalendarEvent } from '@gather/core/calendar'
import { todayIn } from '@gather/core/civil-date'
import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  agendaDays,
  agendaFrom,
  agendaRange,
  agendaStep,
  isReadOnlySource,
  monthsNeeded,
  monthTitle,
  monthWeeks,
  readSelection,
  readView,
  writeView,
} from './calendarView'

describe('monthWeeks', () => {
  test.each([
    // Monday 1 June 2026; Sunday 1 Nov 2026; February 2027 is four whole weeks.
    ['2026-06-15', 5, '2026-06-01', '2026-07-05'],
    ['2026-11-24', 6, '2026-10-26', '2026-12-06'],
    ['2026-12-31', 5, '2026-11-30', '2027-01-03'],
    ['2027-02-01', 4, '2027-02-01', '2027-02-28'],
  ])('%s takes %i Monday-first weeks', (day, weeks, first, last) => {
    const grid = monthWeeks(day)
    expect(grid).toHaveLength(weeks)
    expect(grid.every((week) => week.length === 7)).toBe(true)
    expect(grid[0][0]).toBe(first)
    expect(grid.at(-1)?.at(-1)).toBe(last)
  })

  test('today comes from the Group’s zone, not the browser’s', () => {
    const at = Date.parse('2026-11-30T23:30:00Z')
    expect(monthWeeks(todayIn('Europe/Amsterdam', at))[0][0]).toBe('2026-11-30')
    expect(monthWeeks(todayIn('America/New_York', at))[0][0]).toBe('2026-10-26')
  })
})

describe('readSelection', () => {
  test.each([
    [{}, {}],
    [{ day: '2026-11-24' }, { day: '2026-11-24' }],
    [{ day: '2026-02-30', event: 'e1' }, { event: 'e1' }],
    [{ day: 'x', event: '' }, {}],
    [{ day: 20261124, event: 4, new: true }, {}],
  ])('%o → %o', (search, expected) => {
    expect(readSelection(search)).toEqual(expected)
  })
})

test('every source but Gather’s own is read-only', () => {
  expect(isReadOnlySource('local')).toBe(false)
  expect(isReadOnlySource('ical')).toBe(true)
  expect(isReadOnlySource('')).toBe(true)
})

describe('the agenda', () => {
  const event = (id: string, date: string, startMinutes?: number) =>
    normalizeCalendarEvent({
      id,
      calendarId: 'c',
      title: id,
      date,
      ...(startMinutes === undefined
        ? {}
        : { startMinutes, endMinutes: startMinutes + 60 }),
    })

  test('runs to the end of the next month and steps by month', () => {
    expect(agendaRange('2026-11-24')).toEqual({
      from: '2026-11-24',
      toExclusive: '2027-01-01',
    })
    expect(agendaStep('2026-11-24', 1)).toBe('2026-12-01')
    expect(agendaStep('2026-11-24', -1)).toBe('2026-11-01')
    expect(agendaStep('2026-11-01', -1)).toBe('2026-10-01')
  })

  test('keeps its place while the selected day is in it', () => {
    expect(agendaFrom('2026-11-24', '2026-12-31')).toBe('2026-11-24')
    expect(agendaFrom('2026-11-24', '2027-01-01')).toBe('2027-01-01')
    expect(agendaFrom('2026-11-24', '2026-11-23')).toBe('2026-11-23')
  })

  test('shows days with events in order, and today even when empty', () => {
    const events = [
      event('late', '2026-11-27', 900),
      event('early', '2026-11-27', 600),
      event('allday', '2026-11-27'),
      event('before', '2026-11-23'),
      event('after', '2027-01-01'),
    ]
    expect(
      agendaDays(events, agendaRange('2026-11-24'), '2026-11-24').map((d) => [
        d.date,
        d.events.map(({ id }) => id),
      ]),
    ).toEqual([
      ['2026-11-24', []],
      ['2026-11-27', ['allday', 'early', 'late']],
    ])
  })
})

test('the months loaded cover the grid, today and the agenda', () => {
  expect(monthsNeeded('2026-03-31', '2026-11-24', '2026-03-01')).toEqual([
    '2026-02-01',
    '2026-03-01',
    '2026-04-01',
    '2026-11-01',
  ])
})

test('a month’s title starts with a capital in Dutch too', () => {
  expect(monthTitle('2026-11-24', 'nl')).toBe('November 2026')
})

describe('the remembered view', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  test('round-trips, and ignores anything else', () => {
    expect(readView()).toBeNull()
    writeView('week')
    expect(readView()).toBe('week')
    localStorage.setItem('gather:calendar-view', 'year')
    expect(readView()).toBeNull()
  })

  test('survives blocked storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => writeView('week')).not.toThrow()
    expect(readView()).toBeNull()
  })
})
