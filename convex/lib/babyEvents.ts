import {
  BABY_SEXES,
  type BabyEventDataByType,
  DIAPER_KINDS,
  FEEDING_METHODS,
  FEEDING_SIDES,
  TEMPERATURE_METHODS,
} from '@gather/core/baby-events'
import {
  BABY_BAR_SHORTCUTS,
  BABY_EVENT_TYPES,
  type BabyEventType,
} from '@gather/core/domain'
import { type GenericValidator, type Infer, v } from 'convex/values'
import { literals } from './validators'

export const babyEventTypeValidator = literals(BABY_EVENT_TYPES)

/**
 * One button on a Child's log bar: an event type, or one of the two shortcuts
 * that are not events at all. See `babyBarSlots` in `@gather/core/domain` for
 * why this is a second field beside `untrackedTypes` rather than a widening of
 * it.
 */
export const babyBarSlotValidator = v.union(
  babyEventTypeValidator,
  literals(BABY_BAR_SHORTCUTS),
)

export const babySexValidator = literals(BABY_SEXES)

export const temperatureMethodValidator = literals(TEMPERATURE_METHODS)

export const feedingMethodValidator = literals(FEEDING_METHODS)
export const feedingSideValidator = literals(FEEDING_SIDES)

export const diaperKindValidator = literals(DIAPER_KINDS)

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

// The screens read `data` through core's `BabyEventDataByType`. This stops
// compiling, naming the type, the moment a payload validator above and that
// type disagree about a field.
type Same<A, B> =
  (<X>() => X extends A ? 1 : 2) extends <X>() => X extends B ? 1 : 2
    ? true
    : false
// `v.object({})` infers `{}` but refuses every field, which core spells
// `Record<string, never>`.
type Accepted<V extends GenericValidator> =
  keyof Infer<V> extends never ? Record<string, never> : Infer<V>
type DataValidatorByType = {
  temperature: typeof temperatureDataValidator
  feeding: typeof feedingDataValidator
  diaper: typeof diaperDataValidator
  sleep: typeof sleepDataValidator
  growth: typeof growthDataValidator
  medication: typeof medicationDataValidator
  vaccination: typeof vaccinationDataValidator
  note: typeof noteDataValidator
  memory: typeof memoryDataValidator
}
;({}) as {
  [T in keyof DataValidatorByType]: Same<
    Accepted<DataValidatorByType[T]>,
    BabyEventDataByType[T]
  >
} satisfies Record<BabyEventType, true>
