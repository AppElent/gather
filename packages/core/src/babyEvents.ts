/**
 * What a logged Baby event is: the closed option sets, the shape of `data` per
 * type, and the one line that summarises it. The words come in as a parameter
 * (ADR-0011), because the timeline renders this from React and the PDF export
 * from a plain function.
 */
import type { BabyEventType } from './domain'
import { fmt } from './i18n'
import type { Messages } from './messages'

export const TEMPERATURE_METHODS = [
  'oral',
  'rectal',
  'axillary',
  'ear',
  'forehead',
] as const
export type TemperatureMethod = (typeof TEMPERATURE_METHODS)[number]

export const FEEDING_METHODS = ['breast', 'bottle', 'solid'] as const
export type FeedingMethod = (typeof FEEDING_METHODS)[number]

export const FEEDING_SIDES = ['left', 'right', 'both'] as const
export type FeedingSide = (typeof FEEDING_SIDES)[number]

export const DIAPER_KINDS = ['wet', 'dirty', 'both'] as const
export type DiaperKind = (typeof DIAPER_KINDS)[number]

export const BABY_SEXES = ['female', 'male', 'unspecified'] as const
export type BabySex = (typeof BABY_SEXES)[number]

/** What a thermometer can plausibly read on a Child. */
export const TEMPERATURE_CELSIUS_MIN = 34
export const TEMPERATURE_CELSIUS_MAX = 42

export interface BabyEventDataByType {
  temperature: { celsius: number; method?: TemperatureMethod }
  feeding: {
    method: FeedingMethod
    side?: FeedingSide
    amountMl?: number
    amountG?: number
    leftMin?: number
    rightMin?: number
  }
  diaper: { kind: DiaperKind }
  sleep: Record<string, never>
  growth: {
    weightKg?: number
    heightCm?: number
    headCircumferenceCm?: number
  }
  medication: { name: string; doseAmount?: number; doseUnit?: string }
  vaccination: { name: string }
  note: { milestone?: boolean }
  memory: { what: string }
}

export type BabyEventData = BabyEventDataByType[BabyEventType]

/** An event whose `data` is known from its `type`. */
export type BabyEvent = {
  [T in BabyEventType]: { type: T; data: BabyEventDataByType[T] }
}[BabyEventType]

/**
 * Ties a stored event's `data` to its `type`.
 *
 * Convex keeps the two as sibling fields, so its generated type cannot relate
 * them. `isValidEventData` does, on every write; a row older than that check
 * can still break the promise, so a reader that would throw on one guards first.
 */
export function asBabyEvent<E extends { type: BabyEventType; data: unknown }>(
  event: E,
): Omit<E, 'type' | 'data'> & BabyEvent {
  return event as unknown as Omit<E, 'type' | 'data'> & BabyEvent
}

const REQUIRED_TEXT_FIELDS = {
  medication: { key: 'name', message: 'enterMedicationName' },
  vaccination: { key: 'name', message: 'enterVaccineName' },
  memory: { key: 'what', message: 'enterMemoryWhat' },
} as const

export type MissingRequiredField =
  (typeof REQUIRED_TEXT_FIELDS)[keyof typeof REQUIRED_TEXT_FIELDS]['message']

/** The `baby.log.validation` key for the one box this type cannot save without. */
export function missingRequiredField(
  type: BabyEventType,
  fields: Record<string, unknown>,
): MissingRequiredField | null {
  if (
    type !== 'medication' &&
    type !== 'vaccination' &&
    type !== 'memory'
  ) {
    return null
  }
  const { key, message } = REQUIRED_TEXT_FIELDS[type]
  const value = fields[key]
  return typeof value === 'string' && value.trim() ? null : message
}

/** Absent, or a finite non-negative number of minutes. */
function isValidMinutes(value: unknown): boolean {
  if (value === undefined) return true
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

/**
 * Confirms `data` satisfies the shape `type` implies. The schema can only check
 * `data` against *some* member of its union, not the one matching `type`.
 */
export function isValidEventData(
  type: BabyEventType,
  data: Record<string, unknown>,
): boolean {
  switch (type) {
    case 'temperature':
      return typeof data.celsius === 'number'
    case 'feeding':
      return (
        FEEDING_METHODS.some((method) => method === data.method) &&
        isValidMinutes(data.leftMin) &&
        isValidMinutes(data.rightMin)
      )
    case 'diaper':
      return DIAPER_KINDS.some((kind) => kind === data.kind)
    case 'sleep':
      return true
    case 'growth':
      return (
        typeof data.weightKg === 'number' ||
        typeof data.heightCm === 'number' ||
        typeof data.headCircumferenceCm === 'number'
      )
    case 'medication':
    case 'vaccination':
    case 'memory':
      return missingRequiredField(type, data) === null
    case 'note':
      return true
    default:
      return false
  }
}

type BabyLogMessages = Messages['baby']['log']
export type DurationUnits = BabyLogMessages['status']['duration']

/**
 * "32m", "3h 10m", "2d" — or the same in the reader's language.
 *
 * Coarse on purpose above an hour: a parent reading "3h 10m ago" is answering
 * "is she due?", and seconds of precision would be noise.
 */
export function shortDuration(ms: number, units: DurationUnits): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000))
  if (minutes < 60) return fmt(units.minutes, { minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    const rest = minutes % 60
    return rest === 0
      ? fmt(units.hours, { hours })
      : fmt(units.hoursMinutes, { hours, minutes: rest })
  }
  return fmt(units.days, { days: Math.floor(hours / 24) })
}

function feedingSummary(
  data: BabyEventDataByType['feeding'],
  { options, summary }: BabyLogMessages,
): string {
  const parts = [options.feedingMethod[data.method]]
  // Per-side minutes supersede the coarse side: "Left 10m · Right 8m" already
  // says which side.
  const { leftMin, rightMin } = data
  if (leftMin !== undefined) {
    parts.push(
      fmt(summary.sideMinutes, {
        side: options.feedingSide.left,
        minutes: leftMin,
      }),
    )
  }
  if (rightMin !== undefined) {
    parts.push(
      fmt(summary.sideMinutes, {
        side: options.feedingSide.right,
        minutes: rightMin,
      }),
    )
  }
  if (leftMin === undefined && rightMin === undefined && data.side) {
    parts.push(options.feedingSide[data.side] ?? data.side)
  }
  // One unit per method, so at most one of these is ever present.
  if (data.amountMl !== undefined) parts.push(`${data.amountMl} ml`)
  else if (data.amountG !== undefined) parts.push(`${data.amountG} g`)
  return parts.join(' · ')
}

/** One-line summary of an event's `data`, for a timeline row or a PDF. */
export function summarizeBabyEvent(
  stored: {
    type: BabyEventType
    data: unknown
    timestamp: number
    endTimestamp?: number
  },
  m: BabyLogMessages,
): string {
  const { options, summary } = m
  // One legacy row must not take a whole timeline down with it.
  if (!isValidEventData(stored.type, stored.data as Record<string, unknown>)) {
    return summary.fallback[stored.type]
  }
  const event = asBabyEvent(stored)

  switch (event.type) {
    case 'temperature': {
      const celsius = event.data.celsius.toFixed(1)
      const method = event.data.method && options.temperatureMethod[event.data.method]
      return method
        ? fmt(summary.celsiusWithMethod, { celsius, method })
        : fmt(summary.celsius, { celsius })
    }
    case 'feeding':
      return feedingSummary(event.data, m)
    case 'diaper':
      return summary.diaper[event.data.kind]
    case 'sleep':
      // No running timer exists, so a sleep with no end means "duration
      // unknown" rather than "still asleep".
      return event.endTimestamp && event.endTimestamp > event.timestamp
        ? fmt(summary.sleepFor, {
            duration: shortDuration(
              event.endTimestamp - event.timestamp,
              m.status.duration,
            ),
          })
        : summary.fallback.sleep
    case 'growth': {
      const parts: string[] = []
      const { weightKg, heightCm, headCircumferenceCm } = event.data
      if (weightKg !== undefined) parts.push(`${weightKg} kg`)
      if (heightCm !== undefined) parts.push(`${heightCm} cm`)
      if (headCircumferenceCm !== undefined) {
        parts.push(
          fmt(summary.headCircumference, { value: headCircumferenceCm }),
        )
      }
      return parts.join(' · ')
    }
    case 'medication': {
      const { name } = event.data
      if (event.data.doseAmount === undefined) return name
      const unit = event.data.doseUnit ? ` ${event.data.doseUnit}` : ''
      return `${name} · ${event.data.doseAmount}${unit}`
    }
    case 'vaccination':
      return event.data.name
    case 'note':
      return event.data.milestone ? summary.milestone : summary.fallback.note
    case 'memory':
      // The whole of a memory is what it says happened, so the summary is that
      // sentence rather than a word about it.
      return event.data.what.trim()
  }
}
