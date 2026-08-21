import { v } from 'convex/values'
import {
  BABY_EVENT_TYPES,
  type BabyEventType,
} from '@gather/core/domain'

export { BABY_EVENT_TYPES }
export type { BabyEventType }

export const babyEventTypeValidator = v.union(
  v.literal('temperature'),
  v.literal('feeding'),
  v.literal('diaper'),
  v.literal('sleep'),
  v.literal('growth'),
  v.literal('medication'),
  v.literal('vaccination'),
  v.literal('note'),
  v.literal('memory'),
)

/**
 * One button on a Child's log bar: an event type, or one of the two shortcuts
 * that are not events at all. See `babyBarSlots` in `@gather/core/domain` for
 * why this is a second field beside `untrackedTypes` rather than a widening of
 * it.
 */
export const babyBarSlotValidator = v.union(
  babyEventTypeValidator,
  v.literal('todo'),
  v.literal('question'),
)

// The event-type *names* used to live here. They are read by a person, so they
// are translated, and they now live in each locale's `baby.ts` under
// `src/lib/i18n/messages/` keyed by `BabyEventType` (ADR-0011). `activity.ts`
// used to read them to title an entry; it sends the type key now and lets the
// client choose the word.

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

// One unit per method, and never more than one on an entry: a breastfeed is
// measured in minutes per side, a bottle in millilitres, solid food in grams.
// They are separate optional fields rather than an `amount` + `unit` pair so
// that a query for "how much milk" cannot accidentally sum grams of pear into
// it.
//
// leftMin/rightMin: per-side breastfeed duration in minutes. `side` stays as
// the coarse record (and is what pre-duration entries have); it is derived
// from whichever sides have minutes when they're given.
export const feedingDataValidator = v.object({
  method: feedingMethodValidator,
  side: v.optional(feedingSideValidator),
  amountMl: v.optional(v.number()),
  amountG: v.optional(v.number()),
  leftMin: v.optional(v.number()),
  rightMin: v.optional(v.number()),
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

/**
 * A memory is one sentence about what happened — "first laugh", "first steps
 * across the kitchen" — and nothing else.
 *
 * Free text rather than a closed set, because the set is not closed: every
 * household's list of firsts is its own, and a picker of forty milestones is
 * a thing to scroll past on the way to typing what you meant. The photo does
 * not live here; it is `photoId` on the event itself, so a rash photo on a
 * Note can use the same field without another migration.
 */
export const memoryDataValidator = v.object({
  what: v.string(),
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
  memoryDataValidator,
)

export type BabyEventData = Record<string, unknown>

/** Absent, or a finite non-negative number of minutes. */
function isValidMinutes(value: unknown): boolean {
  if (value === undefined) return true
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

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
        (data.method === 'breast' ||
          data.method === 'bottle' ||
          data.method === 'solid') &&
        isValidMinutes(data.leftMin) &&
        isValidMinutes(data.rightMin)
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
    case 'memory':
      return typeof data.what === 'string' && data.what.trim().length > 0
    default:
      return false
  }
}
