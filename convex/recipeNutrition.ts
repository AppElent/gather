'use node'

import { ConvexError, v } from 'convex/values'
import { action } from './_generated/server'
import { takeAiCall } from './lib/aiUsage'
import { anthropicApiKey } from './lib/anthropic'
import { estimateNutritionWithAi } from './lib/nutritionAiEstimate'
import { requireIdentity } from './lib/sharing'

export const estimateNutrition = action({
  args: {
    ingredients: v.array(v.string()),
    servings: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    if (args.ingredients.length === 0) {
      throw new ConvexError('Add some ingredients first.')
    }
    const apiKey = anthropicApiKey()
    if (!apiKey) throw new ConvexError('AI estimation is not configured.')
    await takeAiCall(ctx, identity.subject)
    const nutrition = await estimateNutritionWithAi(
      args.ingredients,
      args.servings,
      apiKey,
    )
    if (!nutrition) {
      throw new ConvexError(
        "Couldn't estimate nutrition — try entering it manually.",
      )
    }
    return nutrition
  },
})
