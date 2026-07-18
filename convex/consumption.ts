import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  computeFoodEntryNutrition,
  computeRecipeEntryNutrition,
  mealValidator,
  quantityUnitValidator,
  scaleFacts,
} from './lib/consumption'
import { NUTRIENT_KEYS, type NutritionFacts, nutritionValidator } from './lib/nutrition'
import { getCurrentUser } from './lib/sharing'
import type { Doc } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'

function assertValidNutrition(nutrition: NutritionFacts) {
  for (const key of NUTRIENT_KEYS) {
    const value = nutrition[key]
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
      throw new Error(`${key} must be a non-negative number`)
    }
  }
}

export const listForDay = query({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) return []
    return await ctx.db
      .query('consumptionEntries')
      .withIndex('by_user_date', (q) =>
        q.eq('userId', user._id).eq('date', args.date),
      )
      .collect()
  },
})

export const create = mutation({
  args: {
    date: v.string(),
    meal: mealValidator,
    recipeId: v.optional(v.id('recipes')),
    foodId: v.optional(v.id('foods')),
    label: v.string(),
    quantity: v.number(),
    quantityUnit: quantityUnitValidator,
    nutrition: nutritionValidator,
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new Error('Not authenticated')
    if (args.recipeId && args.foodId) {
      throw new Error('An entry cannot reference both a recipe and a food')
    }
    if (args.quantity <= 0) throw new Error('Quantity must be positive')
    assertValidNutrition(args.nutrition)
    return await ctx.db.insert('consumptionEntries', {
      userId: user._id,
      ...args,
    })
  },
})

// On a quantity change, nutrition is recomputed from the current recipe/food
// values when the source still exists (spec §4.5); if the source was
// deleted, the existing snapshot is scaled proportionally instead so the
// entry still reflects the new quantity without needing source data.
async function recomputeFromSource(
  ctx: MutationCtx,
  entry: Doc<'consumptionEntries'>,
  quantity: number,
): Promise<NutritionFacts | null> {
  if (entry.recipeId) {
    const recipe = await ctx.db.get(entry.recipeId)
    return recipe?.nutrition
      ? computeRecipeEntryNutrition(recipe.nutrition, quantity)
      : null
  }
  if (entry.foodId) {
    const food = await ctx.db.get(entry.foodId)
    // Food entries never use 'serving' (only recipe entries do), but the
    // schema's quantityUnit field is the full 4-member union — narrow to
    // the 3 units computeFoodEntryNutrition actually accepts.
    return food
      ? computeFoodEntryNutrition(
          food,
          quantity,
          entry.quantityUnit as 'g' | 'ml' | 'piece',
        )
      : null
  }
  return null
}

export const update = mutation({
  args: {
    id: v.id('consumptionEntries'),
    date: v.optional(v.string()),
    meal: v.optional(mealValidator),
    quantity: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new Error('Not authenticated')
    const entry = await ctx.db.get(args.id)
    if (!entry) throw new Error('Entry not found')
    if (entry.userId !== user._id) throw new Error('Not the owner')

    let nutrition = entry.nutrition
    let quantity = entry.quantity
    if (args.quantity !== undefined && args.quantity !== entry.quantity) {
      if (args.quantity <= 0) throw new Error('Quantity must be positive')
      quantity = args.quantity
      const recomputed = await recomputeFromSource(ctx, entry, quantity)
      nutrition = recomputed ?? scaleFacts(entry.nutrition, quantity / entry.quantity)
    }

    await ctx.db.patch(args.id, {
      ...(args.date !== undefined ? { date: args.date } : {}),
      ...(args.meal !== undefined ? { meal: args.meal } : {}),
      quantity,
      nutrition,
    })
  },
})

export const remove = mutation({
  args: { id: v.id('consumptionEntries') },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new Error('Not authenticated')
    const entry = await ctx.db.get(args.id)
    if (!entry) return
    if (entry.userId !== user._id) throw new Error('Not the owner')
    await ctx.db.delete(args.id)
  },
})
