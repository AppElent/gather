/**
 * What a calendar cell and an agenda are, with no React in them.
 *
 * Two of the canvas's three decisions are arithmetic rather than drawing, and
 * this is where they live so a test can ask about them:
 *
 * - **A cell says WHO.** Up to three marks: an initial in a circle tinted by
 *   its calendar for each person on an event, and — for an event nobody is on —
 *   a dot in the calendar's colour. Overflow is counted in *marks*, not events,
 *   because a two-person event is two marks and calling that one is what makes
 *   a `+n` wrong.
 * - **An agenda skips empty days and keeps empty weeks.** A day with nothing on
 *   it is not a row; a whole week with nothing on it is a fact about the month
 *   and gets said, or the reader is left wondering whether the list is broken.
 *
 * Everything takes a `YYYY-MM-DD` string and never an instant.
 */
import { addDays, daysBetween, parseDay } from '../../modules/tasks/taskDates'
import type { LabEvent, LabMember } from './fixtures'

/** The ceiling the canvas set. Three marks, then a count. */
export const MAX_MARKS = 3

export type Mark =
  | { kind: 'person'; key: string; initial: string; calendarId: string }
  | { kind: 'nobody'; key: string; calendarId: string }

export interface CellMarks {
  marks: Mark[]
  /** Marks that did not fit. Zero where everything did. */
  overflow: number
}

export function visibleEvents(
  events: LabEvent[],
  hiddenCalendarIds: readonly string[],
): LabEvent[] {
  return events.filter((event) => !hiddenCalendarIds.includes(event.calendarId))
}

export function eventsOn(events: LabEvent[], iso: string): LabEvent[] {
  return events.filter((event) => event.date === iso).sort(sortWithinADay)
}

/**
 * All-day first, then by start time, then by title.
 *
 * All-day first because it is the frame the rest of the day sits inside — "Big
 * shop" is not competing with the 16:00 swimming lesson for a slot, it is the
 * shape of the whole day.
 */
export function sortWithinADay(a: LabEvent, b: LabEvent): number {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1
  const byStart = (a.start ?? '').localeCompare(b.start ?? '')
  return byStart !== 0 ? byStart : a.title.localeCompare(b.title)
}

/**
 * The marks for one day.
 *
 * The loop stops at three and then keeps counting, because the count has to
 * include the marks it never built — a `+n` derived from the events it managed
 * to draw would be a `+n` that lies.
 */
export function cellMarks(
  dayEvents: LabEvent[],
  members: LabMember[],
): CellMarks {
  const marks: Mark[] = []
  let total = 0

  for (const event of dayEvents) {
    if (event.who.length === 0) {
      total += 1
      if (marks.length < MAX_MARKS) {
        marks.push({
          kind: 'nobody',
          key: `${event.id}-nobody`,
          calendarId: event.calendarId,
        })
      }
      continue
    }
    for (const memberId of event.who) {
      total += 1
      if (marks.length >= MAX_MARKS) continue
      const member = members.find((each) => each.id === memberId)
      marks.push({
        kind: 'person',
        key: `${event.id}-${memberId}`,
        initial: member?.initial ?? '?',
        calendarId: event.calendarId,
      })
    }
  }

  return { marks, overflow: Math.max(0, total - marks.length) }
}

export interface AgendaDay {
  kind: 'day'
  key: string
  iso: string
  events: LabEvent[]
}

export interface AgendaGap {
  kind: 'gap'
  key: string
  /** The first day of the run with nothing on it, for the label. */
  from: string
  days: number
}

export type AgendaRow = AgendaDay | AgendaGap

/**
 * The days from `from` for `span` days that have anything on them — with a
 * marker where a whole week went by and none did.
 *
 * Seven is the threshold rather than "any gap" because a two-day gap between
 * Friday and Monday is what a week looks like and saying so on every weekend
 * would be noise. A gap of seven or more is the thing the canvas could not
 * draw: a stretch of calendar where a household simply has nothing arranged.
 */
export function agendaRows(
  events: LabEvent[],
  from: string,
  span: number,
): AgendaRow[] {
  const rows: AgendaRow[] = []
  let gapFrom: string | null = null
  let gapDays = 0

  const flushGap = () => {
    if (gapFrom !== null && gapDays >= 7) {
      rows.push({
        kind: 'gap',
        key: `gap-${gapFrom}`,
        from: gapFrom,
        days: gapDays,
      })
    }
    gapFrom = null
    gapDays = 0
  }

  for (let index = 0; index < span; index++) {
    const iso = addDays(from, index)
    const onThisDay = eventsOn(events, iso)
    if (onThisDay.length === 0) {
      if (gapFrom === null) gapFrom = iso
      gapDays += 1
      continue
    }
    flushGap()
    rows.push({ kind: 'day', key: iso, iso, events: onThisDay })
  }
  flushGap()

  return rows
}

/**
 * How an event's time reads on a row: the word for an all-day, the range where
 * there is one, and the start on its own where there is not.
 */
export function timeLabel(event: LabEvent, allDayWord: string): string {
  if (event.allDay) return allDayWord
  if (event.end) return `${event.start}–${event.end}`
  return event.start ?? ''
}

/**
 * The heading over a day in the agenda — "TODAY · WEDNESDAY 2 SEPTEMBER".
 *
 * The locale is the app's, never the device's (ADR-0011), and it is passed in
 * rather than read, so this stays callable from a test with no React tree.
 */
export function dayHeading(
  iso: string,
  today: string,
  locale: string,
  words: { today: string },
): string {
  const long = parseDay(iso).toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  return daysBetween(today, iso) === 0
    ? `${words.today} · ${long}`.toUpperCase()
    : long.toUpperCase()
}
