import type { ModuleGroup } from './modules'

export type CalendarView = 'month' | 'week' | 'agenda'
export type CalendarColor = ModuleGroup

export interface CalendarEventInput {
  id: string
  calendarId: string
  title: string
  date: string
  startMinutes?: number
  endMinutes?: number
  allDay?: boolean
  assigneeIds?: readonly string[]
  location?: string
  notes?: string
  revision?: number
  calendarName?: string
  color?: CalendarColor
}

export interface CalendarEvent extends CalendarEventInput {
  allDay: boolean
  assigneeIds: string[]
  location: string
  notes: string
  revision: number
  color: CalendarColor
}

export interface CalendarPerson {
  id: string
  name: string
}

export interface CalendarPeopleFilter {
  userIds: readonly string[]
  includeUnassigned: boolean
}

export type CalendarValidationKey =
  | 'calendarRequired'
  | 'titleRequired'
  | 'titleTooLong'
  | 'invalidDate'
  | 'timeRequired'
  | 'invalidTime'
  | 'locationTooLong'
  | 'notesTooLong'
  | 'duplicateAssignee'

export interface CalendarFieldErrors {
  calendarId?: CalendarValidationKey
  title?: CalendarValidationKey
  date?: CalendarValidationKey
  time?: CalendarValidationKey
  location?: CalendarValidationKey
  notes?: CalendarValidationKey
  assigneeIds?: CalendarValidationKey
}

export interface CalendarFieldValues {
  calendarId?: string | null
  title: string
  date: string
  allDay: boolean
  startMinutes?: number | null
  endMinutes?: number | null
  assigneeIds: readonly string[]
  location?: string | null
  notes?: string | null
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

function parts(value: string) {
  const match = ISO_DATE.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    return null
  }
  return { year, month, day }
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function iso(year: number, month: number, day: number) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function dateNumber(value: string) {
  const parsed = parts(value)
  return parsed ? Date.UTC(parsed.year, parsed.month - 1, parsed.day) : NaN
}

export function isValidCivilDate(value: string): boolean {
  return parts(value) !== null
}

/** Date arithmetic deliberately uses UTC midnight, never a local timestamp. */
export function addCalendarDays(value: string, amount: number): string {
  const parsed = parts(value)
  if (!parsed) return value
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day))
  date.setUTCDate(date.getUTCDate() + Math.trunc(amount))
  return iso(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
}

export function addCalendarMonths(value: string, amount: number): string {
  const parsed = parts(value)
  if (!parsed) return value
  const target = parsed.year * 12 + parsed.month - 1 + Math.trunc(amount)
  const year = Math.floor(target / 12)
  const month = (((target % 12) + 12) % 12) + 1
  return iso(year, month, Math.min(parsed.day, daysInMonth(year, month)))
}

export function compareCalendarDates(a: string, b: string): number {
  return dateNumber(a) - dateNumber(b)
}

export function todayCalendarDate(now = new Date()): string {
  return iso(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

export function monthStart(value: string): string {
  const parsed = parts(value)
  return parsed ? iso(parsed.year, parsed.month, 1) : value
}

export function mondayStart(value: string): string {
  const parsed = parts(value)
  if (!parsed) return value
  const weekday = new Date(
    Date.UTC(parsed.year, parsed.month - 1, parsed.day),
  ).getUTCDay()
  return addCalendarDays(value, -((weekday + 6) % 7))
}

export function calendarWeek(value: string): string[] {
  const start = mondayStart(value)
  return Array.from({ length: 7 }, (_, index) => addCalendarDays(start, index))
}

export function calendarMonthGrid(value: string): (string | null)[][] {
  const first = monthStart(value)
  const parsed = parts(first)
  if (!parsed) return []
  const start = mondayStart(first)
  const last = iso(
    parsed.year,
    parsed.month,
    daysInMonth(parsed.year, parsed.month),
  )
  const cells = Array.from({ length: 42 }, (_, index) =>
    addCalendarDays(start, index),
  )
  return Array.from({ length: 6 }, (_, row) =>
    cells.slice(row * 7, row * 7 + 7).map((day) => {
      if (
        compareCalendarDates(day, first) < 0 ||
        compareCalendarDates(day, last) > 0
      )
        return null
      return day
    }),
  )
}

export function normalizeCalendarEvent(
  input: CalendarEventInput,
): CalendarEvent {
  const hasTime =
    input.startMinutes !== undefined && input.endMinutes !== undefined
  return {
    ...input,
    allDay: input.allDay ?? !hasTime,
    assigneeIds: [...new Set(input.assigneeIds ?? [])],
    location: input.location ?? '',
    notes: input.notes ?? '',
    revision: input.revision ?? 0,
    color: input.color ?? 'home',
  }
}

export function validateCalendarFields(
  values: CalendarFieldValues,
): CalendarFieldErrors {
  const errors: CalendarFieldErrors = {}
  if (!values.calendarId) errors.calendarId = 'calendarRequired'
  if (!values.title.trim()) errors.title = 'titleRequired'
  else if (values.title.trim().length > 200) errors.title = 'titleTooLong'
  if (!isValidCivilDate(values.date)) errors.date = 'invalidDate'
  if (!values.allDay) {
    if (values.startMinutes == null || values.endMinutes == null)
      errors.time = 'timeRequired'
    else if (
      !Number.isInteger(values.startMinutes) ||
      !Number.isInteger(values.endMinutes) ||
      values.startMinutes < 0 ||
      values.startMinutes >= values.endMinutes ||
      values.endMinutes >= 1440
    ) {
      errors.time = 'invalidTime'
    }
  }
  if ((values.location ?? '').length > 500) errors.location = 'locationTooLong'
  if ((values.notes ?? '').length > 10_000) errors.notes = 'notesTooLong'
  if (new Set(values.assigneeIds).size !== values.assigneeIds.length) {
    errors.assigneeIds = 'duplicateAssignee'
  }
  return errors
}

export function hasCalendarErrors(errors: CalendarFieldErrors): boolean {
  return Object.keys(errors).length > 0
}

export function eventMatchesPeopleFilter(
  event: CalendarEvent,
  filter: CalendarPeopleFilter | null,
): boolean {
  if (!filter) return true
  if (filter.userIds.length === 0 && !filter.includeUnassigned) return false
  return (
    (filter.includeUnassigned && event.assigneeIds.length === 0) ||
    event.assigneeIds.some((id) => filter.userIds.includes(id))
  )
}

export function filterCalendarEvents(
  events: readonly CalendarEvent[],
  hiddenCalendarIds: readonly string[],
  peopleFilter: CalendarPeopleFilter | null,
): CalendarEvent[] {
  const hidden = new Set(hiddenCalendarIds)
  return events.filter(
    (event) =>
      !hidden.has(event.calendarId) &&
      eventMatchesPeopleFilter(event, peopleFilter),
  )
}

export function orderCalendarEvents(
  events: readonly CalendarEvent[],
): CalendarEvent[] {
  return [...events].sort((a, b) => {
    const date = compareCalendarDates(a.date, b.date)
    if (date !== 0) return date
    const allDay = Number(b.allDay) - Number(a.allDay)
    if (allDay !== 0) return allDay
    const time = (a.startMinutes ?? -1) - (b.startMinutes ?? -1)
    if (time !== 0) return time
    const title = a.title.localeCompare(b.title)
    return title !== 0 ? title : a.id.localeCompare(b.id)
  })
}

export interface CalendarMark {
  key: string
  kind: 'person' | 'unassigned'
  label: string
  initial?: string
  color: CalendarColor
}

export function initialsForPeople(
  people: readonly CalendarPerson[],
): Map<string, string> {
  const firstCounts = new Map<string, number>()
  for (const person of people) {
    const first = [...person.name.trim()][0]?.toLocaleUpperCase() ?? '?'
    firstCounts.set(first, (firstCounts.get(first) ?? 0) + 1)
  }
  return new Map(
    people.map((person) => {
      const letters = [...person.name.trim()]
      const first = letters[0]?.toLocaleUpperCase() ?? '?'
      const value =
        (firstCounts.get(first) ?? 0) > 1
          ? letters.slice(0, 2).join('').toLocaleUpperCase()
          : first
      return [person.id, value]
    }),
  )
}

export function marksForDate(
  date: string,
  events: readonly CalendarEvent[],
  people: readonly CalendarPerson[],
): CalendarMark[] {
  const initials = initialsForPeople(people)
  const result: CalendarMark[] = []
  for (const event of events) {
    if (event.date !== date) continue
    if (event.assigneeIds.length > 0) {
      for (const id of event.assigneeIds) {
        result.push({
          key: `${event.id}:${id}`,
          kind: 'person',
          label:
            people.find((person) => person.id === id)?.name ?? 'Former member',
          initial: initials.get(id) ?? '?',
          color: event.color,
        })
      }
    } else {
      result.push({
        key: `${event.id}:unassigned`,
        kind: 'unassigned',
        label: 'Unassigned',
        color: event.color,
      })
    }
  }
  return result
}

export function visibleMarksForDate(
  date: string,
  events: readonly CalendarEvent[],
  people: readonly CalendarPerson[],
  limit = 3,
) {
  const marks = marksForDate(date, events, people)
  return {
    marks: marks.slice(0, limit),
    overflow: Math.max(0, marks.length - limit),
    total: marks.length,
  }
}

export type AgendaRow =
  | { kind: 'day'; key: string; date: string; events: CalendarEvent[] }
  | {
      kind: 'gap'
      key: string
      from: string
      to: string
      dates: string[]
      selected: boolean
    }

export function agendaRows(
  events: readonly CalendarEvent[],
  from: string,
  toExclusive: string,
  selectedDate?: string,
  expandedDates: readonly string[] = [],
): AgendaRow[] {
  const ordered = orderCalendarEvents(events)
  const dates = []
  for (
    let date = from;
    compareCalendarDates(date, toExclusive) < 0;
    date = addCalendarDays(date, 1)
  )
    dates.push(date)
  const byDate = new Map<string, CalendarEvent[]>()
  for (const event of ordered) {
    if (
      compareCalendarDates(event.date, from) >= 0 &&
      compareCalendarDates(event.date, toExclusive) < 0
    ) {
      byDate.set(event.date, [...(byDate.get(event.date) ?? []), event])
    }
  }
  const rows: AgendaRow[] = []
  const expanded = new Set(expandedDates)
  let index = 0
  while (index < dates.length) {
    const date = dates[index]
    if (
      byDate.has(date) ||
      expanded.has(date) ||
      date === selectedDate ||
      date === todayCalendarDate()
    ) {
      rows.push({
        kind: 'day',
        key: `day:${date}`,
        date,
        events: byDate.get(date) ?? [],
      })
      index++
      continue
    }
    const start = index
    while (
      index < dates.length &&
      !byDate.has(dates[index]) &&
      !expanded.has(dates[index]) &&
      dates[index] !== selectedDate &&
      dates[index] !== todayCalendarDate()
    )
      index++
    const gapDates = dates.slice(start, index)
    if (gapDates.length <= 6) {
      for (const gapDate of gapDates)
        rows.push({
          kind: 'day',
          key: `day:${gapDate}`,
          date: gapDate,
          events: [],
        })
    } else {
      rows.push({
        kind: 'gap',
        key: `gap:${gapDates[0]}:${gapDates[gapDates.length - 1]}`,
        from: gapDates[0],
        to: gapDates[gapDates.length - 1],
        dates: gapDates,
        selected: gapDates.includes(selectedDate ?? ''),
      })
    }
  }
  return rows
}
