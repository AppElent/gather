import { v } from 'convex/values'

export const NUTRIENT_KEYS = [
  'calories',
  'protein',
  'carbs',
  'sugars',
  'fat',
  'saturatedFat',
  'fiber',
  'salt',
] as const

export type NutrientKey = (typeof NUTRIENT_KEYS)[number]

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

export type NutritionSource = 'imported' | 'ai' | 'manual'

export const NUTRIENT_LABELS: Record<NutrientKey, string> = {
  calories: 'Calories (kcal)',
  protein: 'Protein (g)',
  carbs: 'Carbs (g)',
  sugars: 'Sugars (g)',
  fat: 'Fat (g)',
  saturatedFat: 'Saturated fat (g)',
  fiber: 'Fiber (g)',
  salt: 'Salt (g)',
}

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

function nutritionEqual(a?: NutritionFacts, b?: NutritionFacts): boolean {
  if ((a === undefined) !== (b === undefined)) return false
  if (a === undefined || b === undefined) return true
  return NUTRIENT_KEYS.every((key) => (a[key] ?? null) === (b[key] ?? null))
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
