import type { NutrientKey, NutritionSource } from '../../domain'

/**
 * The nutrient names, shared by Recipes, Nutrition and Foods.
 *
 * They used to be `NUTRIENT_LABELS` in `convex/lib/nutrition.ts`, beside the
 * keys and the validator. No Convex function ever read them — only three client
 * components did — so they were display strings sitting in a backend file that
 * no message tree could reach. The keys and the shape stayed there, where the
 * schema needs them; the words came here (ADR-0011).
 *
 * The unit is part of the label because it is part of the name a reader knows:
 * "Protein (g)" is one column heading, not a heading plus a unit to compose.
 */
export const labels = {
  calories: 'Calories (kcal)',
  protein: 'Protein (g)',
  carbs: 'Carbs (g)',
  sugars: 'Sugars (g)',
  fat: 'Fat (g)',
  saturatedFat: 'Saturated fat (g)',
  fiber: 'Fiber (g)',
  salt: 'Salt (g)',
} satisfies Record<NutrientKey, string>

/** Where a set of figures came from, said wherever they are shown. */
export const sources = {
  imported: 'Imported',
  ai: 'AI estimate',
  manual: 'Manual',
} satisfies Record<NutritionSource, string>

export const nutrients = { labels, sources }
