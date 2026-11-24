/**
 * The search filters the phone and `search.group` share (APP-633): Who, When
 * and Status, on the fields a search row carries. One copy, so the server
 * narrows by the same rules the phone's own filtering falls back on.
 *
 * The day a moment falls on is the caller's to say (`dayAt`): the phone asks
 * its own calendar, the server the phone's time zone.
 */
import { compareIsoDates, mondayStart, monthStart } from './civilDate'

export const WHEN_VALUES = ['today', 'week', 'month', 'earlier'] as const
export type WhenFilter = (typeof WHEN_VALUES)[number]

export const STATUS_VALUES = ['open', 'done'] as const
export type StatusFilter = (typeof STATUS_VALUES)[number]

/** The fields of a search row these filters read. */
export type SearchFilterRow = {
  type: string
  dueDate?: string
  date?: string
  done?: boolean
  createdBy?: string
  creationTime?: number
}

export type RowFilters = {
  /** A Member's user id. */
  who?: string | null
  when?: WhenFilter | null
  status?: StatusFilter | null
}

/** Today's civil date, and the civil date of any moment, for one reader. */
export type ReaderCalendar = {
  today: string
  dayAt: (at: number) => string
}

/**
 * The day a record is "when": an event's date, a task's due date, and for
 * everything else (and an undated task) the day it was added.
 */
export function dayOf(
  row: SearchFilterRow,
  dayAt: ReaderCalendar['dayAt'],
): string | null {
  if (row.type === 'calendarEvent' && row.date) return row.date
  if (row.type === 'task' && row.dueDate) return row.dueDate
  return row.creationTime === undefined ? null : dayAt(row.creationTime)
}

/**
 * Whether a day falls in a When bucket. Today, this week (from Monday) and
 * this month nest; Earlier is everything before this month.
 */
export function inWhen(day: string, when: WhenFilter, today: string): boolean {
  switch (when) {
    case 'today':
      return day === today
    case 'week':
      return mondayStart(day) === mondayStart(today)
    case 'month':
      return monthStart(day) === monthStart(today)
    case 'earlier':
      return compareIsoDates(day, monthStart(today)) < 0
  }
}

/** Whether one row passes Who, When and Status. */
export function matchesRowFilters(
  row: SearchFilterRow,
  { who, when, status }: RowFilters,
  { today, dayAt }: ReaderCalendar,
): boolean {
  if (who && row.createdBy !== who) return false
  // Status is a task's own: it removes no other type. No `done` reads as
  // open, which is what an unchecked task is.
  if (status && row.type === 'task') {
    if ((status === 'done') !== (row.done === true)) return false
  }
  if (when) {
    const day = dayOf(row, dayAt)
    if (!day || !inWhen(day, when, today)) return false
  }
  return true
}
