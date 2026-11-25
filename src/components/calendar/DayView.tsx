import type { CalendarEvent } from '@gather/core/calendar'
import { Plus } from 'lucide-react'
import { useI18n } from '../../lib/i18n'
import { dayTitle } from './calendarView'
import { EventRow, type EventRowContext } from './EventRow'

/** A day's events and the button that adds one: the panel, or a day's page. */
export function DayView({
  date,
  events,
  loaded,
  onAdd,
  heading = true,
  ...row
}: EventRowContext & {
  date: string
  events: readonly CalendarEvent[]
  loaded: boolean
  onAdd: () => void
  /** Off on a page whose header already names the day. */
  heading?: boolean
}) {
  const { locale, messages } = useI18n()
  const words = messages.calendar
  return (
    <section
      data-day-view={date}
      aria-label={dayTitle(date, locale)}
      className="grid gap-3 p-[18px]"
    >
      {heading ? (
        <h2
          tabIndex={-1}
          className="m-0 font-rounded text-title-2 font-bold outline-none"
        >
          {dayTitle(date, locale)}
        </h2>
      ) : null}
      {events.length > 0 ? (
        <ul className="m-0 list-none rounded-2xl bg-[var(--ground)] p-0">
          {events.map((event) => (
            <EventRow key={event.id} event={event} {...row} />
          ))}
        </ul>
      ) : (
        <p className="m-0 text-subhead text-[var(--muted)]" role="status">
          {loaded ? words.nothingPlanned : words.loadingEvents}
        </p>
      )}
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex min-h-10 pointer-coarse:min-h-[var(--size-control-min)] items-center justify-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--home-wash)] px-4 text-subhead font-semibold text-[var(--home-text)]"
      >
        <Plus className="size-4" strokeWidth={2.4} aria-hidden="true" />
        {words.web.addOnDay}
      </button>
    </section>
  )
}
