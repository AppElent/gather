import { addMonths, monthStart } from '@gather/core/civil-date'
import { useNavigate } from '@tanstack/react-router'
import { useMemo } from 'react'
import { plural, useI18n } from '../../lib/i18n'
import { linkTo } from '../../lib/links'
import { Breadcrumbs } from '../app/Breadcrumbs'
import { EmptyState } from '../app/EmptyState'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'
import { WashHeader } from '../app/WashHeader'
import { useEventSubtitle } from './CalendarPage'
import { dayTitle, eventsOn } from './calendarView'
import { DayView } from './DayView'
import { EventNotice, EventView } from './EventView'
import {
  CalendarEventSource,
  useCalendarEvent,
  useCalendarEvents,
  useCalendars,
  useToday,
} from './useCalendar'
import { useCalendarEditing } from './useCalendarEditing'
import { useCalendarKeys } from './useCalendarKeys'

const CARD = 'rounded-[var(--radius-card)] bg-[var(--surface)]'
const PAGE = 'mx-auto grid max-w-3xl grid-cols-[minmax(0,1fr)] gap-4'

/** `/calendar/day/$date`: where a day goes below `lg`, and linkable. */
export function CalendarDayPage({ date }: { date: string }) {
  const { timeZone } = useRequiredCurrentGroup()
  const { locale, messages } = useI18n()
  const words = messages.calendar
  const navigate = useNavigate()
  const today = useToday(timeZone)
  const data = useCalendars()
  const months = useMemo(() => [monthStart(date)], [date])
  const { events, sources, onEvents, monthLoaded } = useCalendarEvents(
    data,
    months,
  )
  const goTo = (day: string) =>
    void navigate({ ...linkTo('calendarDay', { date: day }), replace: true })
  const editing = useCalendarEditing({
    calendars: data.calendars,
    people: data.people,
    today,
    onSaved: (saved) => goTo(saved.date),
    onDeleted: () => {},
  })
  const create = () => {
    if (!data.loading) editing.create(date)
  }
  useCalendarKeys({
    day: date,
    weeks: false,
    onDay: goTo,
    onToday: () => goTo(today),
    onNew: create,
  })
  const subtitleOf = useEventSubtitle(data.calendars, data.people)
  const dayEvents = eventsOn(events, date)
  const loaded = monthLoaded(monthStart(date))
  const title = dayTitle(date, locale)
  const parent = {
    label: messages.modules.byId.calendar.label,
    link: { ...linkTo('calendar'), search: { day: date } },
  }
  return (
    <div className={PAGE}>
      <Breadcrumbs
        trail={[parent, { label: title }]}
        className="-mb-1"
        backInHeader
      />
      <WashHeader
        group="home"
        icon="Calendar"
        title={title}
        back={parent}
        summary={
          loaded
            ? { count: plural(locale, dayEvents.length, words.web.eventCount) }
            : undefined
        }
        primary={{ label: words.web.primary, onClick: create }}
      />
      <div className={CARD}>
        <DayView
          date={date}
          events={dayEvents}
          loaded={loaded}
          onAdd={create}
          heading={false}
          linkOf={(event) => linkTo('calendarEvent', { eventId: event.id })}
          subtitleOf={subtitleOf}
        />
      </div>
      {sources.map((source) => (
        <CalendarEventSource
          key={source.sourceKey}
          source={source}
          toExclusive={addMonths(source.month, 1)}
          onEvents={onEvents}
        />
      ))}
      {editing.dialogs}
    </div>
  )
}

/** In place of a day page whose address is not a day. */
export function CalendarNoDay() {
  const { messages } = useI18n()
  const label = messages.modules.byId.calendar.label
  return (
    <div className={PAGE}>
      <Breadcrumbs
        trail={[
          { label, link: linkTo('calendar') },
          { label: messages.calendar.web.day },
        ]}
        className="-mb-1"
        backInHeader
      />
      <WashHeader
        group="home"
        icon="Calendar"
        title={messages.calendar.web.day}
        back={{ label, link: linkTo('calendar') }}
      />
      <EmptyState
        kind="nothing-for-you"
        title={messages.common.errors.notFound}
      />
    </div>
  )
}

/** `/calendar/event/$eventId`: where an event goes below `lg`. */
export function CalendarEventPage({ eventId }: { eventId: string }) {
  const { timeZone } = useRequiredCurrentGroup()
  const { locale, messages } = useI18n()
  const words = messages.calendar
  const navigate = useNavigate()
  const today = useToday(timeZone)
  const data = useCalendars()
  const event = useCalendarEvent(eventId)
  const toDay = (date: string) =>
    void navigate({ ...linkTo('calendarDay', { date }), replace: true })
  const editing = useCalendarEditing({
    calendars: data.calendars,
    people: data.people,
    today,
    onSaved: ({ id }) => {
      if (id !== eventId)
        void navigate({
          ...linkTo('calendarEvent', { eventId: id }),
          replace: true,
        })
    },
    onDeleted: (deleted) => toDay(deleted.date),
  })
  const calendar = {
    label: messages.modules.byId.calendar.label,
    link: event
      ? { ...linkTo('calendar'), search: { day: event.date } }
      : linkTo('calendar'),
  }
  const back = event
    ? {
        label: dayTitle(event.date, locale),
        link: linkTo('calendarDay', { date: event.date }),
      }
    : calendar
  return (
    <div className={PAGE}>
      <Breadcrumbs
        trail={[
          calendar,
          ...(event ? [back] : []),
          { label: event?.title ?? words.web.event },
        ]}
        className="-mb-1"
        backInHeader
      />
      <WashHeader
        group="home"
        icon="Calendar"
        title={words.web.event}
        back={back}
      />
      <div className={CARD}>
        {event && !data.loading ? (
          <EventView
            event={event}
            people={data.people}
            readOnly={
              data.calendars.find(({ id }) => id === event.calendarId)
                ?.readOnly ?? true
            }
            onEdit={() => editing.edit(event)}
            onDelete={() => editing.remove(event)}
          />
        ) : (
          <EventNotice
            loading={event === undefined || data.loading}
            back={{
              label: calendar.label,
              onClick: () => void navigate(linkTo('calendar')),
            }}
          />
        )}
      </div>
      {editing.dialogs}
    </div>
  )
}
