import { normalizeCalendarEvent } from '@gather/core/calendar'
import { describe, expect, test } from 'vitest'
import {
  type CalendarDraftState,
  calendarSaveBlocker,
  createCalendarDraft,
  draftCanSave,
  draftPayload,
  editCalendarDraft,
  reduceCalendarDraft,
  restoreCalendarDraft,
  serializeCalendarDraft,
} from './calendarDraft'

const event = normalizeCalendarEvent({
  id: 'event-1',
  calendarId: 'calendar-1',
  title: 'Dentist',
  date: '2026-09-12',
  allDay: false,
  startMinutes: 540,
  endMinutes: 600,
  assigneeIds: ['person-1'],
  location: 'Town',
  notes: 'Bring card',
  revision: 2,
})

describe('calendar drafts', () => {
  test('changes and dismissals do not call a backend and retain all fields', () => {
    let state: CalendarDraftState = {
      draft: null,
      presentation: 'card',
      storageError: null,
    }
    state = reduceCalendarDraft(state, {
      type: 'open',
      draft: editCalendarDraft('user', 'group', event),
    })
    state = reduceCalendarDraft(state, {
      type: 'change',
      field: 'title',
      value: 'New dentist',
    })
    state = reduceCalendarDraft(state, { type: 'dismiss' })
    expect(state.draft).toMatchObject({
      status: 'dismissed',
      values: { title: 'New dentist', location: 'Town', notes: 'Bring card' },
    })
    // Resuming has to make it editable again, or the editor stays hidden.
    state = reduceCalendarDraft(state, { type: 'resume' })
    expect(state.draft).toMatchObject({
      status: 'editing',
      values: { title: 'New dentist' },
    })
  })

  test('only dirty valid connected drafts can save and all-day clears times', () => {
    const draft = createCalendarDraft(
      'user',
      'group',
      '2026-09-12',
      'calendar-1',
    )
    expect(draftCanSave(draft, true, false)).toBe(false)
    const changed = reduceCalendarDraft(
      { draft, presentation: 'card', storageError: null },
      { type: 'change', field: 'title', value: 'Party' },
    ).draft!
    const timed = reduceCalendarDraft(
      { draft: changed, presentation: 'card', storageError: null },
      { type: 'change', field: 'allDay', value: false },
    ).draft!
    const withTime = reduceCalendarDraft(
      reduceCalendarDraft(
        { draft: timed, presentation: 'card', storageError: null },
        { type: 'change', field: 'startMinutes', value: 60 },
      ),
      { type: 'change', field: 'endMinutes', value: 120 },
    ).draft!
    expect(draftCanSave(withTime, true, false)).toBe(true)
    const allDay = reduceCalendarDraft(
      { draft: withTime, presentation: 'card', storageError: null },
      { type: 'change', field: 'allDay', value: true },
    ).draft!
    expect(draftPayload(allDay)).toMatchObject({
      startMinutes: null,
      endMinutes: null,
    })
  })

  test('reports connection loss instead of silently refusing a dirty save', () => {
    const draft = createCalendarDraft(
      'user',
      'group',
      '2026-09-12',
      'calendar-1',
    )
    const dirty = reduceCalendarDraft(
      { draft, presentation: 'card', storageError: null },
      { type: 'change', field: 'title', value: 'Party' },
    ).draft!

    expect(calendarSaveBlocker(dirty, false, false)).toBe('calendar:offline')
    expect(calendarSaveBlocker(dirty, true, false)).toBeNull()
  })

  test('guards one in-flight submit and preserves failed/conflict states', () => {
    const draft = createCalendarDraft(
      'user',
      'group',
      '2026-09-12',
      'calendar-1',
    )
    const base = {
      draft: reduceCalendarDraft(
        { draft, presentation: 'card', storageError: null },
        { type: 'change', field: 'title', value: 'Party' },
      ).draft!,
      presentation: 'card' as const,
      storageError: null,
    }
    expect(reduceCalendarDraft(base, { type: 'saveStart' }).draft?.status).toBe(
      'saving',
    )
    expect(
      reduceCalendarDraft(base, { type: 'saveFailure', error: 'network' }).draft
        ?.error,
    ).toBe('network')
    expect(
      reduceCalendarDraft(base, { type: 'conflict', error: 'conflict' }).draft
        ?.status,
    ).toBe('conflict')
  })

  test('serializes and rejects cross-user, cross-group and unknown drafts', () => {
    const draft = createCalendarDraft(
      'user',
      'group',
      '2026-09-12',
      'calendar-1',
    )
    const raw = serializeCalendarDraft(draft)
    expect(restoreCalendarDraft(raw, 'user', 'group')).toMatchObject({
      userId: 'user',
      groupId: 'group',
    })
    expect(() => restoreCalendarDraft(raw, 'other', 'group')).toThrow()
    expect(() => restoreCalendarDraft(raw, 'user', 'other')).toThrow()
    expect(() =>
      restoreCalendarDraft('{"version":99}', 'user', 'group'),
    ).toThrow()
  })
})
