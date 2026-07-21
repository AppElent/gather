import { v } from 'convex/values'

export const BABY_EVENT_TYPES = [
  'temperature',
  'feeding',
  'diaper',
  'sleep',
  'growth',
  'medication',
  'vaccination',
  'note',
] as const
export type BabyEventType = (typeof BABY_EVENT_TYPES)[number]

export const babyEventTypeValidator = v.union(
  v.literal('temperature'),
  v.literal('feeding'),
  v.literal('diaper'),
  v.literal('sleep'),
  v.literal('growth'),
  v.literal('medication'),
  v.literal('vaccination'),
  v.literal('note'),
)

export const BABY_EVENT_LABELS: Record<BabyEventType, string> = {
  temperature: 'Temperature',
  feeding: 'Feeding',
  diaper: 'Diaper',
  sleep: 'Sleep',
  growth: 'Growth',
  medication: 'Medication',
  vaccination: 'Vaccination',
  note: 'Note',
}

export const temperatureMethodValidator = v.union(
  v.literal('oral'),
  v.literal('rectal'),
  v.literal('axillary'),
  v.literal('ear'),
  v.literal('forehead'),
)
export type TemperatureMethod =
  | 'oral'
  | 'rectal'
  | 'axillary'
  | 'ear'
  | 'forehead'

export const feedingMethodValidator = v.union(
  v.literal('breast'),
  v.literal('bottle'),
  v.literal('solid'),
)
export const feedingSideValidator = v.union(
  v.literal('left'),
  v.literal('right'),
  v.literal('both'),
)

export const diaperKindValidator = v.union(
  v.literal('wet'),
  v.literal('dirty'),
  v.literal('both'),
)

// Per-type event payload. Kept separate from schema.ts's top-level `type`
// field (needed there for the `by_baby_type` index) — a mismatch between
// the two is caught at write time by isValidEventData, since Convex's
// v.union validator alone can't tie a sibling field's value to which union
// member `data` must satisfy.
export const temperatureDataValidator = v.object({
  celsius: v.number(),
  method: v.optional(temperatureMethodValidator),
})

export const feedingDataValidator = v.object({
  method: feedingMethodValidator,
  side: v.optional(feedingSideValidator),
  amountMl: v.optional(v.number()),
})

export const diaperDataValidator = v.object({
  kind: diaperKindValidator,
})

export const sleepDataValidator = v.object({})

export const growthDataValidator = v.object({
  weightKg: v.optional(v.number()),
  heightCm: v.optional(v.number()),
  headCircumferenceCm: v.optional(v.number()),
})

export const medicationDataValidator = v.object({
  name: v.string(),
  doseAmount: v.optional(v.number()),
  doseUnit: v.optional(v.string()),
})

export const vaccinationDataValidator = v.object({
  name: v.string(),
})

export const noteDataValidator = v.object({
  milestone: v.optional(v.boolean()),
})

export const babyEventDataValidator = v.union(
  temperatureDataValidator,
  feedingDataValidator,
  diaperDataValidator,
  sleepDataValidator,
  growthDataValidator,
  medicationDataValidator,
  vaccinationDataValidator,
  noteDataValidator,
)

export type BabyEventData = Record<string, unknown>

// Confirms `data` actually satisfies the shape the given `type` implies —
// the schema validator only checks `data` against *some* member of the
// union, not the one matching `type`.
export function isValidEventData(
  type: BabyEventType,
  data: BabyEventData,
): boolean {
  switch (type) {
    case 'temperature':
      return typeof data.celsius === 'number'
    case 'feeding':
      return (
        data.method === 'breast' ||
        data.method === 'bottle' ||
        data.method === 'solid'
      )
    case 'diaper':
      return data.kind === 'wet' || data.kind === 'dirty' || data.kind === 'both'
    case 'sleep':
      return true
    case 'growth':
      return (
        typeof data.weightKg === 'number' ||
        typeof data.heightCm === 'number' ||
        typeof data.headCircumferenceCm === 'number'
      )
    case 'medication':
      return typeof data.name === 'string' && data.name.trim().length > 0
    case 'vaccination':
      return typeof data.name === 'string' && data.name.trim().length > 0
    case 'note':
      return true
    default:
      return false
  }
}
