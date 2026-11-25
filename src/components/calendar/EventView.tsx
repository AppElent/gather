import type { CalendarEvent, CalendarPerson } from '@gather/core/calendar'
import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useI18n, useMessages } from '../../lib/i18n'
import { buttonClass } from '../app/buttons'
import { EmptyState } from '../app/EmptyState'
import { dayTitle, eventTime } from './calendarView'
import { COLOR_BAR } from './colors'

export interface BackAction {
  label: string
  onClick: () => void
}

/** Back to the day: a link's look, above the event it replaces. */
function Back({ label, onClick }: BackAction) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="-ml-1 inline-flex min-h-9 pointer-coarse:min-h-[var(--size-control-min)] items-center gap-0.5 justify-self-start rounded-[var(--radius-pill)] bg-transparent pr-2 text-subhead font-semibold text-[var(--home-text)]"
    >
      <ChevronLeft className="size-4" aria-hidden="true" />
      {label}
    </button>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 px-3.5 py-2.5 [&+&]:border-t-[0.5px] [&+&]:border-[var(--hair)]">
      <dt className="text-footnote text-[var(--muted)]">{label}</dt>
      <dd className="m-0 text-subhead break-words whitespace-pre-wrap">
        {children}
      </dd>
    </div>
  )
}

/** One event: what it is, and Edit and Delete unless it is read-only. */
export function EventView({
  event,
  people,
  readOnly,
  onEdit,
  onDelete,
  back,
}: {
  event: CalendarEvent
  people: readonly CalendarPerson[]
  readOnly: boolean
  onEdit: () => void
  onDelete: () => void
  back?: BackAction
}) {
  const { locale, messages } = useI18n()
  const words = messages.calendar
  return (
    <section className="grid gap-3 p-[18px]">
      {back ? <Back {...back} /> : null}
      <div className="flex gap-3">
        <span
          aria-hidden="true"
          className={`w-1 shrink-0 rounded-[var(--radius-pill)] ${COLOR_BAR[event.color]}`}
        />
        <div className="min-w-0">
          <h2 className="m-0 font-rounded text-title-2 font-bold break-words">
            {event.title}
          </h2>
          <p className="m-0 mt-1 text-subhead text-[var(--muted)]">
            {dayTitle(event.date, locale)} ·{' '}
            {eventTime(event, words.web.allDayRow)}
          </p>
        </div>
      </div>
      {readOnly ? (
        <p className="m-0 rounded-[var(--radius-control)] bg-[var(--surface-2)] px-3.5 py-2.5 text-subhead">
          {words.web.readOnly}
        </p>
      ) : null}
      <dl className="m-0 rounded-2xl bg-[var(--ground)]">
        <Fact label={words.calendar}>{event.calendarName ?? ''}</Fact>
        <Fact label={words.who}>
          {event.assigneeIds.length > 0
            ? event.assigneeIds
                .map((id) => nameOf(id, people, words.formerMember))
                .join(', ')
            : words.unassigned}
        </Fact>
        {event.location ? (
          <Fact label={words.location}>{event.location}</Fact>
        ) : null}
        {event.notes ? <Fact label={words.notes}>{event.notes}</Fact> : null}
      </dl>
      {readOnly ? null : (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            className={buttonClass.secondary}
          >
            {messages.common.actions.edit}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className={buttonClass.danger}
          >
            {words.deleteEvent}
          </button>
        </div>
      )}
    </section>
  )
}

/** A Member's name; somebody who left the Group is not nameless. */
export function nameOf(
  id: string,
  people: readonly CalendarPerson[],
  former: string,
): string {
  return people.find((person) => person.id === id)?.name ?? former
}

/** In place of an event that is loading, or that is not there. */
export function EventNotice({
  loading,
  back,
}: {
  loading: boolean
  back: BackAction
}) {
  const words = useMessages().calendar
  return (
    <section className="grid gap-3 p-[18px]">
      <Back {...back} />
      {loading ? (
        <p role="status" className="m-0 text-subhead text-[var(--muted)]">
          {words.loadingEvents}
        </p>
      ) : (
        <EmptyState
          kind="nothing-for-you"
          title={words.web.gone}
          body={words.web.goneBody}
        />
      )}
    </section>
  )
}
