import { CALENDAR_COLORS } from '@gather/core/calendar'
import { useMutation } from 'convex/react'
import { Check, Trash2 } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { useErrorMessage } from '../../lib/errorMessage'
import { fmt, useMessages } from '../../lib/i18n'
import { buttonClass } from '../app/buttons'
import { useConfirmAction } from '../app/ConfirmAction'
import { Dialog } from '../app/Dialog'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'
import { fieldClass } from '../recipes/fields'
import { COLOR_BAR } from './colors'
import type { WebCalendar } from './useCalendar'

/** The phone's Calendars sheet: colour, delete and add. */
export function CalendarsDialog({
  calendars,
  onClose,
}: {
  calendars: readonly WebCalendar[]
  onClose: () => void
}) {
  const { slug: groupSlug } = useRequiredCurrentGroup()
  const messages = useMessages()
  const words = messages.calendar
  const errorText = useErrorMessage()
  const add = useMutation(api.calendar.addCalendar)
  const update = useMutation(api.calendar.updateCalendar)
  const remove = useMutation(api.calendar.removeCalendar)
  const { confirm, dialog } = useConfirmAction()
  const [name, setName] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const attempt = async (work: Promise<unknown>) => {
    setError(null)
    try {
      await work
      return true
    } catch (caught) {
      setError(errorText(caught, messages.common.errors.didNotWork))
      return false
    }
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim() || adding) return
    setAdding(true)
    if (await attempt(add({ groupSlug, name: name.trim() }))) setName('')
    setAdding(false)
  }

  return (
    <>
      <Dialog title={words.web.manage.replace('…', '')} onClose={onClose}>
        {calendars.length > 0 ? (
          <ul className="m-0 grid list-none gap-1 p-0">
            {calendars.map((calendar) => (
              <li
                key={calendar.id}
                className="flex min-h-[var(--size-row-min)] flex-wrap items-center gap-x-3 gap-y-1"
              >
                <span className="min-w-32 flex-1 text-body break-words">
                  {calendar.name}
                </span>
                {calendar.readOnly ? (
                  <span className="text-footnote text-[var(--muted)]">
                    {words.web.readOnlyRow}
                  </span>
                ) : (
                  <>
                    <span className="flex">
                      {CALENDAR_COLORS.map((color) => {
                        const label = fmt(words.web.colorOf, {
                          calendar: calendar.name,
                          color: words.web.colors[color],
                        })
                        return (
                          <button
                            key={color}
                            type="button"
                            aria-label={label}
                            title={label}
                            aria-pressed={calendar.color === color}
                            onClick={() =>
                              void attempt(
                                update({ groupSlug, id: calendar.id, color }),
                              )
                            }
                            className="grid size-9 pointer-coarse:size-[var(--size-control-min)] place-items-center rounded-[var(--radius-pill)] bg-transparent"
                          >
                            <span
                              className={`grid size-5 place-items-center rounded-[var(--radius-pill)] text-[var(--surface)] ${COLOR_BAR[color]}`}
                            >
                              {calendar.color === color ? (
                                <Check
                                  className="size-3.5"
                                  strokeWidth={3}
                                  aria-hidden="true"
                                />
                              ) : null}
                            </span>
                          </button>
                        )
                      })}
                    </span>
                    <button
                      type="button"
                      aria-label={fmt(words.web.deleteCalendar, {
                        calendar: calendar.name,
                      })}
                      onClick={() =>
                        confirm({
                          title: fmt(words.confirmDelete, {
                            title: calendar.name,
                          }),
                          body: words.deleteCalendarBody,
                          confirmLabel: messages.common.actions.delete,
                          run: () => remove({ groupSlug, id: calendar.id }),
                        })
                      }
                      className="grid size-9 pointer-coarse:size-[var(--size-control-min)] place-items-center rounded-[var(--radius-pill)] bg-transparent text-[var(--danger)] hover:bg-[var(--surface-2)]"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 text-subhead text-[var(--muted)]">
            {words.web.noCalendarsBody}
          </p>
        )}
        {error ? (
          <p role="alert" className="m-0 text-subhead text-[var(--danger)]">
            {error}
          </p>
        ) : null}
        <form
          onSubmit={(event) => void submit(event)}
          className="flex flex-wrap gap-2"
        >
          <input
            value={name}
            aria-label={words.web.calendarName}
            placeholder={words.web.calendarName}
            onChange={(event) => setName(event.target.value)}
            className={`${fieldClass} min-w-40 flex-1`}
          />
          <button
            type="submit"
            disabled={!name.trim() || adding}
            className={buttonClass.secondary}
          >
            {words.addCalendar}
          </button>
        </form>
      </Dialog>
      {dialog}
    </>
  )
}
