import type { NutrientKey, NutritionSource } from '../../domain'

/**
 * The nutrient names on a Recipe's nutrition.
 *
 * The keys live in `domain.ts`, where the schema needs them; the words are the
 * reader's, so they live here (ADR-0011).
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
