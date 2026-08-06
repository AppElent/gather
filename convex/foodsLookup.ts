'use node'

import { ConvexError, v } from 'convex/values'
import { api } from './_generated/api'
import { action } from './_generated/server'
import { fetchOffProduct, searchOffProducts } from './lib/offFetch'
import { mapOffProduct, mapOffSearchResults } from './lib/offMapping'

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

// Searches Open Food Facts by name, alongside the local search rather than
// only when it returns nothing — one poor local match used to suppress the
// entire external catalogue. Best-effort: any OFF-side failure (network,
// timeout, malformed response) surfaces as an empty array, never a thrown
// error, matching lookupBarcode's contract — a failed OFF search just means
// "no matches", same as a genuinely empty result set.
export const searchByName = action({
  args: { term: v.string(), locale: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new ConvexError('Not authenticated')
    // The locale the person is reading in, so the search looks in the
    // language they are typing. `searchOffProducts` decides what an
    // unrecognised one means; this only carries it.
    const raw = await searchOffProducts(args.term, args.locale)
    return mapOffSearchResults(raw)
  },
})
