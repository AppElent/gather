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
export type NutritionSource = 'imported' | 'ai' | 'manual'

export const MEAL_NAMES = ['breakfast', 'lunch', 'dinner', 'snack'] as const
export type MealName = (typeof MEAL_NAMES)[number]

export const QUANTITY_UNITS = ['serving', 'g', 'ml', 'piece'] as const
export type QuantityUnit = (typeof QUANTITY_UNITS)[number]
