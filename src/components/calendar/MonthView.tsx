import type { CalendarEvent } from '@gather/core/calendar'
import { orderCalendarEvents } from '@gather/core/calendar'
import { useEffect, useMemo, useRef } from 'react'
import { fmt, plural, useI18n } from '../../lib/i18n'
import { dayTitle, monthWeeks, sameMonth, weekdayShort } from './calendarView'
import { COLOR_BAR, COLOR_TINT } from './colors'

const SHOWN = 2

/**
 * The month as a card of five or six weeks. A day shows up to two events and
 * how many more it has; below `md` there is only room for their colours. One
 * day is the tab stop, and the arrow keys (`useCalendarKeys`) take it along.
 */
export function MonthView({
  day,
  today,
  events,
  onSelect,
}: {
  day: string
  today: string
  events: readonly CalendarEvent[]
  onSelect: (date: string) => void
}) {
  const { locale, messages } = useI18n()
  const words = messages.calendar
  const gridRef = useRef<HTMLDivElement>(null)
  const weeks = monthWeeks(day)
  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const event of orderCalendarEvents(events))
      map.set(event.date, [...(map.get(event.date) ?? []), event])
    return map
  }, [events])

  // Focus that was on a day goes along with the day the arrows selected.
  useEffect(() => {
    if (!gridRef.current?.contains(document.activeElement)) return
    gridRef.current
      .querySelector<HTMLElement>(`[data-date="${day}"]`)
      ?.focus({ preventScroll: true })
  }, [day])

  return (
    <div className="rounded-[var(--radius-card)] bg-[var(--surface)] px-2 pt-2 pb-2.5">
      <div
        aria-hidden="true"
        className="grid grid-cols-7 pt-1 pb-1.5 text-center text-[12px] font-semibold text-[var(--muted)]"
      >
        {weeks[0].map((date) => (
          <span key={date}>{weekdayShort(date, locale)}</span>
        ))}
      </div>
      <div
        ref={gridRef}
        data-calendar-grid=""
        data-weeks={weeks.length}
        className="grid grid-cols-7 gap-0.5"
      >
        {weeks.flat().map((date) => {
          const dayEvents = byDate.get(date) ?? []
          const more = dayEvents.length - SHOWN
          const inMonth = sameMonth(date, day)
          const name = [
            dayTitle(date, locale),
            ...(dayEvents.length > 0
              ? [plural(locale, dayEvents.length, words.web.eventCount)]
              : []),
          ].join(', ')
          return (
            <button
              key={date}
              type="button"
              data-date={date}
              aria-label={name}
              aria-pressed={date === day}
              aria-current={date === today ? 'date' : undefined}
              tabIndex={date === day ? 0 : -1}
              onClick={() => onSelect(date)}
              className={`flex h-14 min-w-0 cursor-pointer flex-col gap-0.5 overflow-hidden rounded-[var(--radius-control)] border-0 p-1 text-left max-md:items-center md:h-[86px] ${
                date === today
                  ? 'bg-[var(--home-wash)]'
                  : date === day
                    ? 'bg-[var(--surface-2)]'
                    : 'bg-transparent hover:bg-[var(--surface-2)]'
              } ${date === day ? 'outline-2 outline-offset-[-2px] outline-[var(--hair-strong)]' : ''} focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--ink)]`}
            >
              <span
                className={`grid h-6 min-w-6 shrink-0 place-items-center self-start rounded-[var(--radius-pill)] px-1 text-footnote font-semibold tabular-nums max-md:self-center ${
                  date === today
                    ? 'bg-[var(--accent)] text-[var(--on-accent)]'
                    : inMonth
                      ? 'text-[var(--ink)]'
                      : 'text-[var(--muted)]'
                }`}
              >
                {Number(date.slice(8))}
              </span>
              <span className="flex gap-0.5 md:hidden" aria-hidden="true">
                {dayEvents.slice(0, 3).map((event) => (
                  <span
                    key={event.id}
                    className={`size-1.5 rounded-[var(--radius-pill)] ${COLOR_BAR[event.color]}`}
                  />
                ))}
              </span>
              {dayEvents.slice(0, SHOWN).map((event) => (
                <span
                  key={event.id}
                  className={`block w-full shrink-0 truncate rounded-[5px] px-[5px] text-[11px] leading-4 text-[var(--ink)] max-md:hidden ${COLOR_TINT[event.color]}`}
                >
                  {event.title}
                </span>
              ))}
              {more > 0 ? (
                <span className="block truncate px-[5px] text-[11px] leading-4 text-[var(--ink)] max-md:hidden">
                  {fmt(words.web.more, { count: more })}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
