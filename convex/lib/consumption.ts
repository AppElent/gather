import { v } from 'convex/values'
import { NUTRIENT_KEYS, type NutritionFacts } from './nutrition'

export const MEAL_NAMES = ['breakfast', 'lunch', 'dinner', 'snack'] as const
export type MealName = (typeof MEAL_NAMES)[number]

export const mealValidator = v.union(
  v.literal('breakfast'),
  v.literal('lunch'),
  v.literal('dinner'),
  v.literal('snack'),
)

export const MEAL_LABELS: Record<MealName, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
}

export const QUANTITY_UNITS = ['serving', 'g', 'ml', 'piece'] as const
export type QuantityUnit = (typeof QUANTITY_UNITS)[number]

export const quantityUnitValidator = v.union(
  v.literal('serving'),
  v.literal('g'),
  v.literal('ml'),
  v.literal('piece'),
)

// Multiplies every present nutrient by `factor`, rounded to 2 decimals to
// avoid floating-point noise in stored snapshots.
export function scaleFacts(facts: NutritionFacts, factor: number): NutritionFacts {
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

// Food nutrition is stored per 100 g/ml. `unit: 'piece'` means quantity is a
// count of `food.servingSize`-sized portions; g/ml means quantity is the
// direct amount, matching food.baseUnit.
export function computeFoodEntryNutrition(
  food: { nutritionPer100: NutritionFacts; servingSize?: number },
  quantity: number,
  unit: 'g' | 'ml' | 'piece',
): NutritionFacts {
  const amount = unit === 'piece' ? quantity * (food.servingSize ?? 0) : quantity
  return scaleFacts(food.nutritionPer100, amount / 100)
}
