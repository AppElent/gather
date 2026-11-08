import { v } from 'convex/values'
import { nutritionSourceValidator, nutritionValidator } from './nutrition'

/** What a recipe says, in the table and on every write that names it. */
export const recipeFields = {
  title: v.string(),
  description: v.optional(v.string()),
  imageId: v.optional(v.id('_storage')),
  ingredients: v.array(v.string()),
  steps: v.array(v.string()),
  tags: v.array(v.string()),
  rating: v.optional(v.number()),
  prepMinutes: v.optional(v.number()),
  sourceUrl: v.optional(v.string()),
  servings: v.optional(v.number()),
  nutrition: v.optional(nutritionValidator),
  nutritionSource: v.optional(nutritionSourceValidator),
}
