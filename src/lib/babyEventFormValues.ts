import type { Doc } from '../../convex/_generated/dataModel'
import type { BabyEventData, BabyEventType } from '../../convex/lib/babyEvents'
import { DEFAULT_TEMPERATURE_CELSIUS } from './babyEventFields'
import { readLastUsed, writeLastUsed } from './lastUsed'

/** Flat, string-keyed form state for one event type. Kept as plain values
 * (rather than a `useState` per field) so a single form can hold several
 * types at once — see MultiEventForm. */
export type EventValues = Record<string, string | boolean>

export interface EventInput {
  data: BabyEventData
  /** Absent means "no end time"; callers editing an event should send null. */
  endTimestamp?: number
  error?: string
}

function str(value: string | boolean | undefined): string {
  return typeof value === 'string' ? value : ''
}

/** Trimmed numeric field → number, or undefined when blank/unparseable. */
function num(value: string | boolean | undefined): number | undefined {
  const raw = str(value).trim()
  if (!raw) return undefined
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : undefined
}

function fromData(event: Doc<'babyEvents'> | undefined, key: string): unknown {
  return (event?.data as Record<string, unknown> | undefined)?.[key]
}

function seedString(
  event: Doc<'babyEvents'> | undefined,
  key: string,
  lastUsedKey?: string,
  fallback = '',
): string {
  const existing = fromData(event, key)
  if (typeof existing === 'string') return existing
  if (event) return ''
  return (lastUsedKey ? readLastUsed(lastUsedKey) : null) ?? fallback
}

function seedNumber(event: Doc<'babyEvents'> | undefined, key: string): string {
  const existing = fromData(event, key)
  return typeof existing === 'number' ? String(existing) : ''
}

/** Initial form state for `type`, seeded from `event` when editing and from
 * the last-used choices otherwise. */
export function initialEventValues(
  type: BabyEventType,
  event?: Doc<'babyEvents'>,
): EventValues {
  const endTimestamp = event?.endTimestamp ? String(event.endTimestamp) : ''
  switch (type) {
    case 'temperature': {
      const celsius = fromData(event, 'celsius')
      return {
        celsius:
          typeof celsius === 'number'
            ? celsius.toFixed(1)
            : (readLastUsed('temperatureCelsius') ??
              DEFAULT_TEMPERATURE_CELSIUS),
        method: seedString(event, 'method', 'temperatureMethod'),
      }
    }
    case 'feeding':
      return {
        method: seedString(event, 'method', 'feedingMethod', 'bottle'),
        // Not an input any more (per-side minutes replaced it) — carried
        // through so editing a pre-duration entry keeps its side.
        side: seedString(event, 'side'),
        amountMl: seedNumber(event, 'amountMl'),
        leftMin: seedNumber(event, 'leftMin'),
        rightMin: seedNumber(event, 'rightMin'),
        // Distinguishes "duration cleared" from "entry predates per-side
        // minutes" once both minute fields are empty — see buildFeeding.
        hadSideMinutes:
          typeof fromData(event, 'leftMin') === 'number' ||
          typeof fromData(event, 'rightMin') === 'number',
        endTimestamp,
      }
    case 'diaper':
      return { kind: seedString(event, 'kind', 'diaperKind', 'wet') }
    case 'sleep':
      return { endTimestamp }
    case 'growth':
      return {
        weightKg: seedNumber(event, 'weightKg'),
        heightCm: seedNumber(event, 'heightCm'),
        headCircumferenceCm: seedNumber(event, 'headCircumferenceCm'),
      }
    case 'medication':
      return {
        name: seedString(event, 'name'),
        doseAmount: seedNumber(event, 'doseAmount'),
        doseUnit: seedString(event, 'doseUnit'),
      }
    case 'vaccination':
      return { name: seedString(event, 'name') }
    case 'note':
      return { milestone: fromData(event, 'milestone') === true }
  }
}

function buildFeeding(values: EventValues, timestampMs: number): EventInput {
  const method = str(values.method)
  const amountMl = num(values.amountMl)
  const storedEnd = num(values.endTimestamp)

  if (method !== 'breast') {
    return {
      data: { method, amountMl },
      endTimestamp: storedEnd,
    }
  }

  const leftMin = num(values.leftMin)
  const rightMin = num(values.rightMin)
  if ((leftMin ?? 0) < 0 || (rightMin ?? 0) < 0) {
    return { data: {}, error: 'Minutes cannot be negative' }
  }

  // Which side(s) got minutes *is* the side. With no minutes at all, keep
  // whatever the entry already had rather than dropping it.
  let side: string | undefined
  if (leftMin !== undefined && rightMin !== undefined) side = 'both'
  else if (leftMin !== undefined) side = 'left'
  else if (rightMin !== undefined) side = 'right'
  else side = str(values.side) || undefined

  // With no minutes, only a legacy entry — one whose duration was recorded
  // through the old End inputs — keeps its stored end. If the entry *had*
  // per-side minutes, emptying both fields is how you clear the duration, and
  // breast feeds have no End inputs to clear it any other way.
  const totalMin = (leftMin ?? 0) + (rightMin ?? 0)
  const endTimestamp =
    leftMin === undefined && rightMin === undefined
      ? values.hadSideMinutes === true
        ? undefined
        : storedEnd
      : timestampMs + totalMin * 60000

  return {
    data: { method, side, amountMl, leftMin, rightMin },
    endTimestamp,
  }
}

/** Form state → the `data` payload and `endTimestamp` for a babyEvents write,
 * or a user-facing `error` when the entry is incomplete. */
export function buildEventInput(
  type: BabyEventType,
  values: EventValues,
  timestampMs: number,
): EventInput {
  switch (type) {
    case 'temperature': {
      const celsius = num(values.celsius)
      if (celsius === undefined) {
        return { data: {}, error: 'Select a temperature' }
      }
      return { data: { celsius, method: str(values.method) || undefined } }
    }
    case 'feeding':
      return buildFeeding(values, timestampMs)
    case 'diaper':
      return { data: { kind: str(values.kind) } }
    case 'sleep':
      return { data: {}, endTimestamp: num(values.endTimestamp) }
    case 'growth': {
      const weightKg = num(values.weightKg)
      const heightCm = num(values.heightCm)
      const headCircumferenceCm = num(values.headCircumferenceCm)
      if (
        weightKg === undefined &&
        heightCm === undefined &&
        headCircumferenceCm === undefined
      ) {
        return { data: {}, error: 'Enter at least one measurement' }
      }
      return { data: { weightKg, heightCm, headCircumferenceCm } }
    }
    case 'medication': {
      const name = str(values.name).trim()
      if (!name) return { data: {}, error: 'Enter a medication name' }
      return {
        data: {
          name,
          doseAmount: num(values.doseAmount),
          doseUnit: str(values.doseUnit).trim() || undefined,
        },
      }
    }
    case 'vaccination': {
      const name = str(values.name).trim()
      if (!name) return { data: {}, error: 'Enter a vaccine name' }
      return { data: { name } }
    }
    case 'note':
      return {
        data: { milestone: values.milestone === true ? true : undefined },
      }
  }
}

/** Persist the repetitive choices so the next entry of this type defaults to them. */
export function rememberEventChoices(type: BabyEventType, values: EventValues) {
  if (type === 'temperature') {
    writeLastUsed('temperatureCelsius', str(values.celsius))
    if (values.method) writeLastUsed('temperatureMethod', str(values.method))
  } else if (type === 'feeding') {
    writeLastUsed('feedingMethod', str(values.method))
  } else if (type === 'diaper') {
    writeLastUsed('diaperKind', str(values.kind))
  }
}
