import {
  type CalendarEvent,
  type CalendarPeopleFilter,
  type CalendarView,
  filterCalendarEvents,
} from '@gather/core/calendar'
import { addMonths, monthStart } from '@gather/core/civil-date'
import { useCallback, useMemo, useState } from 'react'
import { api } from '../../convex/api'
import { usePaginatedQuery, useQuery } from '../../convex/queries'

import type { CalendarScreenData } from './CalendarScreen'
import {
  applySourceReport,
  calendarSourceKey,
  isMonthLoaded,
  mergeSourceEvents,
} from './calendarSources'

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
  onEvents: (
    sourceKey: string,
    events: CalendarEvent[],
    complete: boolean,
  ) => void
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
    (sourceKey: string, events: CalendarEvent[], complete: boolean) => {
      setSourceState((current) => {
        const base = current.groupSlug === groupSlug ? current.events : {}
        const next = applySourceReport(base, sourceKey, events, complete)
        return next === current.events ? current : { groupSlug, events: next }
      })
    },
    [groupSlug],
  )

  const months = useMemo(
    () =>
      [-1, 0, 1].map((offset) =>
        addMonths(monthStart(activeDate), offset),
      ),
    [activeDate],
  )
  const pages = calendars.results
  const sources = useMemo(
    () =>
      pages.flatMap((calendar) =>
        months.map((month) => ({
          sourceKey: calendarSourceKey(calendar._id, month),
          calendarId: calendar._id,
          calendarName: calendar.name,
          color: calendar.color ?? 'home',
          month,
        })),
      ),
    [months, pages],
  )
  const deduped = useMemo(
    () =>
      mergeSourceEvents(
        sourceEvents,
        pages.map((calendar) => calendar._id),
      ),
    [pages, sourceEvents],
  )
  const people = useMemo(
    () =>
      (members ?? []).map((member) => ({
        id: member.userId,
        name: member.name,
      })),
    [members],
  )
  const calendarIds = useMemo(
    () =>
      calendars.status === 'LoadingFirstPage'
        ? null
        : pages.map((calendar) => calendar._id as string),
    [calendars.status, pages],
  )
  const monthLoaded = useCallback(
    (month: string) => isMonthLoaded(sourceEvents, calendarIds, month),
    [calendarIds, sourceEvents],
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
    monthLoaded,
  }
}
