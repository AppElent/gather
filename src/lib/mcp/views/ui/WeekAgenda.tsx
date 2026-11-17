import { useState } from 'react'
import type { AgendaEvent, WeekAgendaResult } from '../types'
import type { ViewText } from './i18n'
import type { ViewProps } from './ViewRoot'

function time(event: AgendaEvent, text: ViewText) {
  if (event.allDay || !event.start) return text.t.agenda.allDay
  return event.end ? `${event.start}–${event.end}` : event.start
}

export function WeekAgenda({
  result,
  text,
  reload,
  header,
}: ViewProps<WeekAgendaResult>) {
  const { t } = text
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const go = async (weekStart: string) => {
    setBusy(true)
    setFailed(false)
    try {
      await reload('show_week_agenda', { groupId: result.groupId, weekStart })
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }
  const total = result.days.reduce((sum, day) => sum + day.events.length, 0)
  return (
    <section aria-busy={busy}>
      <header className="toolbar">
        <div>
          <p className="eyebrow">{result.groupName}</p>
          <h2>
            {text.fmt(t.agenda.title, {
              date: text.day(result.weekStart, 'dayMonth'),
            })}
          </h2>
          <p className="muted small">
            {result.isCurrentWeek ? `${t.agenda.thisWeek} · ` : ''}
            {text.plural(total, t.agenda.count)}
          </p>
        </div>
        <div className="actions">
          <button
            type="button"
            className="icon-button"
            aria-label={t.agenda.previous}
            title={t.agenda.previous}
            disabled={busy}
            onClick={() => void go(result.previousWeekStart)}
          >
            ‹
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label={t.agenda.next}
            title={t.agenda.next}
            disabled={busy}
            onClick={() => void go(result.nextWeekStart)}
          >
            ›
          </button>
          {header}
        </div>
      </header>
      {failed && (
        <p className="notice danger" role="alert">
          {t.common.error}
        </p>
      )}
      <ol className="agenda">
        {result.days.map((day) => {
          const isToday = day.date === result.today
          return (
            <li
              key={day.date}
              className="agenda-day"
              data-today={isToday || undefined}
            >
              <h3>
                <span className="weekday">{text.day(day.date, 'weekday')}</span>
                <span className="date">{text.day(day.date, 'dayMonth')}</span>
                {isToday && <span className="badge">{t.agenda.today}</span>}
              </h3>
              {day.events.length === 0 ? (
                <p className="muted small">{t.agenda.nothing}</p>
              ) : (
                <ul className="events">
                  {day.events.map((event) => (
                    <li key={event.id} className="event">
                      <span className="event-time">{time(event, text)}</span>
                      <span className="event-body">
                        <strong>{event.title}</strong>
                        <span className="muted small">
                          {[event.calendar, event.location]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ol>
      {result.truncated && (
        <p className="notice muted small">{t.agenda.truncated}</p>
      )}
    </section>
  )
}
