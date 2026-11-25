import type { CalendarEvent, CalendarView } from '@gather/core/calendar'
import { addDays, addMonths, monthStart } from '@gather/core/civil-date'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { fmt, plural, useI18n } from '../../lib/i18n'
import { type AppLink, linkTo } from '../../lib/links'
import { EmptyState } from '../app/EmptyState'
import { ListDetailLayout, ListLoadingState } from '../app/ListDetailLayout'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'
import { useIsDesktop } from '../app/useMediaQuery'
import {
  type StartCreatingProps,
  useStartCreating,
} from '../app/useStartCreating'
import { WashHeader } from '../app/WashHeader'
import { AgendaView } from './AgendaView'
import { CalendarToolbar } from './CalendarToolbar'
import {
  agendaFrom,
  agendaRange,
  agendaStep,
  type CalendarSelection,
  dayTitle,
  eventsOn,
  monthsNeeded,
  monthTitle,
  readView,
  weekTitle,
  writeView,
} from './calendarView'
import { DayView } from './DayView'
import type { EventRowContext } from './EventRow'
import { EventNotice, EventView, nameOf } from './EventView'
import { MonthView } from './MonthView'
import {
  CalendarEventSource,
  useCalendarCommands,
  useCalendarEvent,
  useCalendarEvents,
  useCalendars,
  useToday,
} from './useCalendar'
import { useCalendarEditing } from './useCalendarEditing'
import { useCalendarKeys } from './useCalendarKeys'
import { WeekView } from './WeekView'

/**
 * Calendar on the web (APP-344): month, week or agenda beside the selected
 * day, whose events open in its place. `?day` is the day and `?event` the
 * event; below 1024 px both are pages of their own.
 */
export function CalendarPage({
  day: selectedDay,
  event: eventId,
  startCreating,
  onCreateStarted,
}: StartCreatingProps & CalendarSelection) {
  const { timeZone } = useRequiredCurrentGroup()
  const { locale, messages } = useI18n()
  const words = messages.calendar
  const navigate = useNavigate()
  const isDesktop = useIsDesktop()
  const today = useToday(timeZone)
  const day = selectedDay ?? today

  // Read after hydration: the server has no browser to remember one.
  const [chosenView, setChosenView] = useState<CalendarView | null>(null)
  useEffect(() => setChosenView(readView()), [])
  const view = chosenView ?? (isDesktop ? 'month' : 'agenda')

  // Where the agenda starts: it stays put while days in it are selected, and
  // goes along to a day outside it or one that was stepped to.
  const [place, setPlace] = useState<{
    day: string
    from: string
    stepTo?: string
  }>({ day, from: day })
  if (place.day !== day)
    setPlace({
      day,
      from: place.stepTo === day ? day : agendaFrom(place.from, day),
    })
  const { from } = place
  const range = agendaRange(from)

  const data = useCalendars()
  const { calendars, people, loading } = data
  const months = useMemo(
    () => monthsNeeded(day, today, from),
    [day, today, from],
  )
  const { events, sources, onEvents, monthLoaded } = useCalendarEvents(
    data,
    months,
  )
  const commands = useCalendarCommands()
  const event = useCalendarEvent(eventId)

  const go = (selection: CalendarSelection, replace = false) =>
    void navigate({ ...linkTo('calendar'), search: selection, replace })
  const selectDay = (date: string) =>
    isDesktop
      ? go({ day: date })
      : void navigate(linkTo('calendarDay', { date }))
  const closeEvent = () => go({ day })

  const editing = useCalendarEditing({
    calendars,
    people,
    today,
    onSaved: ({ id, date }, isNew) =>
      // A new event is on its day; an edited one stays open.
      go(isNew || !eventId ? { day: date } : { day: date, event: id }, true),
    onDeleted: closeEvent,
  })
  const create = () => editing.create(day)
  const [createAsked, setCreateAsked] = useState(false)
  useStartCreating({ startCreating, onCreateStarted }, () =>
    setCreateAsked(true),
  )
  const latestCreate = useRef(create)
  latestCreate.current = create
  // Not before the calendars are known: without one, adding one comes first.
  useEffect(() => {
    if (!createAsked || loading) return
    setCreateAsked(false)
    latestCreate.current()
  }, [createAsked, loading])

  const stepTo = (date: string) => {
    setPlace((current) =>
      current.day === date
        ? { day: date, from: date }
        : { ...current, stepTo: date },
    )
    go({ day: date })
  }
  const goToday = () => stepTo(today)
  const step = (by: 1 | -1) => {
    if (view === 'agenda') stepTo(agendaStep(from, by))
    else
      go({ day: view === 'week' ? addDays(day, 7 * by) : addMonths(day, by) })
  }

  useCalendarKeys({
    day: eventId || loading ? undefined : day,
    weeks: view === 'month',
    onDay: (date) => go({ day: date }, true),
    onToday: goToday,
    onNew: create,
  })

  // Closing an event the layout has no opener for (opened from the panel, or
  // by address) lands on its row in the day, else on the day's heading.
  const lastOpen = useRef(eventId)
  const closed = useRef<string | null>(null)
  useEffect(() => {
    if (lastOpen.current && !eventId) closed.current = lastOpen.current
    lastOpen.current = eventId
    if (!closed.current || editing.isOpen) return
    const id = closed.current
    closed.current = null
    const active = document.activeElement as HTMLElement | null
    if (active && active !== document.body && active.tabIndex >= 0) return
    const rows = Array.from(
      document.querySelectorAll<HTMLElement>('[data-day-view] [data-event]'),
    )
    const target =
      rows.find((row) => row.dataset.event === id) ??
      document.querySelector<HTMLElement>('[data-day-view] h2')
    target?.focus({ preventScroll: true })
  }, [eventId, editing.isOpen])

  const row: EventRowContext = {
    linkOf: (item: CalendarEvent): AppLink =>
      isDesktop
        ? {
            ...linkTo('calendar'),
            search: { day: item.date, event: item.id },
          }
        : linkTo('calendarEvent', { eventId: item.id }),
    subtitleOf: useEventSubtitle(calendars, people),
    openId: eventId,
  }
  const readOnly = (item: CalendarEvent) =>
    calendars.find(({ id }) => id === item.calendarId)?.readOnly ?? true

  const none = !loading && calendars.length === 0
  const todayCount = eventsOn(events, today).length
  const dayEvents = eventsOn(events, day)

  const toolbar =
    loading || none ? null : (
      <div className={eventId ? 'max-lg:hidden' : undefined}>
        <CalendarToolbar
          title={
            view === 'week'
              ? weekTitle(day, locale)
              : monthTitle(view === 'agenda' ? from : day, locale)
          }
          view={view}
          onView={(next) => {
            setChosenView(next)
            writeView(next)
          }}
          onToday={goToday}
          onStep={step}
          calendars={calendars}
          hiddenCalendarIds={data.hiddenCalendarIds}
          onVisible={(id, visible) => void commands.setVisible(id, visible)}
          onManage={editing.manage}
          people={people}
          peopleFilter={data.peopleFilter}
          onPeople={(filter) => void commands.setPeople(filter)}
        />
      </div>
    )

  const list = (
    <>
      {commands.error ? (
        <p
          role="alert"
          className="m-0 rounded-[var(--radius-control)] bg-[var(--surface)] px-4 py-3 text-subhead font-semibold text-[var(--danger)]"
        >
          {commands.error}
        </p>
      ) : null}
      {loading ? (
        <ListLoadingState label={messages.common.errors.loading} />
      ) : none ? (
        <EmptyState
          kind="nothing-yet"
          tile={{ group: 'home', icon: 'Calendar' }}
          title={words.web.noCalendarsTitle}
          body={words.web.noCalendarsBody}
          action={{ label: words.addCalendar, onClick: editing.manage }}
        />
      ) : view === 'month' ? (
        <MonthView
          day={day}
          today={today}
          events={events}
          onSelect={selectDay}
        />
      ) : view === 'week' ? (
        <WeekView
          day={day}
          today={today}
          events={events}
          onSelect={selectDay}
          {...row}
        />
      ) : (
        <AgendaView
          events={events}
          range={range}
          today={today}
          loaded={
            monthLoaded(monthStart(from)) &&
            monthLoaded(addMonths(monthStart(from), 1))
          }
          {...row}
        />
      )}
      {sources.map((source) => (
        <CalendarEventSource
          key={source.sourceKey}
          source={source}
          toExclusive={addMonths(source.month, 1)}
          onEvents={onEvents}
        />
      ))}
    </>
  )

  const back = {
    label: fmt(words.web.backToDay, { date: dayTitle(day, locale) }),
    onClick: closeEvent,
  }
  const panel = eventId ? (
    event && !loading ? (
      <EventView
        key={event.id}
        event={event}
        people={people}
        readOnly={readOnly(event)}
        onEdit={() => editing.edit(event)}
        onDelete={() => editing.remove(event)}
        back={back}
      />
    ) : (
      <EventNotice
        key={eventId}
        loading={event === undefined || loading}
        back={back}
      />
    )
  ) : none || loading ? undefined : (
    <DayView
      date={day}
      events={dayEvents}
      loaded={monthLoaded(monthStart(day))}
      onAdd={create}
      {...row}
    />
  )

  return (
    <>
      <ListDetailLayout
        header={
<>
          <WashHeader
            group="home"
            icon="Calendar"
            title={messages.modules.byId.calendar.label}
            back={{
              label: messages.shell.allModules.title,
              link: linkTo('all'),
            }}
            summary={
              loading
                ? undefined
                : {
                    count: plural(locale, todayCount, words.web.summary),
                    scope: plural(
                      locale,
                      calendars.length,
                      words.web.calendarCount,
                    ),
                  }
            }
            primary={{ label: words.web.primary, onClick: create }}
          />
{toolbar}</>
        }
        list={list}
        panel={panel}
        panelLabel={eventId ? words.web.event : words.web.panel}
        recordKey={eventId}
        onCloseRecord={closeEvent}
        width={340}
      />
      {editing.dialogs}
    </>
  )
}

/** "Nora, Sam · Gezin · read-only" */
export function useEventSubtitle(
  calendars: ReturnType<typeof useCalendars>['calendars'],
  people: ReturnType<typeof useCalendars>['people'],
) {
  const words = useI18n().messages.calendar
  return (event: CalendarEvent) => {
    const calendar = calendars.find(({ id }) => id === event.calendarId)
    return [
      event.assigneeIds
        .map((id) => nameOf(id, people, words.formerMember))
        .join(', '),
      calendar?.name ?? event.calendarName ?? '',
      calendar?.readOnly ? words.web.readOnlyRow : '',
    ]
      .filter(Boolean)
      .join(' · ')
  }
}
