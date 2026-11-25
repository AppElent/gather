import type { CalendarEvent } from '@gather/core/calendar'
import { weekOf } from '@gather/core/civil-date'
import { Link } from '@tanstack/react-router'
import { useI18n } from '../../lib/i18n'
import { dayTitle, eventStart, eventsOn, eventTime, weekdayShort } from './calendarView'
import { COLOR_TINT } from './colors'
import type { EventRowContext } from './EventRow'

/**
 * Seven days with their events stacked by time, no hour grid. Columns from
 * `lg`; below it seven columns are too narrow to read, so the days stack.
 */
export function WeekView({
  day,
  today,
  events,
  onSelect,
  linkOf,
  subtitleOf,
  openId,
}: EventRowContext & {
  day: string
  today: string
  events: readonly CalendarEvent[]
  onSelect: (date: string) => void
}) {
  const { locale, messages } = useI18n()
  const words = messages.calendar
  return (
    <div
      data-week=""
      className="grid gap-1 rounded-[var(--radius-card)] bg-[var(--surface)] p-2 lg:min-h-[420px] lg:grid-cols-7"
    >
      {weekOf(day).map((date) => {
        const dayEvents = eventsOn(events, date)
        return (
          <section
            key={date}
            aria-label={dayTitle(date, locale)}
            className={`flex min-w-0 gap-1 rounded-[var(--radius-control)] p-1 max-lg:items-start lg:flex-col ${
              date === today ? 'bg-[var(--home-wash)]' : ''
            } ${date === day ? 'outline-2 outline-offset-[-2px] outline-[var(--hair-strong)]' : ''}`}
          >
            <button
              type="button"
              data-date={date}
              aria-label={dayTitle(date, locale)}
              aria-pressed={date === day}
              aria-current={date === today ? 'date' : undefined}
              onClick={() => onSelect(date)}
              className="flex min-h-11 shrink-0 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-[var(--radius-control)] border-0 bg-transparent max-lg:w-12 hover:bg-[var(--surface-2)] lg:min-h-14"
            >
              <span className="text-[12px] font-semibold text-[var(--muted)]">
                {weekdayShort(date, locale)}
              </span>
              <span
                className={`grid h-6 min-w-6 place-items-center rounded-[var(--radius-pill)] px-1 text-footnote font-semibold tabular-nums ${
                  date === today
                    ? 'bg-[var(--accent)] text-[var(--on-accent)]'
                    : 'text-[var(--ink)]'
                }`}
              >
                {Number(date.slice(8))}
              </span>
            </button>
            <ul className="m-0 grid min-w-0 flex-1 list-none content-start gap-1 p-0 max-lg:self-center">
              {dayEvents.map((event) => (
                <li key={event.id} className="min-w-0">
                  <Link
                    {...linkOf(event)}
                    data-event={event.id}
                    aria-label={`${event.title}, ${eventTime(event, words.web.allDayRow)}, ${subtitleOf(event)}`}
                    aria-current={openId === event.id ? 'true' : undefined}
                    className={`grid min-h-11 min-w-0 content-center rounded-lg px-2 py-1 text-[var(--ink)] no-underline lg:min-h-0 ${COLOR_TINT[event.color]}`}
                  >
                    <span className="truncate text-[11px] leading-4 tabular-nums">
                      {eventStart(event, words.web.allDayRow)}
                    </span>
                    <span className="line-clamp-2 text-footnote font-semibold break-words">
                      {event.title}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
