'use node'

import { ConvexError, v } from 'convex/values'
import { api } from './_generated/api'
import { action } from './_generated/server'
import { fetchOffProduct } from './lib/offFetch'
import { mapOffProduct } from './lib/offMapping'

// Fetches + maps a barcode from Open Food Facts, without saving anything —
// the client shows the result for review and calls `foods.upsertFromOff`
// (or falls back to a blank manual form) only once the user confirms.
export const lookupBarcode = action({
  args: { barcode: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new ConvexError('Not authenticated')
    const raw = await fetchOffProduct(args.barcode)
    if (!raw) return null
    return mapOffProduct(raw)
  },
})

// Re-fetches an existing food's data from Open Food Facts and overwrites it,
// clearing localEdited. Only called after the user explicitly confirms (the
// UI shows a confirm dialog before calling this) — never automatic.
export const refreshFromOff = action({
  args: { id: v.id('foods') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new ConvexError('Not authenticated')
    const food = await ctx.runQuery(api.foods.get, { id: args.id })
    if (!food) throw new ConvexError('Food not found')
    if (!food.barcode) {
      throw new ConvexError('This food has no barcode to refresh from.')
    }
    const raw = await fetchOffProduct(food.barcode)
    if (!raw) {
      throw new ConvexError('Could not reach Open Food Facts — try again later.')
    }
    const mapped = mapOffProduct(raw)
    if (!mapped) {
      throw new ConvexError('Open Food Facts no longer has this product.')
    }
    await ctx.runMutation(api.foods.applyOffRefresh, {
      id: args.id,
      barcode: food.barcode,
      name: mapped.name,
      brand: mapped.brand,
      baseUnit: food.baseUnit,
      nutritionPer100: mapped.nutritionPer100,
      servingSize: mapped.servingSize,
      servingLabel: mapped.servingLabel,
    })
  },
})
