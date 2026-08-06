import { ConvexError, v } from 'convex/values'
import type { Doc } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'
import { mutation, query } from './_generated/server'
import { foodSearchText } from './lib/foodSearchText'
import { nutritionValidator } from './lib/nutrition'
import { getCurrentUser } from './lib/sharing'
import { deleteStoredFile, replaceStoredFile } from './lib/storedFiles'

const foodFields = {
  name: v.string(),
  brand: v.optional(v.string()),
  baseUnit: v.union(v.literal('g'), v.literal('ml')),
  nutritionPer100: nutritionValidator,
  servingSize: v.optional(v.number()),
  servingLabel: v.optional(v.string()),
}

/**
 * Catalog entries are owned by nobody and read-only (ADR 0004). Every write
 * path into `foods` goes through this, not just the edit form: these are
 * public mutations, so a client can call any of them with any food id
 * regardless of what the UI offers. Allowing a write would be worse than
 * refusing it — the next Catalog seed overwrites unconditionally, so the
 * change would silently revert.
 */
function assertNotCatalog(food: Doc<'foods'>) {
  if (food.seedKey !== undefined) {
    throw new ConvexError(
      'This is a built-in catalog food and cannot be changed. Create a new food instead.',
    )
  }
}

/**
 * A food as a reader gets it: the row, plus a URL for its picture.
 *
 * The row holds a `_storage` id, which is no use to an `<img>`. Resolving it
 * here rather than in the client is what keeps a result list one round trip.
 */
async function withImageUrl(ctx: QueryCtx, food: Doc<'foods'>) {
  return {
    ...food,
    imageUrl: food.imageId ? await ctx.storage.getUrl(food.imageId) : null,
  }
}

export const search = query({
  args: { term: v.string() },
  handler: async (ctx, args) => {
    if (!(await getCurrentUser(ctx))) return []
    if (!args.term.trim()) return []
    const rows = await ctx.db
      .query('foods')
      .withSearchIndex('search_by_text', (q) =>
        q.search('searchText', args.term),
      )
      .take(20)
    return await Promise.all(rows.map((row) => withImageUrl(ctx, row)))
  },
})

export const get = query({
  args: { id: v.id('foods') },
  handler: async (ctx, args) => {
    if (!(await getCurrentUser(ctx))) return null
    const food = await ctx.db.get(args.id)
    return food ? await withImageUrl(ctx, food) : null
  },
})

export const getByBarcode = query({
  args: { barcode: v.string() },
  handler: async (ctx, args) => {
    if (!(await getCurrentUser(ctx))) return null
    const food = await ctx.db
      .query('foods')
      .withIndex('by_barcode', (q) => q.eq('barcode', args.barcode))
      .unique()
    return food ? await withImageUrl(ctx, food) : null
  },
})

// Manual creation. If a barcode is supplied and a row already has it (e.g.
// the user scanned first, OFF had nothing, and they're filling it in by
// hand), reuse that row instead of creating a duplicate — the "no duplicate
// row per barcode" invariant applies here too, not just to `upsertFromOff`.
export const create = mutation({
  args: { ...foodFields, barcode: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new Error('Not authenticated')
    if (args.barcode) {
      const existing = await ctx.db
        .query('foods')
        .withIndex('by_barcode', (q) => q.eq('barcode', args.barcode))
        .unique()
      if (existing) return existing._id
    }
    return await ctx.db.insert('foods', {
      ...args,
      searchText: foodSearchText(args),
      source: 'manual',
      createdBy: user._id,
    })
  },
})

// Any edit through the general edit form counts as a local edit: from this
// point on, a rescan of this barcode must never silently overwrite what the
// user typed, until they explicitly ask to refresh.
export const update = mutation({
  args: { id: v.id('foods'), ...foodFields, barcode: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new Error('Not authenticated')
    const { id, ...rest } = args
    const food = await ctx.db.get(id)
    if (!food) throw new Error('Food not found')
    assertNotCatalog(food)
    await ctx.db.patch(id, {
      ...rest,
      searchText: foodSearchText(rest),
      localEdited: true,
    })
  },
})

// Called after a successful OFF lookup + user confirmation: upserts by
// barcode so a rescan never creates a duplicate row. A row a human has
// already edited (`localEdited`) is left untouched — only the explicit
// "refresh from Open Food Facts" flow (`applyOffRefresh` below) may
// overwrite local edits.
export const upsertFromOff = mutation({
  args: {
    ...foodFields,
    barcode: v.string(),
    // Already fetched and stored by `foodsLookup.importFromOff`, which is the
    // only thing that can make the network call this needs.
    imageId: v.optional(v.id('_storage')),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new Error('Not authenticated')
    const { barcode, ...rest } = args
    const existing = await ctx.db
      .query('foods')
      .withIndex('by_barcode', (q) => q.eq('barcode', barcode))
      .unique()
    if (existing) {
      // No Catalog fixture carries a barcode today, so this is unreachable —
      // but the invariant belongs to the table, not to the current fixtures.
      assertNotCatalog(existing)
      if (existing.localEdited) {
        // Nothing is written, so the picture just fetched for this import is
        // already unreachable. Deleting it here is what keeps "a blob lives
        // exactly as long as a row points at it" true of a refused import.
        await deleteStoredFile(ctx, rest.imageId)
        return existing._id
      }
      const previousImageId = existing.imageId
      await ctx.db.patch(existing._id, {
        ...rest,
        searchText: foodSearchText(rest),
      })
      await replaceStoredFile(ctx, previousImageId, rest.imageId)
      return existing._id
    }
    return await ctx.db.insert('foods', {
      ...rest,
      searchText: foodSearchText(rest),
      barcode,
      source: 'openfoodfacts',
      createdBy: user._id,
    })
  },
})

// Applies a fresh Open Food Facts fetch over an existing row and clears
// localEdited. Only ever called by the `refreshFromOff` action (a future
// task, `convex/foodsLookup.ts`) after an explicit user confirmation — never
// automatically, and never from `update`/`upsertFromOff`.
export const applyOffRefresh = mutation({
  args: { id: v.id('foods'), ...foodFields, barcode: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new Error('Not authenticated')
    const { id, ...rest } = args
    const food = await ctx.db.get(id)
    if (!food) throw new Error('Food not found')
    // `barcode` arrives as an argument rather than being read off the row, so
    // the "this food has no barcode" check in `foodsLookup.refreshFromOff` is
    // no protection here — a client can call this mutation directly with any
    // food id at all.
    assertNotCatalog(food)
    await ctx.db.patch(id, {
      ...rest,
      searchText: foodSearchText(rest),
      source: 'openfoodfacts',
      localEdited: false,
    })
  },
})
