import {
  type CalendarColor,
  type CalendarEvent,
  type CalendarPeopleFilter,
  type CalendarPerson,
  filterCalendarEvents,
  normalizeCalendarEvent,
} from '@gather/core/calendar'
import {
  applySourceReport,
  calendarSourceKey,
  isMonthLoaded,
  mergeSourceEvents,
} from '@gather/core/calendar-sources'
import { todayIn } from '@gather/core/civil-date'
import {
  useMutation,
  usePaginatedQuery,
  useQueries,
  useQuery,
} from 'convex/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useErrorMessage } from '../../lib/errorMessage'
import { useMessages } from '../../lib/i18n'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'
import { isReadOnlySource } from './calendarView'

export interface WebCalendar {
  id: Id<'calendars'>
  name: string
  color: CalendarColor
  readOnly: boolean
}

const PAGE = 100

/** Today in the Group's time zone, moving on at midnight. */
export function useToday(timeZone: string | undefined): string {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])
  return todayIn(timeZone, now)
}

/** The Group's calendars, this Member's filters, and the Members. */
export function useCalendars() {
  const { slug: groupSlug } = useRequiredCurrentGroup()
  const page = usePaginatedQuery(
    api.calendar.listCalendars,
    { groupSlug },
    { initialNumItems: PAGE },
  )
  const preferences = useQuery(api.calendar.preferences, { groupSlug })
  const members = useQuery(api.groups.members, { slug: groupSlug })
  useEffect(() => {
    if (page.status === 'CanLoadMore') page.loadMore(PAGE)
  }, [page])

  const calendars = useMemo(
    () =>
      page.results.map(
        (calendar): WebCalendar => ({
          id: calendar._id,
          name: calendar.name,
          color: calendar.color ?? 'home',
          readOnly: isReadOnlySource(calendar.source),
        }),
      ),
    [page.results],
  )
  const people = useMemo(
    (): CalendarPerson[] =>
      (members ?? []).map(({ userId, name }) => ({ id: userId, name })),
    [members],
  )
  return {
    loading: page.status === 'LoadingFirstPage' || preferences === undefined,
    calendars,
    people,
    peopleLoaded: members !== undefined,
    hiddenCalendarIds: preferences?.hiddenCalendarIds ?? NONE,
    peopleFilter: preferences?.peopleFilter ?? null,
  }
}

const NONE: Id<'calendars'>[] = []

export interface CalendarSourceSpec {
  sourceKey: string
  calendar: WebCalendar
  month: string
}

export type ReportEvents = (
  sourceKey: string,
  events: CalendarEvent[],
  complete: boolean,
) => void

/**
 * The events of some months, one paginated query per calendar and month as on
 * the phone. Render a `CalendarEventSource` for each of `sources`.
 */
export function useCalendarEvents(
  {
    loading,
    calendars,
    hiddenCalendarIds,
    peopleFilter,
  }: {
    loading: boolean
    calendars: readonly WebCalendar[]
    hiddenCalendarIds: readonly string[]
    peopleFilter: CalendarPeopleFilter | null
  },
  months: readonly string[],
) {
  const { slug: groupSlug } = useRequiredCurrentGroup()
  const [reports, setReports] = useState<{
    groupSlug: string
    events: Record<string, CalendarEvent[]>
  }>({ groupSlug, events: {} })
  const reported = reports.groupSlug === groupSlug ? reports.events : EMPTY

  const onEvents = useCallback<ReportEvents>(
    (sourceKey, events, complete) =>
      setReports((current) => {
        const base = current.groupSlug === groupSlug ? current.events : {}
        const next = applySourceReport(base, sourceKey, events, complete)
        return next === current.events ? current : { groupSlug, events: next }
      }),
    [groupSlug],
  )
  const sources = useMemo(
    () =>
      calendars.flatMap((calendar) =>
        months.map(
          (month): CalendarSourceSpec => ({
            sourceKey: calendarSourceKey(calendar.id, month),
            calendar,
            month,
          }),
        ),
      ),
    [calendars, months],
  )
  const events = useMemo(
    () =>
      filterCalendarEvents(
        mergeSourceEvents(
          reported,
          calendars.map(({ id }) => id),
        ),
        hiddenCalendarIds,
        peopleFilter,
      ),
    [calendars, hiddenCalendarIds, peopleFilter, reported],
  )
  const ids = loading ? null : calendars.map(({ id }) => id)
  return {
    events,
    sources,
    onEvents,
    monthLoaded: (month: string) => isMonthLoaded(reported, ids, month),
  }
}

const EMPTY: Record<string, CalendarEvent[]> = {}

export function CalendarEventSource({
  source: { sourceKey, calendar, month },
  toExclusive,
  onEvents,
}: {
  source: CalendarSourceSpec
  toExclusive: string
  onEvents: ReportEvents
}) {
  const { slug: groupSlug } = useRequiredCurrentGroup()
  const page = usePaginatedQuery(
    api.calendar.listEvents,
    { groupSlug, calendarId: calendar.id, from: month, toExclusive },
    { initialNumItems: PAGE },
  )
  const { name: calendarName, color } = calendar
  useEffect(() => {
    onEvents(
      sourceKey,
      page.results.map((event) =>
        normalizeCalendarEvent({ ...event, calendarName, color }),
      ),
      page.status === 'Exhausted',
    )
  }, [calendarName, color, onEvents, page.results, page.status, sourceKey])
  useEffect(() => {
    if (page.status === 'CanLoadMore') page.loadMore(PAGE)
  }, [page])
  return null
}

/**
 * One event by its id: `undefined` while it loads, `null` when it is gone, in
 * another Group, or the address never named one. Read with `useQueries`, which
 * hands a refusal back instead of throwing the whole page away.
 */
export function useCalendarEvent(
  id: string | undefined,
): CalendarEvent | null | undefined {
  const { slug: groupSlug } = useRequiredCurrentGroup()
  const queries = useMemo(
    (): Parameters<typeof useQueries>[0] =>
      id
        ? {
            event: {
              query: api.calendar.getCalendarEvent,
              args: { groupSlug, id: id as Id<'calendarEvents'> },
            },
          }
        : {},
    [groupSlug, id],
  )
  const { event } = useQueries(queries) as { event?: unknown }
  return useMemo(() => {
    if (!id) return null
    if (event === undefined) return undefined
    if (event === null || event instanceof Error) return null
    return normalizeCalendarEvent(
      event as Parameters<typeof normalizeCalendarEvent>[0],
    )
  }, [event, id])
}

/** The calendar writes that are one press, with the error they end in. */
export function useCalendarCommands() {
  const { slug: groupSlug } = useRequiredCurrentGroup()
  const messages = useMessages()
  const errorText = useErrorMessage()
  const visibility = useMutation(api.calendar.setCalendarVisibility)
  const preferences = useMutation(api.calendar.setPreferences)
  const [error, setError] = useState<string | null>(null)
  const attempt = async (work: Promise<unknown>) => {
    setError(null)
    try {
      await work
    } catch (caught) {
      setError(errorText(caught, messages.common.errors.didNotWork))
    }
  }
  return {
    error,
    setVisible: (calendarId: Id<'calendars'>, visible: boolean) =>
      attempt(visibility({ groupSlug, calendarId, visible })),
    setPeople: (peopleFilter: CalendarPeopleFilter | null) =>
      attempt(
        preferences({
          groupSlug,
          peopleFilter: peopleFilter && {
            includeUnassigned: peopleFilter.includeUnassigned,
            userIds: peopleFilter.userIds as Id<'users'>[],
          },
        }),
      ),
  }
}
