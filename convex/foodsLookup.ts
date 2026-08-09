'use node'

import { ConvexError, v } from 'convex/values'
import { api } from './_generated/api'
import type { ActionCtx } from './_generated/server'
import { action } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { nutritionSourceValidator, nutritionValidator } from './lib/nutrition'
import { fetchOffProduct, searchOffProducts } from './lib/offFetch'
import { mapOffProduct, mapOffSearchResults } from './lib/offMapping'
import { servingValidator } from './lib/servings'
import { safeFetch } from './recipeImport'

/** Long enough for a thumbnail, short enough not to hold up an import. */
const IMAGE_TIMEOUT_MS = 8_000

/**
 * The largest picture worth keeping. A front-of-packet thumbnail is tens of
 * kilobytes; anything past this is not the thing we asked for.
 */
const MAX_IMAGE_BYTES = 2 * 1024 * 1024

/**
 * Where a food picture may come from.
 *
 * `importFromOff` is a public action, so the `imageUrl` it is handed is
 * whatever a caller sent — not necessarily what our own search returned.
 * `safeFetch` already refuses private and loopback addresses, which closes
 * SSRF; this closes the other half, which is gather's storage being used to
 * mirror arbitrary files off the public internet. Only Open Food Facts.
 */
export function isOffImageUrl(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url)
    return (
      protocol === 'https:' &&
      (hostname === 'openfoodfacts.org' || hostname.endsWith('.openfoodfacts.org'))
    )
  } catch {
    return false
  }
}

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
      servings: mapped.servings,
    })
  },
})

/**
 * Fetch a product's picture and keep it.
 *
 * Best effort in every direction: a product with no picture, a URL that is not
 * Open Food Facts', one that does not resolve, a server that is down, a
 * response that is not an image or is too big, a blob that will not store —
 * each means a food with no picture, never a failed import.
 *
 * Three separate refusals, because they close three different doors:
 * `isOffImageUrl` (this is a public action, so the URL is whatever a caller
 * sent), `safeFetch`'s redirect-revalidating host check (SSRF), and the
 * content-type and size checks below (storage being filled with something that
 * is not a thumbnail). A `content-length` that lies is caught by measuring the
 * blob after, before anything is stored.
 */
async function storeOffImage(
  ctx: ActionCtx,
  url: string | undefined,
): Promise<Id<'_storage'> | undefined> {
  if (!url || !isOffImageUrl(url)) return undefined
  try {
    const response = await safeFetch(url, {
      signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
    })
    if (!response?.ok) return undefined
    if (!response.headers.get('content-type')?.startsWith('image/')) {
      return undefined
    }
    const declared = Number(response.headers.get('content-length'))
    if (Number.isFinite(declared) && declared > MAX_IMAGE_BYTES) return undefined
    const blob = await response.blob()
    if (blob.size > MAX_IMAGE_BYTES) return undefined
    return await ctx.storage.store(blob)
  } catch {
    return undefined
  }
}

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
    barcode: v.string(),
    name: v.string(),
    brand: v.optional(v.string()),
    baseUnit: v.union(v.literal('g'), v.literal('ml')),
    nutritionPer100: nutritionValidator,
    servings: v.optional(v.array(servingValidator)),
    imageUrl: v.optional(v.string()),
    // Carried through rather than assumed: every import is now reviewed in the
    // food form before it is saved (#93), and somebody who corrected a figure
    // in that form arrives here saying `manual`. Absent still means `imported`,
    // which `foods.upsertFromOff` is the one to decide.
    nutritionSource: v.optional(nutritionSourceValidator),
    // The emoji picked while reviewing (#94) — which is where one is most
    // obviously missing, because an Open Food Facts product with no photograph
    // is exactly the food with nothing else to show. Every field of the review
    // reaches the row through this action, so an icon that stopped here would
    // be dropped at the save without anything saying so.
    icon: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args): Promise<Id<'foods'>> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new ConvexError('Not authenticated')
    const { imageUrl, ...fields } = args
    const imageId = await storeOffImage(ctx, imageUrl)
    // The mutation decides whether this blob is used at all — an existing row
    // somebody has edited keeps what it has — and deletes it if not, so a
    // refused import leaves nothing behind in storage.
    return await ctx.runMutation(api.foods.upsertFromOff, { ...fields, imageId })
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
