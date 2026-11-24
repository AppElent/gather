/**
 * What the event composer (APP-589) holds, and what it saves. Pure, so the
 * rules are tested without a phone. Design: `designs/tasks/quick-add_final.md`,
 * "Event (APP-589)".
 *
 * - Calendar, Date and Time are always there; Who, Location and Note are set
 *   from the + menu.
 * - Time starts unset ("Tijd"), and an event saved that way is all day, as
 *   the server reads an event with no times.
 * - The draft carries one key, sent as `addCalendarEvent`'s idempotency key,
 *   so it makes one event however often it is sent; All details hands the
 *   same key to the full editor as its draft id.
 */
import {
  type CalendarFieldValues,
  hasCalendarErrors,
  validateCalendarFields,
} from '@gather/core/calendar'
import { minutesToClock } from '@gather/core/civil-date'

import { newSaveKey } from '../../ui/composer-drafts'
import {
  CALENDAR_DRAFT_VERSION,
  type CalendarDraft,
  emptyDraftValues,
} from './calendarDraft'

/** Unset, all day, or a start and an end in minutes since midnight. */
export type EventTime =
  | null
  | { allDay: true }
  | { allDay: false; start: number; end: number }

export interface EventDraft {
  title: string
  notes: string
  /** The Note line, picked from + before anything is typed in it. */
  showNotes: boolean
  calendarId: string | null
  date: string
  time: EventTime
  assigneeIds: string[]
  location: string
  saveKey: string
}

/** What the place the composer opened from chooses up front. */
export interface EventPreset {
  /** The calendar last added to, else the first. */
  calendarId: string | null
  /** The selected day, else today. */
  date: string
}

/** An event the server takes: every field `addCalendarEvent` reads. */
export type ComposedEvent = Required<CalendarFieldValues> & {
  calendarId: string
}

const LAST_MINUTE = 24 * 60 - 1
const HOUR = 60

export function emptyEventDraft(
  preset: EventPreset,
  saveKey = newSaveKey(),
): EventDraft {
  return {
    title: '',
    notes: '',
    showNotes: false,
    calendarId: preset.calendarId,
    date: preset.date,
    time: null,
    assigneeIds: [],
    location: '',
    saveKey,
  }
}

/**
 * After a save: empty and ready for the next, on the calendar just used and
 * the place's own day, with every other detail cleared.
 */
export function nextEventDraft(
  draft: EventDraft,
  preset: EventPreset,
): EventDraft {
  return { ...emptyEventDraft(preset), calendarId: draft.calendarId }
}

/**
 * Whether closing should keep it: a word typed, or a detail moved off what
 * the place chose. A calendar picked alone is not a draft.
 */
export function isEventDirty(draft: EventDraft, preset: EventPreset): boolean {
  return Boolean(
    draft.title.trim() ||
      draft.notes.trim() ||
      draft.location.trim() ||
      draft.assigneeIds.length > 0 ||
      draft.time !== null ||
      draft.date !== preset.date,
  )
}

/** The draft's fields as the calendar's own validation reads them. */
function fieldValues(draft: EventDraft): Required<CalendarFieldValues> {
  const timed = draft.time && !draft.time.allDay ? draft.time : null
  return {
    calendarId: draft.calendarId,
    title: draft.title.trim(),
    date: draft.date,
    allDay: !timed,
    startMinutes: timed ? timed.start : null,
    endMinutes: timed ? timed.end : null,
    assigneeIds: [...draft.assigneeIds],
    location: draft.location.trim(),
    notes: draft.notes.trim(),
  }
}

/** The event a draft saves, or `null` while it cannot be saved. */
export function composedEvent(draft: EventDraft): ComposedEvent | null {
  const values = fieldValues(draft)
  if (!values.calendarId) return null
  if (hasCalendarErrors(validateCalendarFields(values))) return null
  return { ...values, calendarId: values.calendarId }
}

/**
 * The full editor's draft for All details: everything typed and chosen, with
 * the composer's key as its id, so the event it saves is still this one.
 */
export function toCalendarDraft(
  draft: EventDraft,
  userId: string,
  groupId: string,
): CalendarDraft {
  const values = fieldValues(draft)
  return {
    version: CALENDAR_DRAFT_VERSION,
    draftId: draft.saveKey,
    userId,
    groupId,
    mode: 'create',
    eventId: null,
    baseRevision: 0,
    // Typed text goes over as typed; the editor trims when it saves.
    values: {
      ...emptyDraftValues(draft.date, draft.calendarId),
      ...values,
      title: draft.title,
      location: draft.location,
      notes: draft.notes,
    },
    original: null,
    status: 'editing',
    error: null,
  }
}

/**
 * The start Kies tijd… opens on: the whole hour after `hour` today, nine o'clock on
 * another day. Never later than 23:00, so an hour still fits.
 */
export function defaultStart(date: string, today: string, hour: number): number {
  if (date !== today) return 9 * HOUR
  const next = (hour + 1) * HOUR
  return Math.min(next, 23 * HOUR)
}

/** A start and the end that goes with it: an hour on, within the day. */
export function timedFrom(start: number): EventTime {
  const clamped = Math.max(0, Math.min(start, LAST_MINUTE - 1))
  return {
    allDay: false,
    start: clamped,
    end: Math.min(clamped + HOUR, LAST_MINUTE),
  }
}

/**
 * A new start keeps the length already chosen; a new end before the start
 * moves the start an hour back from it, so the range stays valid.
 */
export function withStart(time: EventTime, start: number): EventTime {
  if (!time || time.allDay) return timedFrom(start)
  const length = Math.max(time.end - time.start, 1)
  const clamped = Math.max(0, Math.min(start, LAST_MINUTE - 1))
  return {
    allDay: false,
    start: clamped,
    end: Math.min(clamped + length, LAST_MINUTE),
  }
}

export function withEnd(time: EventTime, end: number): EventTime {
  const clampedEnd = Math.max(1, Math.min(end, LAST_MINUTE))
  const before = Math.max(clampedEnd - HOUR, 0)
  const start = time && !time.allDay ? time.start : before
  return {
    allDay: false,
    start: clampedEnd > start ? start : before,
    end: clampedEnd,
  }
}

/** "12:30–15:00", for the Time chip. */
export function timeRangeLabel(start: number, end: number): string {
  return `${minutesToClock(start)}–${minutesToClock(end)}`
}

/**
 * Who, on the chip: nobody is the chip's name, everyone is "Everyone" when
 * the Group has more than one person, one is their name, more is "Daan +1".
 */
export function whoLabel(
  assigneeIds: readonly string[],
  people: readonly { id: string; name: string }[],
  words: { who: string; everyone: string },
): string | null {
  if (assigneeIds.length === 0) return null
  if (people.length > 1 && people.every((p) => assigneeIds.includes(p.id)))
    return words.everyone
  const names = assigneeIds
    .map((id) => people.find((person) => person.id === id)?.name)
    .filter((name): name is string => Boolean(name))
  if (names.length === 0) return words.who
  return names.length === 1 ? names[0]! : `${names[0]} +${names.length - 1}`
}

/**
 * The calendar a new event starts on: the one last added to while it is
 * still there, else the first by name.
 */
export function presetCalendar(
  calendars: readonly { id: string; name: string }[],
  lastUsed: string | undefined,
): string | null {
  if (lastUsed && calendars.some((calendar) => calendar.id === lastUsed))
    return lastUsed
  return (
    calendars
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))[0]
      ?.id ?? null
  )
}
