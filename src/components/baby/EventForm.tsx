import { useMutation } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import type { BabyEventType } from '../../../convex/lib/babyEvents'
import {
  combineDateTime,
  toDateInputValue,
  toTimeInputValue,
} from '../../lib/babyDate'
import { BABY_INPUT_CLASS as inputClass } from '../../lib/babyEventFields'
import type { EventValues } from '../../lib/babyEventFormValues'
import {
  buildEventInput,
  initialEventValues,
  rememberEventChoices,
} from '../../lib/babyEventFormValues'
import { errorMessage } from '../../lib/errorMessage'
import { fmt, useMessages } from '../../lib/i18n'
import { EventTypeFields } from './EventTypeFields'

type BabyEventDoc = Doc<'babyEvents'>

interface EventFormProps {
  babyId: Id<'babies'>
  /** The Group the entry belongs to — every write is authorised by it. */
  groupSlug: string
  type: BabyEventType
  event?: BabyEventDoc
  onDone: () => void
  onCancel: () => void
}

export function EventForm({
  babyId,
  groupSlug,
  type,
  event,
  onDone,
  onCancel,
}: EventFormProps) {
  const add = useMutation(api.babyEvents.add)
  const update = useMutation(api.babyEvents.update)

  const [timestampMs, setTimestampMs] = useState(event?.timestamp ?? Date.now())
  const [values, setValues] = useState<EventValues>(() =>
    initialEventValues(type, event),
  )
  const [notes, setNotes] = useState(event?.notes ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messages = useMessages()
  const { entry, validation } = messages.baby.log
  const typeName = messages.baby.eventTypes[type]

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const built = buildEventInput(type, values, timestampMs)
    if (built.error) {
      setError(validation[built.error])
      return
    }
    rememberEventChoices(type, values)
    setSubmitting(true)
    setError(null)
    try {
      if (event) {
        await update({
          eventId: event._id,
          groupSlug,
          timestamp: timestampMs,
          endTimestamp: built.endTimestamp ?? null,
          notes: notes.trim() || null,
          data: built.data,
        })
      } else {
        await add({
          babyId,
          groupSlug,
          type,
          timestamp: timestampMs,
          endTimestamp: built.endTimestamp,
          notes: notes.trim() || undefined,
          data: built.data,
        })
      }
      onDone()
    } catch (err) {
      setError(errorMessage(err, entry.saveFailed))
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <h3 className="m-0 text-sm font-semibold">
        {/* The name is not lowercased on the way in: English put the type
            after "Log " and could take a lowercase word, Dutch puts it first
            and cannot. Each locale's template decides its own capitalisation. */}
        {fmt(event ? entry.editTitle : entry.logTitle, { type: typeName })}
      </h3>

      <div className="min-w-0 sm:max-w-sm">
        <span className="mb-1 block text-sm font-medium">
          {type === 'sleep' ? entry.start : entry.when}
        </span>
        <div className="flex gap-2">
          <input
            type="date"
            className={inputClass}
            value={toDateInputValue(timestampMs)}
            onChange={(e) =>
              setTimestampMs(
                combineDateTime(e.target.value, toTimeInputValue(timestampMs)),
              )
            }
            required
          />
          <input
            type="time"
            className={inputClass}
            value={toTimeInputValue(timestampMs)}
            onChange={(e) =>
              setTimestampMs(
                combineDateTime(toDateInputValue(timestampMs), e.target.value),
              )
            }
            required
          />
        </div>
      </div>

      <EventTypeFields
        type={type}
        values={values}
        timestampMs={timestampMs}
        onChange={(patch) => setValues((prev) => ({ ...prev, ...patch }))}
      />

      <label className="block text-sm">
        <span className="mb-1 block font-medium">{entry.notes}</span>
        <textarea
          className={inputClass}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
      </label>

      {error && <p className="m-0 text-sm text-red-800">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="min-h-9 rounded-[var(--app-radius)] border border-[var(--app-fg)] bg-[var(--app-fg)] px-3 text-sm font-semibold text-[var(--app-surface)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting
            ? messages.common.actions.saving
            : messages.common.actions.save}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-9 px-2 text-sm text-[var(--app-muted)]"
        >
          {messages.common.actions.cancel}
        </button>
      </div>
    </form>
  )
}
