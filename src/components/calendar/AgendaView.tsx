import type { CalendarEvent } from '@gather/core/calendar'
import { fmt, useI18n } from '../../lib/i18n'
import { EmptyState } from '../app/EmptyState'
import {
  type AgendaRange,
  agendaDays,
  daySection,
  daySectionHeading,
} from './calendarView'
import { EventRow, type EventRowContext } from './EventRow'

/** The days that have events, each a section: the list a phone opens with. */
export function AgendaView({
  events,
  range,
  today,
  loaded,
  ...row
}: EventRowContext & {
  events: readonly CalendarEvent[]
  range: AgendaRange
  today: string
  loaded: boolean
}) {
  const { locale, messages } = useI18n()
  const words = messages.calendar
  const days = agendaDays(events, range, today)
  if (days.length === 0)
    return loaded ? (
      <EmptyState
        kind="nothing-for-you"
        title={words.nothingPlanned}
        body={words.web.emptyAgendaBody}
      />
    ) : (
      <p role="status" className="m-0 px-1 text-subhead text-[var(--muted)]">
        {words.loadingEvents}
      </p>
    )
  return (
    <div className="grid gap-4" data-agenda="">
      {days.map(({ date, events: dayEvents }) => (
        <section key={date} aria-labelledby={`agenda-${date}`}>
          <h2
            id={`agenda-${date}`}
            className={`mx-1 mt-0 mb-2 text-footnote font-semibold ${
              date === today ? 'text-[var(--home-text)]' : 'text-[var(--muted)]'
            }`}
          >
            {date === today
              ? fmt(words.web.todayLabel, { date: daySection(date, locale) })
              : daySectionHeading(date, locale)}
          </h2>
          <div className="rounded-[var(--radius-card)] bg-[var(--surface)]">
            {dayEvents.length > 0 ? (
              <ul className="m-0 list-none rounded-[inherit] p-0">
                {dayEvents.map((event) => (
                  <EventRow key={event.id} event={event} {...row} />
                ))}
              </ul>
            ) : (
              <p className="m-0 px-4 py-3.5 text-subhead text-[var(--muted)]">
                {loaded ? words.nothingPlanned : words.loadingEvents}
              </p>
            )}
          </div>
        </section>
      ))}
    </div>
  )
}
