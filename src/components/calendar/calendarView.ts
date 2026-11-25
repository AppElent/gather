import {
  CALENDAR_VIEWS,
  type CalendarEvent,
  type CalendarView,
  orderCalendarEvents,
} from '@gather/core/calendar'
import {
  addDays,
  addMonths,
  compareIsoDates,
  isIsoDate,
  localMidnight,
  minutesToClock,
  mondayStart,
  monthStart,
  weekOf,
} from '@gather/core/civil-date'

/**
 * What the web's Calendar works out without a browser: the month's grid, what
 * the address selects, which stretch each view shows, and how days read.
 */

/**
 * The month holding a day, Monday first, in the five or six weeks it needs
 * (four for a February that starts on a Monday and has 28 days). Days of the
 * neighbouring months fill the first and last week.
 */
export function monthWeeks(value: string): string[][] {
  const first = monthStart(value)
  const next = addMonths(first, 1)
  const weeks: string[][] = []
  for (
    let monday = mondayStart(first);
    compareIsoDates(monday, next) < 0;
    monday = addDays(monday, 7)
  )
    weeks.push(weekOf(monday))
  return weeks
}

export const sameMonth = (a: string, b: string) =>
  monthStart(a) === monthStart(b)

/** What `/calendar` selects: `?day=2026-11-24&event=<id>`. */
export interface CalendarSelection {
  day?: string
  event?: string
}

/** Anything that is not a real day or an id is dropped, never shown. */
export function readSelection(
  search: Record<string, unknown>,
): CalendarSelection {
  return {
    ...(typeof search.day === 'string' && isIsoDate(search.day)
      ? { day: search.day }
      : {}),
    ...(typeof search.event === 'string' && search.event
      ? { event: search.event }
      : {}),
  }
}

/**
 * Only a calendar kept in Gather can be written to. Every other source (an
 * iCal subscription, APP-332) is read-only here.
 */
export function isReadOnlySource(source: string): boolean {
  return source !== 'local'
}

export interface AgendaRange {
  from: string
  toExclusive: string
}

/** The agenda from a day to the end of the month after it. */
export function agendaRange(from: string): AgendaRange {
  return { from, toExclusive: addMonths(monthStart(from), 2) }
}

/** The day an agenda moves to: a month boundary, back or on. */
export function agendaStep(from: string, step: 1 | -1): string {
  const first = monthStart(from)
  if (step === 1) return addMonths(first, 1)
  return from === first ? addMonths(first, -1) : first
}

/** The agenda keeps its place while a selected day is in it. */
export function agendaFrom(current: string, day: string): string {
  const { from, toExclusive } = agendaRange(current)
  return compareIsoDates(day, from) >= 0 &&
    compareIsoDates(day, toExclusive) < 0
    ? current
    : day
}

export interface AgendaDay {
  date: string
  events: CalendarEvent[]
}

/** The days in a range that have events, and today when it is in the range. */
export function agendaDays(
  events: readonly CalendarEvent[],
  { from, toExclusive }: AgendaRange,
  today: string,
): AgendaDay[] {
  const inRange = (date: string) =>
    compareIsoDates(date, from) >= 0 && compareIsoDates(date, toExclusive) < 0
  const byDate = new Map<string, CalendarEvent[]>()
  if (inRange(today)) byDate.set(today, [])
  for (const event of orderCalendarEvents(events))
    if (inRange(event.date))
      byDate.set(event.date, [...(byDate.get(event.date) ?? []), event])
  return [...byDate]
    .map(([date, dayEvents]) => ({ date, events: dayEvents }))
    .sort((a, b) => compareIsoDates(a.date, b.date))
}

export function eventsOn(
  events: readonly CalendarEvent[],
  date: string,
): CalendarEvent[] {
  return orderCalendarEvents(events.filter((event) => event.date === date))
}

/** The months whose events the page needs, each by its first day. */
export function monthsNeeded(
  day: string,
  today: string,
  agenda: string,
): string[] {
  const anchor = monthStart(day)
  return [
    ...new Set([
      addMonths(anchor, -1),
      anchor,
      addMonths(anchor, 1),
      monthStart(today),
      monthStart(agenda),
      addMonths(monthStart(agenda), 1),
    ]),
  ].sort()
}

const VIEW_KEY = 'gather:calendar-view'

/** The view this browser last chose, or null. */
export function readView(): CalendarView | null {
  try {
    const stored = window.localStorage.getItem(VIEW_KEY)
    return CALENDAR_VIEWS.find((view) => view === stored) ?? null
  } catch {
    return null
  }
}

export function writeView(view: CalendarView): void {
  try {
    window.localStorage.setItem(VIEW_KEY, view)
  } catch {
    // Blocked storage: the choice holds until the page is left.
  }
}

/** Only the first letter: Dutch writes days and months in lowercase. */
const heading = (text: string, locale: string) =>
  text.charAt(0).toLocaleUpperCase(locale) + text.slice(1)

const format = (
  date: string,
  locale: string,
  options: Intl.DateTimeFormatOptions,
) => localMidnight(date).toLocaleDateString(locale, options)

/** "November 2026" */
export const monthTitle = (date: string, locale: string) =>
  heading(format(date, locale, { month: 'long', year: 'numeric' }), locale)

/** "Dinsdag 24 november" */
export const dayTitle = (date: string, locale: string) =>
  heading(
    format(date, locale, { weekday: 'long', day: 'numeric', month: 'long' }),
    locale,
  )

/** "dinsdag 24 nov", a section's label. */
export const daySection = (date: string, locale: string) =>
  format(date, locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  }).replace(/\./g, '')

export const daySectionHeading = (date: string, locale: string) =>
  heading(daySection(date, locale), locale)

export const weekdayShort = (date: string, locale: string) =>
  format(date, locale, { weekday: 'short' }).replace(/\./g, '')

/** "23 – 29 nov 2026" */
export function weekTitle(date: string, locale: string): string {
  const days = weekOf(date)
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).formatRange(localMidnight(days[0]), localMidnight(days[6]))
}

/** "08:30–09:00", or the words for an all-day event. */
export function eventTime(event: CalendarEvent, allDay: string): string {
  if (
    event.allDay ||
    event.startMinutes === undefined ||
    event.endMinutes === undefined
  )
    return allDay
  return `${minutesToClock(event.startMinutes)}–${minutesToClock(event.endMinutes)}`
}

/** "08:30", or the words for an all-day event: a row's time column. */
export function eventStart(event: CalendarEvent, allDay: string): string {
  return event.allDay || event.startMinutes === undefined
    ? allDay
    : minutesToClock(event.startMinutes)
}
