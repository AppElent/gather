'use node'

import { ConvexError, v } from 'convex/values'
import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { action } from './_generated/server'
import { offImportFields } from './lib/foodFields'
import { fetchOffProduct, searchOffProducts } from './lib/offFetch'
import { mapOffProduct, mapOffSearchResults } from './lib/offMapping'
import { storeRemoteImage } from './lib/safeFetch'
import { requireIdentity } from './lib/sharing'

/**
 * Where a food picture may come from.
 *
 * `importFromOff` and `storeOffImage` are public actions, so the `imageUrl`
 * each is handed is whatever a caller sent — not necessarily what our own
 * search returned.
 * `safeFetch` already refuses private and loopback addresses, which closes
 * SSRF; this closes the other half, which is gather's storage being used to
 * mirror arbitrary files off the public internet. Only Open Food Facts.
 */
export function isOffImageUrl(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url)
    return (
      protocol === 'https:' &&
      (hostname === 'openfoodfacts.org' ||
        hostname.endsWith('.openfoodfacts.org'))
    )
  } catch {
    return false
  }
}

// Fetches + maps a barcode from Open Food Facts, without saving anything. The
// client may import a named result directly, or show it for review first; a
// nameless result always needs that required-name form.
export const lookupBarcode = action({
  args: { barcode: v.string() },
  handler: async (ctx, args) => {
    await requireIdentity(ctx)
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
    await requireIdentity(ctx)
    const food = await ctx.runQuery(api.foods.get, { id: args.id })
    if (!food) throw new ConvexError('Food not found')
    if (!food.barcode) {
      throw new ConvexError('This food has no barcode to refresh from.')
    }
    const raw = await fetchOffProduct(food.barcode)
    if (!raw) {
      throw new ConvexError(
        'Could not reach Open Food Facts — try again later.',
      )
    }
    const mapped = mapOffProduct(raw)
    if (!mapped) {
      throw new ConvexError('Open Food Facts no longer has this product.')
    }
    await ctx.runMutation(internal.foods.applyOffRefresh, {
      id: args.id,
      barcode: food.barcode,
      name: mapped.name,
      brand: mapped.brand,
      baseUnit: food.baseUnit,
      nutritionPer100: mapped.nutritionPer100,
      servings: mapped.servings,
    })
  },
})

/**
 * Turn an Open Food Facts result into a food of your own.
 *
 * An action rather than a mutation because of the picture: fetching it is a
 * network call, and a mutation cannot make one. Everything else is the
 * `foods.upsertFromOff` mutation, unchanged and still doing the deciding about
 * what may be written — this only arrives with an extra field.
 */
export const importFromOff = action({
  args: {
    ...offImportFields,
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<'foods'>> => {
    await requireIdentity(ctx)
    const { imageUrl, ...fields } = args
    const imageId = imageUrl && isOffImageUrl(imageUrl)
      ? await storeRemoteImage(ctx, imageUrl)
      : undefined
    // The mutation decides whether this blob is used at all — an existing row
    // somebody has edited keeps what it has — and deletes it if not, so a
    // refused import leaves nothing behind in storage.
    return await ctx.runMutation(api.foods.upsertFromOff, {
      ...fields,
      imageId,
    })
  },
})

/**
 * Fetches an OFF picture after the food has already been saved. Image failures
 * are intentionally silent: the food's data is usable without one, and the
 * add sheet must not wait for an external image host before logging.
 */
export const storeOffImage = action({
  args: { id: v.id('foods'), imageUrl: v.string() },
  handler: async (ctx, args) => {
    await requireIdentity(ctx)
    // This public action fetches before it can know whether storage will
    // accept the blob. Reject an absent or read-only target first, otherwise a
    // caller could leave an unreachable file behind by naming a Catalog row.
    const food = await ctx.runQuery(api.foods.get, { id: args.id })
    if (!food || food.seedKey !== undefined) return
    const imageId = isOffImageUrl(args.imageUrl)
      ? await storeRemoteImage(ctx, args.imageUrl)
      : undefined
    if (!imageId) return
    await ctx.runMutation(internal.foods.attachOffImage, {
      id: args.id,
      imageId,
    })
  },
})

// Searches Open Food Facts by name, alongside the local search rather than
// only when it returns nothing, so one poor local match cannot suppress the
// entire external catalogue. Best-effort: any OFF-side failure (network,
// timeout, malformed response) surfaces as an empty array, never a thrown
// error, matching lookupBarcode's contract — a failed OFF search just means
// "no matches", same as a genuinely empty result set.
export const searchByName = action({
  args: { term: v.string(), locale: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireIdentity(ctx)
    // The locale the person is reading in, so the search looks in the
    // language they are typing. `searchOffProducts` decides what an
    // unrecognised one means; this only carries it.
    const raw = await searchOffProducts(args.term, args.locale)
    return mapOffSearchResults(raw)
  },
})
