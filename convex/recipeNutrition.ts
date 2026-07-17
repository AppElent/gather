'use node'

import { ConvexError, v } from 'convex/values'
import { action } from './_generated/server'
import { estimateNutritionWithAi } from './lib/nutritionAiEstimate'

export const estimateNutrition = action({
  args: {
    ingredients: v.array(v.string()),
    servings: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new ConvexError('Not authenticated')
    if (args.ingredients.length === 0) {
      throw new ConvexError('Add some ingredients first.')
    }
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new ConvexError('AI estimation is not configured.')
    const nutrition = await estimateNutritionWithAi(
      args.ingredients,
      args.servings,
      apiKey,
    )
    if (!nutrition) {
      throw new ConvexError("Couldn't estimate nutrition — try entering it manually.")
    }
    return nutrition
  },
})
