import {
  NUTRIENT_KEYS,
  type NutrientKey,
  type NutritionSource,
} from '@gather/core/domain'
import { v } from 'convex/values'

export { NUTRIENT_KEYS }
export type { NutrientKey, NutritionSource }

/** All values per serving (recipes) or per 100 g/ml (foods, phase 2). Calories in kcal, everything else grams. */
export type NutritionFacts = Partial<Record<NutrientKey, number>>

export const nutritionValidator = v.object({
  calories: v.optional(v.number()),
  protein: v.optional(v.number()),
  carbs: v.optional(v.number()),
  sugars: v.optional(v.number()),
  fat: v.optional(v.number()),
  saturatedFat: v.optional(v.number()),
  fiber: v.optional(v.number()),
  salt: v.optional(v.number()),
})

export const nutritionSourceValidator = v.union(
  v.literal('imported'),
  v.literal('ai'),
  v.literal('manual'),
)

// The nutrient *names* used to live here, next to the keys. They are read by a
// person, so they are translated, and they now live in each locale's
// `nutrients.ts` under `src/lib/i18n/messages/` keyed by `NutrientKey`
// (ADR-0011). No Convex function ever read them; three client components did.

// JSON-LD nutrition values are free text in the wild: "250 kcal", "12,5 g"
// (Dutch decimal comma), "1,200 kcal" (US thousands comma), "1046 kJ",
// "740 mg". Normalize all of those to a plain non-negative number in the
// canonical unit (kcal / g). Unparseable input → undefined, never a throw —
// nutrition must never fail a recipe import (spec §6).
export function parseNutritionValue(raw: unknown): number | undefined {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw >= 0 ? raw : undefined
  }
  if (typeof raw !== 'string') return undefined
  if (/-\s*\d/.test(raw)) return undefined
  const match = /(\d+(?:[.,]\d+)?)/.exec(raw)
  if (!match) return undefined
  // Comma before exactly three digits reads as a thousands separator
  // ("1,200 kcal" → 1200); otherwise it's a decimal comma ("12,5" → 12.5).
  const numText = /^\d+,\d{3}$/.test(match[1])
    ? match[1].replace(',', '')
    : match[1].replace(',', '.')
  const value = Number(numText)
  if (!Number.isFinite(value) || value < 0) return undefined
  // Some sites (bbcgoodfood.com) spell the unit out ("milligram of sodium")
  // instead of abbreviating it, which "mg" alone wouldn't catch.
  if (/mg/i.test(raw) || /milligram/i.test(raw)) {
    return Math.round((value / 1000) * 100) / 100
  }
  if (/kj/i.test(raw)) return Math.round((value / 4.184) * 10) / 10
  return value
}

// schema.org recipeYield: a number, "4", "4 personen", "4-6" (lower bound
// wins because the regex finds the first integer), or an array of variants.
// Sanity-capped at 100 so strings like "1000 ml" don't become servings.
export function parseServings(raw: unknown): number | undefined {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw > 0 && raw <= 100
      ? Math.round(raw)
      : undefined
  }
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const parsed = parseServings(item)
      if (parsed !== undefined) return parsed
    }
    return undefined
  }
  if (typeof raw !== 'string') return undefined
  const match = /\d+/.exec(raw)
  if (!match) return undefined
  const value = Number(match[0])
  return value > 0 && value <= 100 ? value : undefined
}

// Shape-check an untrusted nutrition object (AI tool output): keep only
// known keys holding finite non-negative numbers; empty result → undefined.
export function sanitizeNutrition(input: unknown): NutritionFacts | undefined {
  if (typeof input !== 'object' || input === null) return undefined
  const out: NutritionFacts = {}
  for (const key of NUTRIENT_KEYS) {
    const raw = (input as Record<string, unknown>)[key]
    if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
      out[key] = raw
    }
  }
  return Object.keys(out).length > 0 ? out : undefined
}

export interface NutritionStaleState {
  ingredients: string[]
  servings?: number
  nutrition?: NutritionFacts
  nutritionStale?: boolean
}

/** Same figures, nutrient for nutrient. An absent nutrient is not a zero. */
function nutritionEqual(a?: NutritionFacts, b?: NutritionFacts): boolean {
  if ((a === undefined) !== (b === undefined)) return false
  if (a === undefined || b === undefined) return true
  return NUTRIENT_KEYS.every((key) => (a[key] ?? null) === (b[key] ?? null))
}

/**
 * Are there any figures here at all?
 *
 * Only ever asked before saying where figures came from: with none, there is
 * nothing to have come from anywhere, and a food that says "Manual" over an
 * empty panel is claiming an answer to a question nobody asked.
 *
 * Deliberately *not* "is this nutrition usable" — that one is about whether
 * something can be logged from these figures, and energy alone would satisfy
 * it. Different question, and it belongs to whoever needs it.
 */
export function hasNutritionFigures(facts?: NutritionFacts): boolean {
  return (
    facts !== undefined && NUTRIENT_KEYS.some((key) => facts[key] !== undefined)
  )
}

/**
 * Where a set of figures came from, after a save that may or may not have
 * touched them.
 *
 * Typing over the figures makes them `manual`, whatever they were before —
 * that is what stops a corrected estimate from still describing itself as one.
 * A save that leaves the figures alone leaves the answer alone, including
 * leaving it *absent* on a row that never recorded one: nothing is inferred
 * for a food that predates the field, which is why it needs no backfill.
 *
 * Deliberately compares the figures rather than trusting the caller. Renaming
 * a food, adding a serving or fixing a brand are not claims about its
 * nutrition, and a client is in no position to say which of those it did.
 */
export function nextNutritionSource(
  before: NutritionFacts | undefined,
  after: NutritionFacts | undefined,
  recorded: NutritionSource | undefined,
): NutritionSource | undefined {
  if (!hasNutritionFigures(after)) return undefined
  return nutritionEqual(before, after) ? recorded : 'manual'
}

// Spec §5: the flag goes true when ingredients or servings change in a save
// that doesn't also change nutrition; any nutrition change (set, replace, or
// remove) clears it; once stale it stays stale until nutrition changes.
export function nextNutritionStale(
  before: NutritionStaleState,
  after: Omit<NutritionStaleState, 'nutritionStale'>,
): boolean {
  if (!nutritionEqual(before.nutrition, after.nutrition)) return false
  if (!before.nutrition) return false
  if (before.nutritionStale) return true
  const ingredientsChanged =
    before.ingredients.length !== after.ingredients.length ||
    before.ingredients.some((item, i) => item !== after.ingredients[i])
  const servingsChanged = (before.servings ?? null) !== (after.servings ?? null)
  return ingredientsChanged || servingsChanged
}
