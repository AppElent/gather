import { describe, expect, test } from 'vitest'

import { addDays, monthGrid, monthOf } from '../../modules/tasks/taskDates'
import {
  LAB_HIDDEN_CALENDAR_IDS,
  LAB_MEMBERS,
  type LabEvent,
  labEvents,
} from './fixtures'
import {
  agendaRows,
  cellMarks,
  dayHeading,
  eventsOn,
  timeLabel,
  visibleEvents,
} from './model'

const TODAY = '2026-09-02'
const all = labEvents(TODAY)
const shown = visibleEvents(all, LAB_HIDDEN_CALENDAR_IDS)

const event = (over: Partial<LabEvent> = {}): LabEvent => ({
  id: 'x',
  date: TODAY,
  title: 'Something',
  calendarId: 'household',
  allDay: false,
  who: [],
  ...over,
})

describe('the fixtures', () => {
  test('put today’s events on today, whatever day that is', () => {
    expect(eventsOn(all, TODAY)).toHaveLength(3)
    expect(eventsOn(all, addDays(TODAY, 1))).toHaveLength(1)
  })

  test('hide a whole calendar, and hiding it is visible on today', () => {
    expect(eventsOn(all, TODAY).map((e) => e.calendarId)).toContain('work')
    expect(eventsOn(shown, TODAY).map((e) => e.calendarId)).not.toContain(
      'work',
    )
  })

  test('carry an event nobody is on, which is the common case', () => {
    expect(shown.filter((e) => e.who.length === 0).length).toBeGreaterThan(0)
  })

  test('carry an all-day event and a title too long for a row', () => {
    expect(shown.some((e) => e.allDay)).toBe(true)
    expect(shown.some((e) => e.title.length > 60)).toBe(true)
  })

  test('leave a stretch long enough to guarantee an empty grid row', () => {
    // Sixteen clear days beats the seven a week needs, whatever weekday the
    // month starts on — which is the property, not the particular month.
    for (let offset = 3; offset <= 18; offset++) {
      expect(eventsOn(shown, addDays(TODAY, offset))).toEqual([])
    }
  })

  test('put three events across two calendars on one day', () => {
    const busy = eventsOn(shown, addDays(TODAY, 2))
    expect(busy).toHaveLength(3)
    expect(new Set(busy.map((e) => e.calendarId)).size).toBe(2)
  })

  test('stay honest on a month that starts on a Sunday', () => {
    const sunday = labEvents('2026-11-01')
    expect(eventsOn(sunday, '2026-11-01')).toHaveLength(3)
    // The day before today falls in the previous month, which is the point:
    // an agenda has to survive a fixture crossing a boundary.
    expect(eventsOn(sunday, '2026-10-31')).toHaveLength(1)
  })
})

describe('sorting a day', () => {
  test('puts an all-day event above the times it frames', () => {
    const day = eventsOn(
      [
        event({ id: 'a', start: '09:00' }),
        event({ id: 'b', allDay: true }),
        event({ id: 'c', start: '08:00' }),
      ],
      TODAY,
    )
    expect(day.map((e) => e.id)).toEqual(['b', 'c', 'a'])
  })
})

describe('the marks on a cell', () => {
  test('is an initial per person, tinted by the event’s calendar', () => {
    const { marks, overflow } = cellMarks(
      [event({ who: ['eric', 'sanne'], calendarId: 'school' })],
      LAB_MEMBERS,
    )
    expect(overflow).toBe(0)
    expect(marks).toEqual([
      { kind: 'person', key: 'x-eric', initial: 'E', calendarId: 'school' },
      { kind: 'person', key: 'x-sanne', initial: 'S', calendarId: 'school' },
    ])
  })

  test('is a dot when nobody is on the event — the common case, not an edge one', () => {
    const { marks } = cellMarks([event({ who: [] })], LAB_MEMBERS)
    expect(marks).toEqual([
      { kind: 'nobody', key: 'x-nobody', calendarId: 'household' },
    ])
  })

  test('counts overflow in marks, so a two-person event is two', () => {
    const { marks, overflow } = cellMarks(
      [
        event({ id: 'a', who: ['eric', 'sanne'] }),
        event({ id: 'b', who: ['mila'] }),
        event({ id: 'c', who: ['eric', 'sanne'] }),
      ],
      LAB_MEMBERS,
    )
    expect(marks).toHaveLength(3)
    // Five marks in total, three drawn: an overflow counted in events would
    // have said +1 here and been wrong by one.
    expect(overflow).toBe(2)
  })

  test('keeps counting past the ceiling rather than counting what it drew', () => {
    const { overflow } = cellMarks(
      [
        event({ id: 'a', who: ['eric', 'sanne', 'mila'] }),
        event({ id: 'b', who: [] }),
      ],
      LAB_MEMBERS,
    )
    expect(overflow).toBe(1)
  })

  test('draws a member it cannot name rather than nothing', () => {
    const { marks } = cellMarks([event({ who: ['ghost'] })], LAB_MEMBERS)
    expect(marks[0]).toMatchObject({ kind: 'person', initial: '?' })
  })
})

describe('the agenda', () => {
  test('skips a day with nothing on it', () => {
    const rows = agendaRows(shown, TODAY, 4)
    expect(rows.map((row) => row.kind)).toEqual(['day', 'day', 'day'])
  })

  test('says so when a whole week goes by with nothing arranged', () => {
    const rows = agendaRows(shown, TODAY, 25)
    const gap = rows.find((row) => row.kind === 'gap')
    expect(gap).toMatchObject({
      kind: 'gap',
      from: addDays(TODAY, 3),
      days: 16,
    })
  })

  test('does not call a weekend a gap', () => {
    const rows = agendaRows(
      [event({ date: TODAY }), event({ id: 'y', date: addDays(TODAY, 3) })],
      TODAY,
      4,
    )
    expect(rows.every((row) => row.kind === 'day')).toBe(true)
  })

  test('reports a trailing empty stretch, so the list ends on a statement', () => {
    const rows = agendaRows([event({ date: TODAY })], TODAY, 10)
    expect(rows.at(-1)).toMatchObject({ kind: 'gap', days: 9 })
  })
})

describe('how a row reads', () => {
  test('says the word for an all-day, a range where there is one, a start where there is not', () => {
    expect(timeLabel(event({ allDay: true }), 'all-day')).toBe('all-day')
    expect(timeLabel(event({ start: '14:30', end: '15:15' }), 'all-day')).toBe(
      '14:30–15:15',
    )
    expect(timeLabel(event({ start: '15:00' }), 'all-day')).toBe('15:00')
  })

  test('names today in the reader’s language and nowhere else', () => {
    // The day order is the locale's own — `en` is US-ordered, `nl` is not —
    // because the app's locale decides, never the device's (ADR-0011).
    expect(dayHeading(TODAY, TODAY, 'en', { today: 'Today' })).toBe(
      'TODAY · WEDNESDAY, SEPTEMBER 2',
    )
    expect(dayHeading(addDays(TODAY, 1), TODAY, 'en', { today: 'Today' })).toBe(
      'THURSDAY, SEPTEMBER 3',
    )
    expect(dayHeading(TODAY, TODAY, 'nl', { today: 'Vandaag' })).toBe(
      'VANDAAG · WOENSDAG 2 SEPTEMBER',
    )
  })
})

describe('the grid the screen draws', () => {
  test('always offers six rows, which is what the sheet needs', () => {
    expect(monthGrid(2026, 8).weeks).toHaveLength(6)
  })

  test('has a trailing empty row a full screen should drop', () => {
    // September 2026 is the month the canvas drew, and the row it argued about.
    expect(monthGrid(2026, 8).weeks[5].every((day) => day === null)).toBe(true)
    expect(monthOf(TODAY)).toEqual({ year: 2026, month: 8 })
  })
})
