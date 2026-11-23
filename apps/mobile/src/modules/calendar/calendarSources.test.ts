import { normalizeCalendarEvent } from '@gather/core/calendar'
import { describe, expect, test } from 'vitest'

import {
  applySourceReport,
  isMonthLoaded,
  mergeSourceEvents,
} from './calendarSources'

const event = (id: string, calendarId: string, revision = 1) =>
  normalizeCalendarEvent({
    id,
    calendarId,
    title: id,
    date: '2026-11-19',
    allDay: true,
    revision,
  })

describe('mergeSourceEvents', () => {
  test('drops the events of a calendar that was deleted', () => {
    const sources = {
      'home:2026-11-01': [event('dinner', 'home')],
      'work:2026-11-01': [event('standup', 'work')],
      'work:2026-12-01': [event('review', 'work')],
    }

    expect(
      mergeSourceEvents(sources, ['home', 'work']).map((e) => e.id),
    ).toEqual(['dinner', 'standup', 'review'])
    expect(mergeSourceEvents(sources, ['home']).map((e) => e.id)).toEqual([
      'dinner',
    ])
  })

  test('keeps the newest revision when two sources report one event', () => {
    const merged = mergeSourceEvents(
      {
        'home:2026-10-01': [event('trip', 'home', 3)],
        'home:2026-11-01': [event('trip', 'home', 2)],
      },
      ['home'],
    )

    expect(merged).toHaveLength(1)
    expect(merged[0]?.revision).toBe(3)
  })
})

describe('applySourceReport', () => {
  test('keeps the last complete report while a source reloads', () => {
    const loaded = applySourceReport(
      {},
      'home:2026-11-01',
      [event('dinner', 'home')],
      true,
    )
    expect(applySourceReport(loaded, 'home:2026-11-01', [], false)).toBe(
      loaded,
    )
    expect(applySourceReport(loaded, 'home:2026-11-01', [], true)).toEqual({
      'home:2026-11-01': [],
    })
  })

  test('leaves a month unknown until its first complete report', () => {
    expect(applySourceReport({}, 'home:2026-12-01', [], false)).toEqual({})
  })
})

describe('isMonthLoaded', () => {
  const reported = {
    'home:2026-11-01': [],
    'work:2026-11-01': [],
    'home:2026-12-01': [],
  }

  test('needs every calendar to have reported the month', () => {
    expect(isMonthLoaded(reported, ['home', 'work'], '2026-11-01')).toBe(true)
    expect(isMonthLoaded(reported, ['home', 'work'], '2026-12-01')).toBe(false)
    expect(isMonthLoaded(reported, ['home'], '2026-12-01')).toBe(true)
  })

  test('knows nothing while the calendars load, and waits for none without any', () => {
    expect(isMonthLoaded(reported, null, '2026-11-01')).toBe(false)
    expect(isMonthLoaded({}, [], '2027-03-01')).toBe(true)
  })
})
