import type { CalendarEvent } from '@gather/core/calendar'
import { Link } from '@tanstack/react-router'
import { useMessages } from '../../lib/i18n'
import type { AppLink } from '../../lib/links'
import { eventStart, eventTime } from './calendarView'
import { COLOR_BAR } from './colors'

export interface EventRowContext {
  /** Where an event goes: the panel, or a page of its own below `lg`. */
  linkOf: (event: CalendarEvent) => AppLink
  /** "Nora · Gezin", with "read-only" for a subscribed calendar. */
  subtitleOf: (event: CalendarEvent) => string
  /** The event open in the panel. */
  openId?: string
}

/** One event in a day's list: colour bar, time, title, who and calendar. */
export function EventRow({
  event,
  linkOf,
  subtitleOf,
  openId,
}: EventRowContext & { event: CalendarEvent }) {
  const words = useMessages().calendar.web
  return (
    <li
      className={`relative flex min-h-14 gap-3 px-3.5 py-2 first:rounded-t-[inherit] last:rounded-b-[inherit] hover:bg-[var(--surface-2)] [&+&]:border-t-[0.5px] [&+&]:border-[var(--hair)] ${
        openId === event.id ? 'bg-[var(--surface-2)]' : ''
      }`}
    >
      <span
        aria-hidden="true"
        className={`w-1 shrink-0 rounded-[var(--radius-pill)] ${COLOR_BAR[event.color]}`}
      />
      <span className="w-12 shrink-0 pt-0.5 text-footnote text-[var(--muted)] tabular-nums">
        {eventStart(event, words.allDayRow)}
      </span>
      <Link
        {...linkOf(event)}
        data-event={event.id}
        aria-label={`${event.title}, ${eventTime(event, words.allDayRow)}, ${subtitleOf(event)}`}
        aria-current={openId === event.id ? 'true' : undefined}
        className="grid min-w-0 flex-1 content-start text-inherit no-underline outline-none after:absolute after:inset-0 after:rounded-[inherit] after:content-[''] focus-visible:after:outline-2 focus-visible:after:outline-offset-[-2px] focus-visible:after:outline-[var(--ink)]"
      >
        <span className="text-subhead font-semibold text-[var(--ink)] break-words">
          {event.title}
        </span>
        <span className="text-footnote text-[var(--muted)] break-words">
          {subtitleOf(event)}
        </span>
      </Link>
    </li>
  )
}
