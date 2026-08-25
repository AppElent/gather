/**
 * A Group's investment holdings, and the transactions built on each one.
 *
 * Listed stocks and ETFs only, and a holding always starts from a **dated
 * opening position** — units and an average price, as at a day — because a
 * household that has been investing for ten years is not going to reconstruct
 * its history to use an overview (ADR-0026).
 *
 * Two things this deliberately does not do:
 *
 * - **Fetch a price.** There is no quote provider wired up, so `lastPriceCents`
 *   and `lastPriceAt` are what a Member entered and when. The screen reads the
 *   age off the same pair either way, so the day a provider lands it fills in
 *   the same two fields and nothing above it changes.
 * - **Process a corporate action.** A split, a merger or an ETF change is a
 *   Member-entered `adjustment` that states the new position. Gather never
 *   rewrites a holding on its own.
 */

import { ConvexError, v } from 'convex/values'

import { mutation, query } from './_generated/server'
import {
  findInGroup,
  holdingKindValidator,
  nextOrder,
  requireAmount,
  requireInGroup,
  requireIsoDate,
  requireName,
  transactionKindValidator,
} from './lib/finance'
import { requireGroupBySlug } from './lib/groupAccess'

/** The Group's home currency, and the rates a Member entered to reach it. */
export const settings = query({
  args: { groupSlug: v.string() },
  handler: async (ctx, args) => {
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    const row = await ctx.db
      .query('financeSettings')
      .withIndex('by_group', (q) => q.eq('groupId', group._id))
      .unique()
    // Euro until somebody says otherwise: the Module is Netherlands-first, and
    // a Group with nothing to convert should not be asked to choose.
    return row ?? { homeCurrency: 'EUR', rates: [] }
  },
})

export const saveSettings = mutation({
  args: {
    groupSlug: v.string(),
    homeCurrency: v.string(),
    rates: v.optional(
      v.array(
        v.object({
          currency: v.string(),
          rate: v.number(),
          asOf: v.number(),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    const currency = args.homeCurrency.trim().toUpperCase()
    if (!/^[A-Z]{3}$/.test(currency))
      throw new ConvexError('A currency is three letters')
    const existing = await ctx.db
      .query('financeSettings')
      .withIndex('by_group', (q) => q.eq('groupId', group._id))
      .unique()
    const fields = {
      groupId: group._id,
      homeCurrency: currency,
      rates: args.rates,
    }
    if (existing) {
      await ctx.db.patch(existing._id, fields)
      return existing._id
    }
    return await ctx.db.insert('financeSettings', fields)
  },
})

export const list = query({
  args: { groupSlug: v.string() },
  handler: async (ctx, args) => {
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    const holdings = await ctx.db
      .query('holdings')
      .withIndex('by_group', (q) => q.eq('groupId', group._id))
      .collect()
    return await Promise.all(
      holdings
        .sort((a, b) => a.order - b.order)
        .map(async (holding) => ({
          ...holding,
          transactions: (
            await ctx.db
              .query('holdingTransactions')
              .withIndex('by_holding', (q) => q.eq('holdingId', holding._id))
              .collect()
          ).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
        })),
    )
  },
})

export const get = query({
  args: { id: v.id('holdings'), groupSlug: v.string() },
  handler: async (ctx, args) => {
    const found = await findInGroup(ctx, args.groupSlug, args.id)
    if (!found) return null
    const transactions = await ctx.db
      .query('holdingTransactions')
      .withIndex('by_holding', (q) => q.eq('holdingId', args.id))
      .collect()
    return {
      ...found.doc,
      transactions: transactions.sort((a, b) =>
        a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
      ),
    }
  },
})

export const create = mutation({
  args: {
    groupSlug: v.string(),
    kind: holdingKindValidator,
    symbol: v.string(),
    name: v.string(),
    exchange: v.optional(v.string()),
    currency: v.string(),
    openingDate: v.string(),
    openingUnits: v.number(),
    openingAverageCostCents: v.number(),
    lastPriceCents: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { group, user } = await requireGroupBySlug(ctx, args.groupSlug)
    if (args.openingUnits <= 0)
      throw new ConvexError('An opening position needs units')
    const existing = await ctx.db
      .query('holdings')
      .withIndex('by_group', (q) => q.eq('groupId', group._id))
      .collect()
    return await ctx.db.insert('holdings', {
      groupId: group._id,
      createdByUserId: user._id,
      kind: args.kind,
      symbol: requireName(args.symbol).toUpperCase(),
      name: requireName(args.name),
      exchange: args.exchange?.trim() || undefined,
      currency: requireName(args.currency).toUpperCase(),
      openingDate: requireIsoDate(args.openingDate),
      openingUnits: args.openingUnits,
      openingAverageCostCents: requireAmount(args.openingAverageCostCents),
      // A price and the moment it is as at travel together, or not at all.
      lastPriceCents:
        args.lastPriceCents === undefined
          ? undefined
          : requireAmount(args.lastPriceCents),
      lastPriceAt: args.lastPriceCents === undefined ? undefined : Date.now(),
      order: nextOrder(existing),
    })
  },
})

export const update = mutation({
  args: {
    id: v.id('holdings'),
    groupSlug: v.string(),
    name: v.optional(v.string()),
    exchange: v.optional(v.string()),
    openingDate: v.optional(v.string()),
    openingUnits: v.optional(v.number()),
    openingAverageCostCents: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireInGroup(ctx, args.groupSlug, args.id)
    const patch: Record<string, unknown> = {}
    if (args.name !== undefined) patch.name = requireName(args.name)
    if (args.exchange !== undefined)
      patch.exchange = args.exchange.trim() || undefined
    if (args.openingDate !== undefined)
      patch.openingDate = requireIsoDate(args.openingDate)
    if (args.openingUnits !== undefined) {
      if (args.openingUnits <= 0)
        throw new ConvexError('An opening position needs units')
      patch.openingUnits = args.openingUnits
    }
    if (args.openingAverageCostCents !== undefined)
      patch.openingAverageCostCents = requireAmount(
        args.openingAverageCostCents,
      )
    await ctx.db.patch(args.id, patch)
  },
})

/**
 * A new price for one holding, with the moment it is as at.
 *
 * Separate from `update` because it is the one field a refresh writes: when a
 * quote provider arrives it calls this and nothing else, and a failed refresh
 * simply does not call it — leaving the last known price in place, with its
 * age, which is the honest thing to show.
 */
export const setPrice = mutation({
  args: {
    id: v.id('holdings'),
    groupSlug: v.string(),
    pricePerUnitCents: v.number(),
    asOf: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireInGroup(ctx, args.groupSlug, args.id)
    await ctx.db.patch(args.id, {
      lastPriceCents: requireAmount(args.pricePerUnitCents),
      lastPriceAt: args.asOf ?? Date.now(),
    })
  },
})

export const remove = mutation({
  args: { id: v.id('holdings'), groupSlug: v.string() },
  handler: async (ctx, args) => {
    await requireInGroup(ctx, args.groupSlug, args.id)
    const transactions = await ctx.db
      .query('holdingTransactions')
      .withIndex('by_holding', (q) => q.eq('holdingId', args.id))
      .collect()
    for (const transaction of transactions) await ctx.db.delete(transaction._id)
    await ctx.db.delete(args.id)
  },
})

const transactionFields = {
  kind: transactionKindValidator,
  date: v.string(),
  units: v.optional(v.number()),
  pricePerUnitCents: v.optional(v.number()),
  perUnitCents: v.optional(v.number()),
  feeCents: v.optional(v.number()),
  note: v.optional(v.string()),
}

/** Each kind needs different fields, and a half-filled one is not a record. */
function validateTransaction(input: {
  kind: string
  units?: number
  pricePerUnitCents?: number
  perUnitCents?: number
  feeCents?: number
}) {
  if (input.kind === 'buy' || input.kind === 'sell') {
    if (!input.units || input.units <= 0)
      throw new ConvexError('Enter how many units')
    if (input.pricePerUnitCents === undefined)
      throw new ConvexError('Enter the price per unit')
    requireAmount(input.pricePerUnitCents)
  }
  if (input.kind === 'dividend') {
    if (input.perUnitCents === undefined)
      throw new ConvexError('Enter the amount per unit')
    requireAmount(input.perUnitCents)
  }
  if (input.kind === 'fee' && !input.feeCents)
    throw new ConvexError('Enter the fee')
  if (input.kind === 'adjustment') {
    if (input.units === undefined || input.units < 0)
      throw new ConvexError('Say how many units you hold now')
    if (input.pricePerUnitCents === undefined)
      throw new ConvexError('Say what they cost on average')
    requireAmount(input.pricePerUnitCents)
  }
  if (input.feeCents !== undefined) requireAmount(input.feeCents)
}

export const addTransaction = mutation({
  args: {
    holdingId: v.id('holdings'),
    groupSlug: v.string(),
    ...transactionFields,
  },
  handler: async (ctx, args) => {
    const { group, user } = await requireInGroup(
      ctx,
      args.groupSlug,
      args.holdingId,
    )
    const { groupSlug, ...transaction } = args
    validateTransaction(transaction)
    return await ctx.db.insert('holdingTransactions', {
      ...transaction,
      date: requireIsoDate(args.date),
      note: args.note?.trim() || undefined,
      groupId: group._id,
      createdByUserId: user._id,
    })
  },
})

export const removeTransaction = mutation({
  args: { id: v.id('holdingTransactions'), groupSlug: v.string() },
  handler: async (ctx, args) => {
    await requireInGroup(ctx, args.groupSlug, args.id)
    await ctx.db.delete(args.id)
  },
})
