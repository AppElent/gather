import {
  addCalendarMonths,
  type CalendarEvent,
  monthStart,
  normalizeCalendarEvent,
} from '@gather/core/calendar'
import { usePaginatedQuery } from 'convex/react'
import { useEffect } from 'react'
import { api } from '../../../../../convex/_generated/api'

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
  onEvents: (sourceKey: string, events: CalendarEvent[]) => void
}) {
  const from = monthStart(month)
  const toExclusive = addCalendarMonths(from, 1)
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
    onEvents(sourceKey, events)
  }, [calendarName, color, onEvents, result.results, sourceKey])

  useEffect(() => {
    if (result.status === 'CanLoadMore') result.loadMore(100)
  }, [result])

  return null
}
