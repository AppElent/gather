import { describe, expect, test } from 'vitest'

import { validateDraft } from './calendarDraft'
import {
  composedEvent,
  defaultStart,
  type EventDraft,
  emptyEventDraft,
  isEventDirty,
  nextEventDraft,
  presetCalendar,
  timedFrom,
  toCalendarDraft,
  whoLabel,
  withEnd,
  withStart,
} from './eventComposerDraft'

const preset = { calendarId: 'cal-family', date: '2026-11-28' }
const draft = (patch: Partial<EventDraft> = {}): EventDraft => ({
  ...emptyEventDraft(preset, 'composer-key-1'),
  ...patch,
})

describe('event composer draft', () => {
  test('opens on the place’s calendar and day, with Time unset', () => {
    expect(emptyEventDraft(preset, 'composer-key-1')).toMatchObject({
      calendarId: 'cal-family',
      date: '2026-11-28',
      time: null,
      assigneeIds: [],
      saveKey: 'composer-key-1',
    })
  })

  test('is kept on close only when something was typed or chosen', () => {
    expect(isEventDirty(draft(), preset)).toBe(false)
    expect(isEventDirty(draft({ calendarId: 'cal-work' }), preset)).toBe(false)
    expect(isEventDirty(draft({ showNotes: true }), preset)).toBe(false)
    expect(isEventDirty(draft({ title: ' Zwemles ' }), preset)).toBe(true)
    expect(isEventDirty(draft({ time: { allDay: true } }), preset)).toBe(true)
    expect(isEventDirty(draft({ date: '2026-11-29' }), preset)).toBe(true)
    expect(isEventDirty(draft({ assigneeIds: ['u1'] }), preset)).toBe(true)
    expect(isEventDirty(draft({ location: 'Bij oma' }), preset)).toBe(true)
  })

  test('needs a title and a calendar to save', () => {
    expect(composedEvent(draft())).toBeNull()
    expect(composedEvent(draft({ title: '   ' }))).toBeNull()
    expect(composedEvent(draft({ title: 'Zwemles', calendarId: null }))).toBeNull()
    expect(composedEvent(draft({ title: 'x'.repeat(201) }))).toBeNull()
  })

  test('saves an unset Time as all day', () => {
    expect(composedEvent(draft({ title: ' Verjaardag oma ' }))).toEqual({
      calendarId: 'cal-family',
      title: 'Verjaardag oma',
      date: '2026-11-28',
      allDay: true,
      startMinutes: null,
      endMinutes: null,
      assigneeIds: [],
      location: '',
      notes: '',
    })
  })

  test('saves a time range with who, location and note', () => {
    expect(
      composedEvent(
        draft({
          title: 'Zwemles',
          time: { allDay: false, start: 990, end: 1035 },
          assigneeIds: ['u1', 'u2'],
          location: ' Zwembad ',
          notes: ' Handdoek mee \n',
        }),
      ),
    ).toMatchObject({
      allDay: false,
      startMinutes: 990,
      endMinutes: 1035,
      assigneeIds: ['u1', 'u2'],
      location: 'Zwembad',
      notes: 'Handdoek mee',
    })
  })

  test('after a save: empty, a new key, the calendar just used and the place’s day', () => {
    const saved = draft({
      title: 'Zwemles',
      calendarId: 'cal-work',
      date: '2026-12-01',
      time: { allDay: true },
      assigneeIds: ['u1'],
      location: 'Zwembad',
      notes: 'Handdoek',
      showNotes: true,
    })
    const next = nextEventDraft(saved, preset)
    expect(next).toMatchObject({
      title: '',
      calendarId: 'cal-work',
      date: '2026-11-28',
      time: null,
      assigneeIds: [],
      location: '',
      notes: '',
      showNotes: false,
    })
    expect(next.saveKey).not.toBe(saved.saveKey)
    expect(next.saveKey.length).toBeGreaterThanOrEqual(8)
  })

  test('All details hands over everything, keyed by the composer’s key', () => {
    const handed = toCalendarDraft(
      draft({
        title: 'Zwemles ',
        time: { allDay: false, start: 990, end: 1035 },
        assigneeIds: ['u1'],
        location: 'Zwembad',
        notes: 'Handdoek',
      }),
      'user-1',
      'group-1',
    )
    expect(handed).toMatchObject({
      draftId: 'composer-key-1',
      userId: 'user-1',
      groupId: 'group-1',
      mode: 'create',
      status: 'editing',
      values: {
        calendarId: 'cal-family',
        title: 'Zwemles ',
        date: '2026-11-28',
        allDay: false,
        startMinutes: 990,
        endMinutes: 1035,
        assigneeIds: ['u1'],
        location: 'Zwembad',
        notes: 'Handdoek',
      },
    })
    expect(validateDraft(handed)).toEqual({})
  })

  test('an unset Time reaches the editor as all day', () => {
    expect(toCalendarDraft(draft(), 'u', 'g').values).toMatchObject({
      allDay: true,
      startMinutes: null,
      endMinutes: null,
    })
  })
})

describe('event composer time', () => {
  test('starts on the next whole hour today, nine on another day', () => {
    expect(defaultStart('2026-11-28', '2026-11-28', 14)).toBe(15 * 60)
    expect(defaultStart('2026-11-29', '2026-11-28', 14)).toBe(9 * 60)
    expect(defaultStart('2026-11-28', '2026-11-28', 23)).toBe(23 * 60)
  })

  test('the end defaults to an hour after the start, within the day', () => {
    expect(timedFrom(9 * 60)).toEqual({ allDay: false, start: 540, end: 600 })
    expect(timedFrom(23 * 60 + 30)).toEqual({
      allDay: false,
      start: 1410,
      end: 1439,
    })
  })

  test('a new start keeps the length; a new end before the start moves the start', () => {
    const range = { allDay: false as const, start: 540, end: 630 }
    expect(withStart(range, 600)).toEqual({ allDay: false, start: 600, end: 690 })
    expect(withEnd(range, 700)).toEqual({ allDay: false, start: 540, end: 700 })
    expect(withEnd(range, 500)).toEqual({ allDay: false, start: 440, end: 500 })
    expect(withStart({ allDay: true }, 600)).toEqual({
      allDay: false,
      start: 600,
      end: 660,
    })
  })
})

describe('event composer chips', () => {
  const people = [
    { id: 'u1', name: 'Daan' },
    { id: 'u2', name: 'Sanne' },
    { id: 'u3', name: 'Eva' },
  ]
  const words = { who: 'Wie', everyone: 'Iedereen' }

  test('Who reads nobody, one name, a count, or everyone', () => {
    expect(whoLabel([], people, words)).toBeNull()
    expect(whoLabel(['u2'], people, words)).toBe('Sanne')
    expect(whoLabel(['u1', 'u3'], people, words)).toBe('Daan +1')
    expect(whoLabel(['u1', 'u2', 'u3'], people, words)).toBe('Iedereen')
    expect(whoLabel(['u1'], [people[0]!], words)).toBe('Daan')
    expect(whoLabel(['gone'], people, words)).toBe('Wie')
  })

  test('the calendar is the last used while it exists, else the first by name', () => {
    const calendars = [
      { id: 'b', name: 'Werk' },
      { id: 'a', name: 'Gezin' },
    ]
    expect(presetCalendar(calendars, 'b')).toBe('b')
    expect(presetCalendar(calendars, 'deleted')).toBe('a')
    expect(presetCalendar(calendars, undefined)).toBe('a')
    expect(presetCalendar([], undefined)).toBeNull()
  })
})
