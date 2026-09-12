import {
  addCalendarMonths,
  type CalendarEvent,
  type CalendarPeopleFilter,
  type CalendarView,
  filterCalendarEvents,
  monthStart,
} from '@gather/core/calendar'
import { usePaginatedQuery, useQuery } from 'convex/react'
import { useCallback, useMemo, useState } from 'react'
import { api } from '../../../../../convex/_generated/api'

import type { CalendarScreenData } from './CalendarScreen'

export interface CalendarConnectedData extends CalendarScreenData {
  view: CalendarView
  peopleFilter: CalendarPeopleFilter | null
  sources: {
    sourceKey: string
    calendarId: string
    calendarName: string
    color: CalendarEvent['color']
    month: string
  }[]
  onEvents: (sourceKey: string, events: CalendarEvent[]) => void
  preferencesReady: boolean
}

export function useCalendarData(
  groupSlug: string,
  activeDate: string,
): CalendarConnectedData {
  const calendars = usePaginatedQuery(
    api.calendar.listCalendars,
    { groupSlug },
    { initialNumItems: 100 },
  )
  const preferences = useQuery(api.calendar.preferences, { groupSlug })
  const members = useQuery(api.groups.members, { slug: groupSlug })
  const [sourceState, setSourceState] = useState<{
    groupSlug: string
    events: Record<string, CalendarEvent[]>
  }>({ groupSlug, events: {} })
  const sourceEvents = useMemo(
    () => (sourceState.groupSlug === groupSlug ? sourceState.events : {}),
    [groupSlug, sourceState],
  )

  const onEvents = useCallback(
    (sourceKey: string, events: CalendarEvent[]) => {
      setSourceState((current) => ({
        groupSlug,
        events:
          current.groupSlug === groupSlug
            ? { ...current.events, [sourceKey]: events }
            : { [sourceKey]: events },
      }))
    },
    [groupSlug],
  )

  const months = useMemo(
    () =>
      [-1, 0, 1].map((offset) =>
        addCalendarMonths(monthStart(activeDate), offset),
      ),
    [activeDate],
  )
  const pages = calendars.results
  const sources = useMemo(
    () =>
      pages.flatMap((calendar) =>
        months.map((month) => ({
          sourceKey: `${calendar._id}:${month}`,
          calendarId: calendar._id,
          calendarName: calendar.name,
          color: calendar.color ?? 'home',
          month,
        })),
      ),
    [months, pages],
  )
  const allEvents = useMemo(
    () => Object.values(sourceEvents).flat(),
    [sourceEvents],
  )
  const deduped = useMemo(() => {
    const byId = new Map<string, CalendarEvent>()
    for (const event of allEvents) {
      const previous = byId.get(event.id)
      if (!previous || event.revision >= previous.revision)
        byId.set(event.id, event)
    }
    return [...byId.values()]
  }, [allEvents])
  const people = useMemo(
    () =>
      (members ?? []).map((member) => ({
        id: member.userId,
        name: member.name,
      })),
    [members],
  )
  const hiddenCalendarIds = useMemo(
    () => preferences?.hiddenCalendarIds ?? [],
    [preferences?.hiddenCalendarIds],
  )
  const events = useMemo(
    () =>
      filterCalendarEvents(
        deduped,
        hiddenCalendarIds,
        preferences?.peopleFilter ?? null,
      ),
    [deduped, hiddenCalendarIds, preferences?.peopleFilter],
  )

  return {
    calendars: pages.map((calendar) => ({
      id: calendar._id,
      name: calendar.name,
      color: calendar.color ?? 'home',
    })),
    events,
    people,
    hiddenCalendarIds,
    view: preferences?.view ?? 'week',
    peopleFilter: preferences?.peopleFilter ?? null,
    preferencesReady: preferences !== undefined,
    sources,
    onEvents,
  }
}
