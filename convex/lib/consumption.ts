import {
  MEAL_NAMES,
  NUTRIENT_KEYS,
  type NutritionFacts,
  QUANTITY_UNITS,
} from '@gather/core/domain'
import { v } from 'convex/values'
import { nutritionValidator } from './nutrition'
import { literals } from './validators'

export const mealValidator = literals(MEAL_NAMES)

export const quantityUnitValidator = literals(QUANTITY_UNITS)

/** One logged thing, in the diary and on the two writes that add one. */
export const diaryItemFields = {
  recipeId: v.optional(v.id('recipes')),
  foodId: v.optional(v.id('foods')),
  label: v.string(),
  quantity: v.number(),
  quantityUnit: quantityUnitValidator,
  nutrition: nutritionValidator,
  // An emoji, for a **one-off** — an entry with no `foodId` and no
  // `recipeId`, which has nothing to inherit a picture from and never will
  // (#94). An entry that does reference a food reads the food's own icon
  // instead, so this stays absent there. Content, not a display string.
  icon: v.optional(v.string()),
}

// Multiplies every present nutrient by `factor`, rounded to 2 decimals to
// avoid floating-point noise in stored snapshots.
export function scaleFacts(
  facts: NutritionFacts,
  factor: number,
): NutritionFacts {
  const out: NutritionFacts = {}
  for (const key of NUTRIENT_KEYS) {
    const value = facts[key]
    if (value !== undefined) out[key] = Math.round(value * factor * 100) / 100
  }
  return out
}

// Sums a list of nutrition snapshots for day/meal totals. A nutrient is only
// present in the sum if at least one entry had it — absence isn't the same
// as zero (spec: "store what a source provides, render only what exists").
export function sumFacts(list: NutritionFacts[]): NutritionFacts {
  const out: NutritionFacts = {}
  for (const key of NUTRIENT_KEYS) {
    if (!list.some((f) => f[key] !== undefined)) continue
    const total = list.reduce((acc, f) => acc + (f[key] ?? 0), 0)
    out[key] = Math.round(total * 100) / 100
  }
  return out
}

// Recipe nutrition is stored per-serving; quantity for a recipe entry is
// always in servings (spec §3.4: recipes' quantityUnit is always 'serving').
export function computeRecipeEntryNutrition(
  recipeNutritionPerServing: NutritionFacts,
  quantityServings: number,
): NutritionFacts {
  return scaleFacts(recipeNutritionPerServing, quantityServings)
}

/**
 * `pieces` of a food in its base unit. A piece is one of the food's own
 * portions — its first named serving, which is what the single `servingSize`
 * field became (#68/#71). `undefined` for a food with no portion to count.
 */
export function piecesInBaseUnit(
  food: { servings?: readonly { amount: number }[] },
  pieces: number,
): number | undefined {
  const portion = food.servings?.[0]?.amount
  return portion ? pieces * portion : undefined
}

// Food nutrition is stored per 100 g/ml. `unit: 'piece'` counts the food's
// portions (`piecesInBaseUnit`), and a piece of a food with none is nothing;
// g/ml means quantity is the direct amount, matching food.baseUnit.
export function computeFoodEntryNutrition(
  food: {
    nutritionPer100: NutritionFacts
    servings?: readonly { label: string; amount: number }[]
  },
  quantity: number,
  unit: 'g' | 'ml' | 'piece',
): NutritionFacts {
  const amount =
    unit === 'piece' ? (piecesInBaseUnit(food, quantity) ?? 0) : quantity
  return scaleFacts(food.nutritionPer100, amount / 100)
}
