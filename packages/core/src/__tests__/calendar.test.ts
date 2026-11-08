import { describe, expect, test } from 'vitest'

import {
  agendaRows,
  filterCalendarEvents,
  initialsForPeople,
  marksForDate,
  normalizeCalendarEvent,
  orderCalendarEvents,
  validateCalendarFields,
  visibleMarksForDate,
} from '../calendar'

const event = (
  overrides: Partial<Parameters<typeof normalizeCalendarEvent>[0]> = {},
) =>
  normalizeCalendarEvent({
    id: 'event-1',
    calendarId: 'cal-1',
    title: 'Event',
    date: '2026-09-12',
    ...overrides,
  })

describe('calendar model', () => {
  test('validates real leap dates', () => {
    expect(
      validateCalendarFields({
        calendarId: 'c',
        title: 'x',
        date: '2024-02-29',
        allDay: true,
        assigneeIds: [],
      }),
    ).toEqual({})
    expect(
      validateCalendarFields({
        calendarId: 'c',
        title: 'x',
        date: '2023-02-29',
        allDay: true,
        assigneeIds: [],
      }).date,
    ).toBe('invalidDate')
  })

  test('normalizes legacy all-day, people, optional text and revision fields', () => {
    expect(
      normalizeCalendarEvent({
        id: 'e',
        calendarId: 'c',
        title: 'x',
        date: '2026-01-01',
      }),
    ).toMatchObject({
      allDay: true,
      assigneeIds: [],
      location: '',
      notes: '',
      revision: 0,
      color: 'home',
    })
  })

  test('validates times, limits, clears and duplicate people', () => {
    expect(
      validateCalendarFields({
        calendarId: 'c',
        title: 'x',
        date: '2026-01-01',
        allDay: false,
        startMinutes: 60,
        endMinutes: 60,
        assigneeIds: [],
      }).time,
    ).toBe('invalidTime')
    expect(
      validateCalendarFields({
        calendarId: 'c',
        title: 'x',
        date: '2026-01-01',
        allDay: false,
        startMinutes: 0,
        endMinutes: 1440,
        assigneeIds: [],
      }).time,
    ).toBe('invalidTime')
    expect(
      validateCalendarFields({
        calendarId: 'c',
        title: 'x',
        date: '2026-01-01',
        allDay: false,
        assigneeIds: [],
      }).time,
    ).toBe('timeRequired')
    expect(
      validateCalendarFields({
        calendarId: 'c',
        title: 'x'.repeat(201),
        date: '2026-01-01',
        allDay: true,
        assigneeIds: ['u', 'u'],
      }).assigneeIds,
    ).toBe('duplicateAssignee')
  })

  test('uses two initials when first initials collide', () => {
    expect([
      ...initialsForPeople([
        { id: '1', name: 'Eric' },
        { id: '2', name: 'Emma' },
        { id: '3', name: 'Sanne' },
      ]),
    ]).toEqual([
      ['1', 'ER'],
      ['2', 'EM'],
      ['3', 'S'],
    ])
  })

  test('counts one mark per person, including repeated appearances and overflow', () => {
    const events = [
      event({ id: 'a', assigneeIds: ['1', '2'] }),
      event({ id: 'b', assigneeIds: [] }),
      event({ id: 'c', assigneeIds: ['1'] }),
    ]
    expect(
      marksForDate('2026-09-12', events, [
        { id: '1', name: 'Eric' },
        { id: '2', name: 'Sanne' },
      ]),
    ).toHaveLength(4)
    expect(
      visibleMarksForDate(
        '2026-09-12',
        events,
        [
          { id: '1', name: 'Eric' },
          { id: '2', name: 'Sanne' },
        ],
        3,
      ).overflow,
    ).toBe(1)
  })

  test('filters calendars and people with intersection semantics', () => {
    const events = [
      event({ id: 'a', assigneeIds: ['u1'] }),
      event({ id: 'b', calendarId: 'hidden', assigneeIds: [] }),
      event({ id: 'c', assigneeIds: ['u2'] }),
    ]
    expect(
      filterCalendarEvents(events, ['hidden'], {
        userIds: ['u1'],
        includeUnassigned: true,
      }).map(({ id }) => id),
    ).toEqual(['a'])
    expect(
      filterCalendarEvents(events, [], {
        userIds: [],
        includeUnassigned: false,
      }),
    ).toEqual([])
  })

  test('orders all-day and timed events with stable title/id ties', () => {
    const events = [
      event({
        id: 'b',
        title: 'B',
        allDay: false,
        startMinutes: 30,
        endMinutes: 60,
      }),
      event({ id: 'a', title: 'A' }),
      event({ id: 'c', title: 'A' }),
    ]
    expect(orderCalendarEvents(events).map(({ id }) => id)).toEqual([
      'a',
      'c',
      'b',
    ])
  })

  test('renders short empty runs as days and long runs as a gap, splitting selection', () => {
    const rows = agendaRows(
      [event({ date: '2026-09-01' })],
      '2026-09-01',
      '2026-09-20',
      '2026-10-30',
      '2026-09-06',
    )
    expect(
      rows.some((row) => row.kind === 'day' && row.date === '2026-09-06'),
    ).toBe(true)
    expect(rows.filter((row) => row.kind === 'gap')).toHaveLength(1)
    expect(
      (rows.find((row) => row.kind === 'gap') as { dates: string[] }).dates,
    ).not.toContain('2026-09-06')
    expect(
      agendaRows([], '2026-09-01', '2026-09-05', '2026-10-30').every(
        (row) => row.kind === 'day',
      ),
    ).toBe(true)
  })

  test('keeps today visible inside a long empty run', () => {
    const rows = agendaRows([], '2026-09-01', '2026-09-30', '2026-09-15')
    expect(
      rows.some((row) => row.kind === 'day' && row.date === '2026-09-15'),
    ).toBe(true)
    expect(
      rows.flatMap((row) => (row.kind === 'gap' ? row.dates : [])),
    ).not.toContain('2026-09-15')
  })
})
