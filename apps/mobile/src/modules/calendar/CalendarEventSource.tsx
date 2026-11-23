import {
  type CalendarEvent,
  normalizeCalendarEvent,
} from '@gather/core/calendar'
import { addMonths, monthStart } from '@gather/core/civil-date'
import { useEffect } from 'react'
import { api } from '../../convex/api'
import { usePaginatedQuery } from '../../convex/queries'

export function CalendarEventSource({
  groupSlug,
  calendarId,
  calendarName,
  color,
  month,
  sourceKey,
  onEvents,
}: {
  groupSlug: string
  calendarId: string
  calendarName: string
  color: CalendarEvent['color']
  month: string
  sourceKey: string
  onEvents: (
    sourceKey: string,
    events: CalendarEvent[],
    complete: boolean,
  ) => void
}) {
  const from = monthStart(month)
  const toExclusive = addMonths(from, 1)
  const result = usePaginatedQuery(
    api.calendar.listEvents,
    { groupSlug, calendarId: calendarId as never, from, toExclusive },
    { initialNumItems: 100 },
  )

  useEffect(() => {
    const events = result.results.map((event) =>
      normalizeCalendarEvent({
        id: event.id,
        calendarId: event.calendarId,
        calendarName,
        color,
        title: event.title,
        date: event.date,
        allDay: event.allDay,
        startMinutes: event.startMinutes,
        endMinutes: event.endMinutes,
        assigneeIds: event.assigneeIds,
        location: event.location,
        notes: event.notes,
        revision: event.revision,
      }),
    )
    // Complete only once every page is in: a month still loading must not
    // read as a month without events.
    onEvents(sourceKey, events, result.status === 'Exhausted')
  }, [calendarName, color, onEvents, result.results, result.status, sourceKey])

  useEffect(() => {
    if (result.status === 'CanLoadMore') result.loadMore(100)
  }, [result])

  return null
}
