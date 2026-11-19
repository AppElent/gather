import { normalizeCalendarEvent } from '@gather/core/calendar'
import { describe, expect, test } from 'vitest'

import { mergeSourceEvents } from './calendarSources'

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
