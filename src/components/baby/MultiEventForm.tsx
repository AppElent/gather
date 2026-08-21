import { type BabyBarSlot, offeredEventTypes } from '@gather/core/domain'
import { useMutation } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import type { BabyEventType } from '../../../convex/lib/babyEvents'
import { BABY_EVENT_TYPES } from '../../../convex/lib/babyEvents'
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
import { fmt, plural, useI18n } from '../../lib/i18n'
import { readLastUsed, writeLastUsed } from '../../lib/lastUsed'
import { EventIcon } from './EventIcon'
import { EventTypeFields } from './EventTypeFields'

interface MultiEventFormProps {
  babyId: Id<'babies'>
  /** The Group the entries belong to — every write is authorised by it. */
  groupSlug: string
  onDone: () => void
  onCancel: () => void
  /** What this Child's log refuses (ADR-0022). Absent means nothing. */
  untrackedTypes?: readonly BabyEventType[]
  /** The household's own arrangement, so both clients offer the same order. */
  barOrder?: readonly BabyBarSlot[]
}

const LAST_USED_KEY = 'multiLogTypes'
// The common round: check the diaper, take the temperature, then feed.
const DEFAULT_SELECTION: BabyEventType[] = ['diaper', 'temperature', 'feeding']

/**
 * What starts checked, never offering a type this Child does not track.
 *
 * The remembered choice and the default round are both intersected with the
 * offer, so a Child who stopped tracking temperature does not open this form
 * with temperature ticked. Falling back to the first offered type rather than
 * to nothing keeps the form usable for a Child tracking only one thing.
 */
function initialSelection(offered: readonly BabyEventType[]): BabyEventType[] {
  const stored = readLastUsed(LAST_USED_KEY)
  const parsed = stored
    ? stored
        .split(',')
        .filter((t): t is BabyEventType =>
          (BABY_EVENT_TYPES as readonly string[]).includes(t),
        )
        .filter((t) => offered.includes(t))
    : []
  if (parsed.length > 0) return parsed
  const fallback = DEFAULT_SELECTION.filter((t) => offered.includes(t))
  return fallback.length > 0 ? fallback : offered.slice(0, 1)
}

/** Logs several entries at one shared timestamp — one separate babyEvents row
 * per checked type, so everything downstream (timeline, charts, per-category
 * export) keeps working unchanged. */
export function MultiEventForm({
  babyId,
  groupSlug,
  onDone,
  onCancel,
  untrackedTypes,
  barOrder,
}: MultiEventFormProps) {
  const add = useMutation(api.babyEvents.add)
  const offered = offeredEventTypes(untrackedTypes, barOrder)

  const [timestampMs, setTimestampMs] = useState(() => Date.now())
  const [selected, setSelected] = useState<BabyEventType[]>(() =>
    initialSelection(offered),
  )
  const [valuesByType, setValuesByType] = useState<
    Partial<Record<BabyEventType, EventValues>>
  >(() => {
    const initial: Partial<Record<BabyEventType, EventValues>> = {}
    for (const type of initialSelection(offered)) {
      initial[type] = initialEventValues(type)
    }
    return initial
  })
  const [notesByType, setNotesByType] = useState<
    Partial<Record<BabyEventType, string>>
  >({})
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<BabyEventType, string>>
  >({})
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const { locale, messages } = useI18n()
  const { multi, validation } = messages.baby.log
  const eventTypes = messages.baby.eventTypes

  function toggleType(type: BabyEventType) {
    setSelected((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    )
    setValuesByType((prev) =>
      prev[type] ? prev : { ...prev, [type]: initialEventValues(type) },
    )
  }

  // Rendered in the canonical type order rather than the order they were
  // checked, so the form doesn't reshuffle as boxes are ticked.
  const activeTypes = offered.filter((t) => selected.includes(t))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const inputs: { type: BabyEventType; values: EventValues }[] = []
    const errors: Partial<Record<BabyEventType, string>> = {}
    // Keys in, sentences out: the validator does not know the language.
    for (const type of activeTypes) {
      const values = valuesByType[type] ?? initialEventValues(type)
      const built = buildEventInput(type, values, timestampMs)
      if (built.error) errors[type] = validation[built.error]
      else inputs.push({ type, values })
    }
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    const saved: BabyEventType[] = []
    try {
      for (const { type, values } of inputs) {
        const built = buildEventInput(type, values, timestampMs)
        await add({
          babyId,
          groupSlug,
          type,
          timestamp: timestampMs,
          endTimestamp: built.endTimestamp,
          notes: notesByType[type]?.trim() || undefined,
          data: built.data,
        })
        rememberEventChoices(type, values)
        saved.push(type)
      }
      writeLastUsed(LAST_USED_KEY, activeTypes.join(','))
      onDone()
    } catch (err) {
      // Keep only what still needs saving on screen, so a retry doesn't
      // duplicate the entries that already went through.
      setSelected((prev) => prev.filter((t) => !saved.includes(t)))
      const detail = errorMessage(err, messages.baby.log.entry.saveFailed)
      setError(
        saved.length > 0
          ? fmt(multi.partial, {
              saved: saved.length,
              total: inputs.length,
              detail,
            })
          : detail,
      )
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <h3 className="m-0 text-sm font-semibold">{multi.heading}</h3>

      <div className="min-w-0 sm:max-w-sm">
        <span className="mb-1 block text-sm font-medium">{multi.when}</span>
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

      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-1 text-sm font-medium">{multi.include}</legend>
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
          {offered.map((type) => (
            <label key={type} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(type)}
                onChange={() => toggleType(type)}
              />
              {eventTypes[type]}
            </label>
          ))}
        </div>
      </fieldset>

      {activeTypes.map((type) => (
        <div
          key={type}
          className="grid gap-3 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-3"
        >
          <p className="m-0 flex items-center gap-2 text-sm font-semibold">
            <EventIcon type={type} />
            {eventTypes[type]}
          </p>
          <EventTypeFields
            type={type}
            values={valuesByType[type] ?? initialEventValues(type)}
            timestampMs={timestampMs}
            onChange={(patch) =>
              setValuesByType((prev) => ({
                ...prev,
                [type]: {
                  ...(prev[type] ?? initialEventValues(type)),
                  ...patch,
                },
              }))
            }
          />
          <label className="block text-sm">
            <span className="mb-1 block font-medium">
              {messages.baby.log.entry.notes}
            </span>
            <input
              className={inputClass}
              value={notesByType[type] ?? ''}
              onChange={(e) =>
                setNotesByType((prev) => ({ ...prev, [type]: e.target.value }))
              }
            />
          </label>
          {fieldErrors[type] && (
            <p className="m-0 text-sm text-red-800">{fieldErrors[type]}</p>
          )}
        </div>
      ))}

      {activeTypes.length === 0 && (
        <p className="m-0 text-sm text-[var(--app-muted)]">{multi.pickOne}</p>
      )}

      {error && <p className="m-0 text-sm text-red-800">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting || activeTypes.length === 0}
          className="min-h-9 rounded-[var(--app-radius)] border border-[var(--app-fg)] bg-[var(--app-fg)] px-3 text-sm font-semibold text-[var(--app-surface)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting
            ? messages.common.actions.saving
            : plural(locale, activeTypes.length, multi.save)}
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
