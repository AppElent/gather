import { useMutation } from 'convex/react'
import { ConvexError } from 'convex/values'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import type { BabyEventType } from '../../../convex/lib/babyEvents'
import { BABY_EVENT_LABELS } from '../../../convex/lib/babyEvents'
import {
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from '../../lib/babyDate'
import {
  DIAPER_KIND_LABELS,
  FEEDING_METHOD_LABELS,
  FEEDING_SIDE_LABELS,
  TEMPERATURE_METHOD_LABELS,
} from '../../lib/babyEventFields'
import { readLastUsed, writeLastUsed } from '../../lib/lastUsed'

const inputClass =
  'w-full rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--app-accent)] disabled:cursor-not-allowed disabled:opacity-60'

type BabyEventDoc = Doc<'babyEvents'>

interface EventFormProps {
  babyId: Id<'babies'>
  type: BabyEventType
  event?: BabyEventDoc
  onDone: () => void
  onCancel: () => void
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ConvexError) {
    return typeof err.data === 'string' ? err.data : fallback
  }
  return err instanceof Error ? err.message : fallback
}

export function EventForm({
  babyId,
  type,
  event,
  onDone,
  onCancel,
}: EventFormProps) {
  const add = useMutation(api.babyEvents.add)
  const update = useMutation(api.babyEvents.update)
  const data = (event?.data ?? {}) as Record<string, unknown>

  const [timestamp, setTimestamp] = useState(
    toDatetimeLocalValue(event?.timestamp ?? Date.now()),
  )
  const [endTimestamp, setEndTimestamp] = useState(
    event?.endTimestamp ? toDatetimeLocalValue(event.endTimestamp) : '',
  )
  const [notes, setNotes] = useState(event?.notes ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [celsius, setCelsius] = useState(
    typeof data.celsius === 'number' ? String(data.celsius) : '',
  )
  const [tempMethod, setTempMethod] = useState(
    typeof data.method === 'string'
      ? data.method
      : (readLastUsed('temperatureMethod') ?? ''),
  )

  const [feedingMethod, setFeedingMethod] = useState(
    typeof data.method === 'string'
      ? data.method
      : (readLastUsed('feedingMethod') ?? 'bottle'),
  )
  const [feedingSide, setFeedingSide] = useState(
    typeof data.side === 'string'
      ? data.side
      : (readLastUsed('feedingSide') ?? ''),
  )
  const [amountMl, setAmountMl] = useState(
    typeof data.amountMl === 'number' ? String(data.amountMl) : '',
  )

  const [diaperKind, setDiaperKind] = useState(
    typeof data.kind === 'string'
      ? data.kind
      : (readLastUsed('diaperKind') ?? 'wet'),
  )

  const [weightKg, setWeightKg] = useState(
    typeof data.weightKg === 'number' ? String(data.weightKg) : '',
  )
  const [heightCm, setHeightCm] = useState(
    typeof data.heightCm === 'number' ? String(data.heightCm) : '',
  )
  const [headCircumferenceCm, setHeadCircumferenceCm] = useState(
    typeof data.headCircumferenceCm === 'number'
      ? String(data.headCircumferenceCm)
      : '',
  )

  const [medName, setMedName] = useState(
    typeof data.name === 'string' ? data.name : '',
  )
  const [doseAmount, setDoseAmount] = useState(
    typeof data.doseAmount === 'number' ? String(data.doseAmount) : '',
  )
  const [doseUnit, setDoseUnit] = useState(
    typeof data.doseUnit === 'string' ? data.doseUnit : '',
  )

  const [vaccineName, setVaccineName] = useState(
    typeof data.name === 'string' ? data.name : '',
  )

  const [milestone, setMilestone] = useState(data.milestone === true)

  function buildData(): { data: Record<string, unknown>; error?: string } {
    switch (type) {
      case 'temperature': {
        const value = Number(celsius.replace(',', '.'))
        if (!celsius.trim() || !Number.isFinite(value)) {
          return { data: {}, error: 'Enter a temperature in °C' }
        }
        return {
          data: { celsius: value, method: tempMethod || undefined },
        }
      }
      case 'feeding':
        return {
          data: {
            method: feedingMethod,
            side:
              feedingMethod === 'breast' ? feedingSide || undefined : undefined,
            amountMl: amountMl.trim() ? Number(amountMl) : undefined,
          },
        }
      case 'diaper':
        return { data: { kind: diaperKind } }
      case 'sleep':
        return { data: {} }
      case 'growth': {
        const weight = weightKg.trim() ? Number(weightKg) : undefined
        const height = heightCm.trim() ? Number(heightCm) : undefined
        const head = headCircumferenceCm.trim()
          ? Number(headCircumferenceCm)
          : undefined
        if (
          weight === undefined &&
          height === undefined &&
          head === undefined
        ) {
          return { data: {}, error: 'Enter at least one measurement' }
        }
        return {
          data: {
            weightKg: weight,
            heightCm: height,
            headCircumferenceCm: head,
          },
        }
      }
      case 'medication':
        if (!medName.trim())
          return { data: {}, error: 'Enter a medication name' }
        return {
          data: {
            name: medName.trim(),
            doseAmount: doseAmount.trim() ? Number(doseAmount) : undefined,
            doseUnit: doseUnit.trim() || undefined,
          },
        }
      case 'vaccination':
        if (!vaccineName.trim())
          return { data: {}, error: 'Enter a vaccine name' }
        return { data: { name: vaccineName.trim() } }
      case 'note':
        return { data: { milestone: milestone || undefined } }
    }
  }

  function rememberChoices() {
    if (type === 'temperature' && tempMethod) {
      writeLastUsed('temperatureMethod', tempMethod)
    } else if (type === 'feeding') {
      writeLastUsed('feedingMethod', feedingMethod)
      if (feedingSide) writeLastUsed('feedingSide', feedingSide)
    } else if (type === 'diaper') {
      writeLastUsed('diaperKind', diaperKind)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const built = buildData()
    if (built.error) {
      setError(built.error)
      return
    }
    rememberChoices()
    setSubmitting(true)
    setError(null)
    try {
      const ts = fromDatetimeLocalValue(timestamp)
      const endTs = endTimestamp
        ? fromDatetimeLocalValue(endTimestamp)
        : undefined
      if (event) {
        await update({
          eventId: event._id,
          timestamp: ts,
          endTimestamp: endTs ?? null,
          notes: notes.trim() || null,
          data: built.data,
        })
      } else {
        await add({
          babyId,
          type,
          timestamp: ts,
          endTimestamp: endTs,
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

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">
            {type === 'sleep' ? 'Start' : 'When'}
          </span>
          <input
            type="datetime-local"
            className={inputClass}
            value={timestamp}
            onChange={(e) => setTimestamp(e.target.value)}
            required
          />
        </label>
        {(type === 'sleep' || type === 'feeding') && (
          <label className="block text-sm">
            <span className="mb-1 block font-medium">End (optional)</span>
            <input
              type="datetime-local"
              className={inputClass}
              value={endTimestamp}
              onChange={(e) => setEndTimestamp(e.target.value)}
            />
          </label>
        )}
      </div>

      {type === 'temperature' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Temperature (°C)</span>
            <input
              type="number"
              step="0.1"
              inputMode="decimal"
              className={inputClass}
              value={celsius}
              onChange={(e) => setCelsius(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Method</span>
            <select
              className={inputClass}
              value={tempMethod}
              onChange={(e) => setTempMethod(e.target.value)}
            >
              <option value="">Not specified</option>
              {Object.entries(TEMPERATURE_METHOD_LABELS).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {type === 'feeding' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Method</span>
            <select
              className={inputClass}
              value={feedingMethod}
              onChange={(e) => setFeedingMethod(e.target.value)}
            >
              {Object.entries(FEEDING_METHOD_LABELS).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          {feedingMethod === 'breast' ? (
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Side</span>
              <select
                className={inputClass}
                value={feedingSide}
                onChange={(e) => setFeedingSide(e.target.value)}
              >
                <option value="">Not specified</option>
                {Object.entries(FEEDING_SIDE_LABELS).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Amount (ml)</span>
              <input
                type="number"
                inputMode="numeric"
                className={inputClass}
                value={amountMl}
                onChange={(e) => setAmountMl(e.target.value)}
              />
            </label>
          )}
        </div>
      )}

      {type === 'diaper' && (
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Kind</span>
          <select
            className={inputClass}
            value={diaperKind}
            onChange={(e) => setDiaperKind(e.target.value)}
          >
            {Object.entries(DIAPER_KIND_LABELS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
      )}

      {type === 'growth' && (
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Weight (kg)</span>
            <input
              type="number"
              step="0.01"
              inputMode="decimal"
              className={inputClass}
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Height (cm)</span>
            <input
              type="number"
              step="0.1"
              inputMode="decimal"
              className={inputClass}
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Head circ. (cm)</span>
            <input
              type="number"
              step="0.1"
              inputMode="decimal"
              className={inputClass}
              value={headCircumferenceCm}
              onChange={(e) => setHeadCircumferenceCm(e.target.value)}
            />
          </label>
        </div>
      )}

      {type === 'medication' && (
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-sm sm:col-span-1">
            <span className="mb-1 block font-medium">Name</span>
            <input
              className={inputClass}
              value={medName}
              onChange={(e) => setMedName(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Dose amount</span>
            <input
              type="number"
              step="0.01"
              inputMode="decimal"
              className={inputClass}
              value={doseAmount}
              onChange={(e) => setDoseAmount(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Dose unit</span>
            <input
              className={inputClass}
              placeholder="ml, mg…"
              value={doseUnit}
              onChange={(e) => setDoseUnit(e.target.value)}
            />
          </label>
        </div>
      )}

      {type === 'vaccination' && (
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Vaccine name</span>
          <input
            className={inputClass}
            value={vaccineName}
            onChange={(e) => setVaccineName(e.target.value)}
            required
          />
        </label>
      )}

      {type === 'note' && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={milestone}
            onChange={(e) => setMilestone(e.target.checked)}
          />
          <span className="font-medium">Mark as a milestone</span>
        </label>
      )}

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
