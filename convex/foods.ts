import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { nutritionValidator } from './lib/nutrition'
import { getCurrentUser } from './lib/sharing'

const foodFields = {
  name: v.string(),
  brand: v.optional(v.string()),
  baseUnit: v.union(v.literal('g'), v.literal('ml')),
  nutritionPer100: nutritionValidator,
  servingSize: v.optional(v.number()),
  servingLabel: v.optional(v.string()),
}

export const search = query({
  args: { term: v.string() },
  handler: async (ctx, args) => {
    if (!(await getCurrentUser(ctx))) return []
    if (!args.term.trim()) return []
    return await ctx.db
      .query('foods')
      .withSearchIndex('search_by_name', (q) => q.search('name', args.term))
      .take(20)
  },
})

export const get = query({
  args: { id: v.id('foods') },
  handler: async (ctx, args) => {
    if (!(await getCurrentUser(ctx))) return null
    return await ctx.db.get(args.id)
  },
})

export const getByBarcode = query({
  args: { barcode: v.string() },
  handler: async (ctx, args) => {
    if (!(await getCurrentUser(ctx))) return null
    return await ctx.db
      .query('foods')
      .withIndex('by_barcode', (q) => q.eq('barcode', args.barcode))
      .unique()
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
    await ctx.db.patch(id, { ...rest, localEdited: true })
  },
})

// Called after a successful OFF lookup + user confirmation: upserts by
// barcode so a rescan never creates a duplicate row. A row a human has
// already edited (`localEdited`) is left untouched — only the explicit
// "refresh from Open Food Facts" flow (`applyOffRefresh` below) may
// overwrite local edits.
export const upsertFromOff = mutation({
  args: { ...foodFields, barcode: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new Error('Not authenticated')
    const { barcode, ...rest } = args
    const existing = await ctx.db
      .query('foods')
      .withIndex('by_barcode', (q) => q.eq('barcode', barcode))
      .unique()
    if (existing) {
      if (!existing.localEdited) await ctx.db.patch(existing._id, rest)
      return existing._id
    }
    return await ctx.db.insert('foods', {
      ...rest,
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
    await ctx.db.patch(id, {
      ...rest,
      source: 'openfoodfacts',
      localEdited: false,
    })
  },
})
