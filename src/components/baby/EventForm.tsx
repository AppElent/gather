import { useMutation } from 'convex/react'
import { ConvexError } from 'convex/values'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import type { BabyEventType } from '../../../convex/lib/babyEvents'
import { BABY_EVENT_LABELS } from '../../../convex/lib/babyEvents'
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
import { EventTypeFields } from './EventTypeFields'

type BabyEventDoc = Doc<'babyEvents'>

interface EventFormProps {
  spaceSlug: string
  babyId: Id<'babies'>
  type: BabyEventType
  event?: BabyEventDoc
  onDone: () => void
  onCancel: () => void
}

export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ConvexError) {
    return typeof err.data === 'string' ? err.data : fallback
  }
  return err instanceof Error ? err.message : fallback
}

export function EventForm({
  spaceSlug,
  babyId,
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

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const built = buildEventInput(type, values, timestampMs)
    if (built.error) {
      setError(built.error)
      return
    }
    rememberEventChoices(type, values)
    setSubmitting(true)
    setError(null)
    try {
      if (event) {
        await update({
          spaceSlug,
          eventId: event._id,
          timestamp: timestampMs,
          endTimestamp: built.endTimestamp ?? null,
          notes: notes.trim() || null,
          data: built.data,
        })
      } else {
        await add({
          spaceSlug,
          babyId,
          type,
          timestamp: timestampMs,
          endTimestamp: built.endTimestamp,
          notes: notes.trim() || undefined,
          data: built.data,
        })
      }
      onDone()
    } catch (err) {
      setError(errorMessage(err, 'Could not save this entry'))
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <h3 className="m-0 text-sm font-semibold">
        {event ? 'Edit' : 'Log'} {BABY_EVENT_LABELS[type].toLowerCase()}
      </h3>

      <div className="min-w-0 sm:max-w-sm">
        <span className="mb-1 block text-sm font-medium">
          {type === 'sleep' ? 'Start' : 'When'}
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
        <span className="mb-1 block font-medium">Notes</span>
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
          {submitting ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-9 px-2 text-sm text-[var(--app-muted)]"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
