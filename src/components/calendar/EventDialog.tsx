import {
  type CalendarEvent,
  type CalendarFieldErrors,
  type CalendarPerson,
  hasCalendarErrors,
  validateCalendarFields,
} from '@gather/core/calendar'
import { hourIn } from '@gather/core/civil-date'
import { readCalendarRefusal } from '@gather/core/refusals'
import { useMutation } from 'convex/react'
import { type FormEvent, type ReactNode, useId, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useErrorMessage } from '../../lib/errorMessage'
import { useMessages } from '../../lib/i18n'
import { buttonClass } from '../app/buttons'
import { useConfirmAction } from '../app/ConfirmAction'
import { Dialog } from '../app/Dialog'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'
import { inputClass } from '../recipes/fields'
import { nameOf } from './EventView'
import {
  clockToMinutes,
  clockValue,
  defaultStart,
  type EventValues,
  emptyEvent,
  isChanged,
  moveStart,
  savedFields,
  startingAt,
  valuesOf,
} from './eventForm'
import { useCalendarEvent, type WebCalendar } from './useCalendar'

/**
 * A new event, or an existing one's fields: the phone's composer as a dialog,
 * a sheet below `lg`. One key per opening makes one event however often Save
 * is pressed. Closing with changes asks first.
 */
export function EventDialog({
  event,
  day,
  today,
  calendars,
  people,
  onSaved,
  onClose,
}: {
  /** The event being edited; absent for a new one. */
  event?: CalendarEvent
  /** The day a new event starts on. */
  day: string
  today: string
  /** The calendars that can be written to. */
  calendars: readonly WebCalendar[]
  people: readonly CalendarPerson[]
  onSaved: (saved: { id: string; date: string; calendarId: string }) => void
  onClose: () => void
}) {
  const { slug: groupSlug, timeZone } = useRequiredCurrentGroup()
  const messages = useMessages()
  const words = messages.calendar
  const errorText = useErrorMessage()
  const add = useMutation(api.calendar.addCalendarEvent)
  const update = useMutation(api.calendar.updateEvent)
  // What is stored now, for a save that comes after somebody else's change.
  const stored = useCalendarEvent(event?.id)
  const latest = useRef(stored)
  latest.current = stored
  const { confirm, dialog } = useConfirmAction()
  const formId = useId()
  const titleRef = useRef<HTMLInputElement>(null)
  const submitting = useRef(false)

  const [initial] = useState(() =>
    event ? valuesOf(event) : emptyEvent(day, calendars[0]?.id ?? null),
  )
  const [values, setValues] = useState<EventValues>(initial)
  const [key] = useState(() => crypto.randomUUID())
  const [conflicted, setConflicted] = useState(false)
  const [asNew, setAsNew] = useState(!event)
  const [errors, setErrors] = useState<CalendarFieldErrors>({})
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const set = (change: Partial<EventValues>) => {
    setValues((current) => ({ ...current, ...change }))
    setFailure(null)
  }

  const close = () => {
    if (submitting.current) return
    if (!isChanged(values, initial)) return onClose()
    confirm({
      title: words.unsavedChanges,
      confirmLabel: words.web.discard,
      run: onClose,
    })
  }

  const save = async (submitted: FormEvent) => {
    submitted.preventDefault()
    if (submitting.current) return
    const problems = validateCalendarFields(values)
    setErrors(problems)
    if (hasCalendarErrors(problems) || !values.calendarId) {
      if (problems.title) titleRef.current?.focus()
      return
    }
    submitting.current = true
    setSaving(true)
    setFailure(null)
    const { location, notes, startMinutes, endMinutes, ...rest } =
      savedFields(values)
    const fields = {
      ...rest,
      groupSlug,
      calendarId: values.calendarId as Id<'calendars'>,
      assigneeIds: values.assigneeIds as Id<'users'>[],
    }
    try {
      const id =
        event && !asNew
          ? (
              await update({
                ...fields,
                id: event.id as Id<'calendarEvents'>,
                expectedRevision:
                  (conflicted ? latest.current?.revision : undefined) ??
                  event.revision,
                startMinutes,
                endMinutes,
                location,
                notes,
              })
            ).id
          : await add({
              ...fields,
              startMinutes: startMinutes ?? undefined,
              endMinutes: endMinutes ?? undefined,
              location: location ?? undefined,
              notes: notes ?? undefined,
              idempotencyKey: key,
            })
      submitting.current = false
      onSaved({ id, date: values.date, calendarId: values.calendarId })
    } catch (caught) {
      submitting.current = false
      setSaving(false)
      const refusal = readCalendarRefusal(caught)
      if (refusal === 'conflict') {
        setConflicted(true)
        setFailure(words.web.conflictSave)
      } else if (
        event &&
        latest.current === null &&
        (refusal === 'not-found' || refusal === 'deleted')
      ) {
        setAsNew(true)
        setFailure(words.web.deletedSave)
      } else setFailure(errorText(caught, words.errors.save))
    }
  }

  // Somebody who left the Group stays on the event until taken off it.
  const choices = [
    ...people.map(({ id }) => id),
    ...initial.assigneeIds.filter(
      (id) => !people.some((person) => person.id === id),
    ),
  ]
  const problem = (field: keyof CalendarFieldErrors) => {
    const kind = errors[field]
    return kind ? words.validation[kind] : undefined
  }

  return (
    <>
      <Dialog
        title={event ? words.web.editTitle : words.newEvent}
        onClose={close}
        initialFocus={titleRef}
        actions={
          <>
            <button
              type="button"
              onClick={close}
              className={buttonClass.secondary}
            >
              {messages.common.actions.cancel}
            </button>
            <button
              type="submit"
              form={formId}
              disabled={saving}
              className={buttonClass.primary}
            >
              {saving ? messages.common.actions.saving : words.save}
            </button>
          </>
        }
      >
        <form
          id={formId}
          noValidate
          onSubmit={(submitted) => void save(submitted)}
          className="grid grid-cols-[minmax(0,1fr)] gap-3.5"
        >
          <Field label={words.title} error={problem('title')}>
            {(props) => (
              <input
                {...props}
                ref={titleRef}
                value={values.title}
                placeholder={words.titlePlaceholder}
                onChange={(e) => set({ title: e.target.value })}
                className={inputClass}
              />
            )}
          </Field>
          <Field label={words.calendar} error={problem('calendarId')}>
            {(props) => (
              <select
                {...props}
                value={values.calendarId ?? ''}
                onChange={(e) => set({ calendarId: e.target.value })}
                className={inputClass}
              >
                {calendars.map(({ id, name }) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={words.date} error={problem('date')}>
            {(props) => (
              <input
                {...props}
                type="date"
                value={values.date}
                onChange={(e) => set({ date: e.target.value })}
                className={inputClass}
              />
            )}
          </Field>
          <label className="flex min-h-[var(--size-control-min)] items-center gap-2.5 text-subhead">
            <input
              type="checkbox"
              checked={values.allDay}
              onChange={(e) =>
                set({
                  allDay: e.target.checked,
                  ...(!e.target.checked && values.startMinutes === null
                    ? startingAt(
                        defaultStart(values.date, today, hourIn(timeZone)),
                      )
                    : {}),
                })
              }
              className="size-5 accent-[var(--accent-text)]"
            />
            {words.allDay}
          </label>
          {values.allDay ? null : (
            <div className="grid grid-cols-2 gap-3">
              <Field label={words.startTime} error={problem('time')}>
                {(props) => (
                  <input
                    {...props}
                    type="time"
                    value={clockValue(values.startMinutes)}
                    onChange={(e) =>
                      set(moveStart(values, clockToMinutes(e.target.value)))
                    }
                    className={inputClass}
                  />
                )}
              </Field>
              <Field label={words.endTime}>
                {(props) => (
                  <input
                    {...props}
                    type="time"
                    value={clockValue(values.endMinutes)}
                    onChange={(e) =>
                      set({ endMinutes: clockToMinutes(e.target.value) })
                    }
                    className={inputClass}
                  />
                )}
              </Field>
            </div>
          )}
          {choices.length > 0 ? (
            <fieldset className="m-0 grid gap-1.5 border-0 p-0">
              <legend className="mb-1.5 p-0 text-footnote font-semibold text-[var(--muted)]">
                {words.who}
              </legend>
              <div className="flex flex-wrap gap-2">
                {choices.map((id) => {
                  const on = values.assigneeIds.includes(id)
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        set({
                          assigneeIds: on
                            ? values.assigneeIds.filter((each) => each !== id)
                            : [...values.assigneeIds, id],
                        })
                      }
                      className={`inline-flex min-h-9 pointer-coarse:min-h-[var(--size-control-min)] items-center rounded-[var(--radius-pill)] border px-3.5 text-subhead ${
                        on
                          ? 'border-[var(--ink)] bg-[var(--surface-2)] font-semibold'
                          : 'border-[var(--control-edge)] bg-transparent'
                      }`}
                    >
                      {nameOf(id, people, words.formerMember)}
                    </button>
                  )
                })}
              </div>
            </fieldset>
          ) : null}
          <Field label={words.location} error={problem('location')}>
            {(props) => (
              <input
                {...props}
                value={values.location}
                placeholder={words.locationPlaceholder}
                onChange={(e) => set({ location: e.target.value })}
                className={inputClass}
              />
            )}
          </Field>
          <Field label={words.notes} error={problem('notes')}>
            {(props) => (
              <textarea
                {...props}
                rows={3}
                value={values.notes}
                placeholder={words.notesPlaceholder}
                onChange={(e) => set({ notes: e.target.value })}
                className={inputClass}
              />
            )}
          </Field>
          {failure ? (
            <p role="alert" className="m-0 text-subhead text-[var(--danger)]">
              {failure}
            </p>
          ) : null}
        </form>
      </Dialog>
      {dialog}
    </>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: (props: {
    id: string
    'aria-invalid': boolean | undefined
    'aria-describedby': string | undefined
  }) => ReactNode
}) {
  const id = useId()
  return (
    <div className="grid min-w-0 gap-1.5">
      <label
        htmlFor={id}
        className="text-footnote font-semibold text-[var(--muted)]"
      >
        {label}
      </label>
      {children({
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': error ? `${id}-error` : undefined,
      })}
      {error ? (
        <p
          id={`${id}-error`}
          className="m-0 text-footnote text-[var(--danger)]"
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}
