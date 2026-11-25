import type { CalendarEvent, CalendarFieldValues } from '@gather/core/calendar'
import { minutesToClock } from '@gather/core/civil-date'

/** What the event dialog edits, for a new event and an existing one. */
export type EventValues = Required<CalendarFieldValues> & {
  assigneeIds: string[]
  location: string
  notes: string
}

const HOUR = 60
const LAST_MINUTE = 24 * HOUR - 1

/** All day until a time is chosen, as the phone's composer starts. */
export function emptyEvent(
  date: string,
  calendarId: string | null,
): EventValues {
  return {
    calendarId,
    title: '',
    date,
    allDay: true,
    startMinutes: null,
    endMinutes: null,
    assigneeIds: [],
    location: '',
    notes: '',
  }
}

export function valuesOf(event: CalendarEvent): EventValues {
  return {
    calendarId: event.calendarId,
    title: event.title,
    date: event.date,
    allDay: event.allDay,
    startMinutes: event.startMinutes ?? null,
    endMinutes: event.endMinutes ?? null,
    assigneeIds: [...event.assigneeIds],
    location: event.location,
    notes: event.notes,
  }
}

/** The whole hour after `hour` today, nine o'clock on another day. */
export function defaultStart(
  date: string,
  today: string,
  hour: number,
): number {
  if (date !== today) return 9 * HOUR
  return Math.min((hour + 1) * HOUR, 23 * HOUR)
}

/** A start and the hour after it, within the day. */
export function startingAt(
  start: number,
): Pick<EventValues, 'startMinutes' | 'endMinutes'> {
  return { startMinutes: start, endMinutes: Math.min(start + HOUR, LAST_MINUTE) }
}

/** A new start keeps the length already chosen, within the day. */
export function moveStart(
  values: EventValues,
  start: number | null,
): Pick<EventValues, 'startMinutes' | 'endMinutes'> {
  const { startMinutes, endMinutes } = values
  if (start === null) return { startMinutes: null, endMinutes }
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes)
    return startingAt(start)
  return {
    startMinutes: start,
    endMinutes: Math.min(start + (endMinutes - startMinutes), LAST_MINUTE),
  }
}

/** Minutes since midnight from a time field, or null while it is empty. */
export function clockToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})/.exec(value)
  return match ? Number(match[1]) * HOUR + Number(match[2]) : null
}

export const clockValue = (minutes: number | null) =>
  minutes === null ? '' : minutesToClock(minutes)

/** The fields as both mutations read them, trimmed. */
export function savedFields(values: EventValues) {
  return {
    ...values,
    title: values.title.trim(),
    startMinutes: values.allDay ? null : values.startMinutes,
    endMinutes: values.allDay ? null : values.endMinutes,
    location: values.location.trim() || null,
    notes: values.notes.trim() || null,
  }
}

export const isChanged = (a: EventValues, b: EventValues) =>
  JSON.stringify(a) !== JSON.stringify(b)
