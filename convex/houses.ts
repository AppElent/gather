/**
 * The Houses a Group has entered, and what buying one costs.
 *
 * A House is the container for what a home costs (ADR-0025): it holds one
 * Home-buying costs and one or more Mortgage calculations. It is entered by
 * hand and may be one the Group is only considering — there is no property
 * register behind any of this, and the value is whatever somebody last typed.
 *
 * The Group comes from the caller's request and nowhere else (ADR-0002).
 */

import { v } from 'convex/values'

import type { Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { mutation, query } from './_generated/server'
import {
  buyingCostLinesValidator,
  findInGroup,
  nextOrder,
  requireAmount,
  requireInGroup,
  requireIsoDate,
  requireName,
  requirePercent,
  transferTaxBandValidator,
} from './lib/finance'
import { requireGroupBySlug } from './lib/groupAccess'

/**
 * Every House in the Group, each with enough of its mortgage to fill the index
 * row: what it costs a month and how many parts that is.
 *
 * Computed here rather than on the phone because the index would otherwise
 * fetch every calculation and every part of every House to draw one subtitle.
 */
export const list = query({
  args: { groupSlug: v.string() },
  handler: async (ctx, args) => {
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    const houses = await ctx.db
      .query('houses')
      .withIndex('by_group', (q) => q.eq('groupId', group._id))
      .collect()

    return await Promise.all(
      houses
        .sort((a, b) => a.order - b.order)
        .map(async (house) => {
          const calculations = await ctx.db
            .query('mortgageCalculations')
            .withIndex('by_house', (q) => q.eq('houseId', house._id))
            .collect()
          const first = calculations.sort((a, b) => a.order - b.order)[0]
          const parts = first
            ? await ctx.db
                .query('loanParts')
                .withIndex('by_calculation', (q) =>
                  q.eq('calculationId', first._id),
                )
                .collect()
            : []
          return {
            ...house,
            calculationCount: calculations.length,
            // The parts of the House's first calculation — the one the Group
            // ordered first, which is the one the index is about.
            parts: parts.sort((a, b) => a.order - b.order),
          }
        }),
    )
  },
})

export const get = query({
  args: { id: v.id('houses'), groupSlug: v.string() },
  handler: async (ctx, args) => {
    const found = await findInGroup(ctx, args.groupSlug, args.id)
    if (!found) return null

    const calculations = await ctx.db
      .query('mortgageCalculations')
      .withIndex('by_house', (q) => q.eq('houseId', args.id))
      .collect()

    const withParts = await Promise.all(
      calculations
        .sort((a, b) => a.order - b.order)
        .map(async (calculation) => ({
          ...calculation,
          updatedByName: (await ctx.db.get(calculation.updatedByUserId))?.name,
          parts: (
            await ctx.db
              .query('loanParts')
              .withIndex('by_calculation', (q) =>
                q.eq('calculationId', calculation._id),
              )
              .collect()
          ).sort((a, b) => a.order - b.order),
        })),
    )

    const buyingCosts = await ctx.db
      .query('homeBuyingCosts')
      .withIndex('by_house', (q) => q.eq('houseId', args.id))
      .unique()

    return { ...found.doc, calculations: withParts, buyingCosts }
  },
})

/** One field, because everything else about a House arrives later. */
export const create = mutation({
  args: { groupSlug: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    const { group, user } = await requireGroupBySlug(ctx, args.groupSlug)
    const existing = await ctx.db
      .query('houses')
      .withIndex('by_group', (q) => q.eq('groupId', group._id))
      .collect()
    return await ctx.db.insert('houses', {
      groupId: group._id,
      createdByUserId: user._id,
      name: requireName(args.name),
      order: nextOrder(existing),
    })
  },
})

export const update = mutation({
  args: {
    id: v.id('houses'),
    groupSlug: v.string(),
    name: v.optional(v.string()),
    valueCents: v.optional(v.number()),
    valueAsOf: v.optional(v.string()),
    boughtOn: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireInGroup(ctx, args.groupSlug, args.id)
    const patch: Record<string, unknown> = {}
    if (args.name !== undefined) patch.name = requireName(args.name)
    if (args.valueCents !== undefined) {
      patch.valueCents = requireAmount(args.valueCents)
      // A value nobody dated is a value nobody can judge the age of, so the
      // form always sends one and this fills in today if it did not.
      patch.valueAsOf = args.valueAsOf
        ? requireIsoDate(args.valueAsOf)
        : new Date().toISOString().slice(0, 10)
    } else if (args.valueAsOf !== undefined) {
      patch.valueAsOf = requireIsoDate(args.valueAsOf)
    }
    if (args.boughtOn !== undefined)
      patch.boughtOn = requireIsoDate(args.boughtOn)
    await ctx.db.patch(args.id, patch)
  },
})

/** Everything a House contains goes with it — nothing is left unreachable. */
async function deleteHouseContents(ctx: MutationCtx, houseId: Id<'houses'>) {
  const calculations = await ctx.db
    .query('mortgageCalculations')
    .withIndex('by_house', (q) => q.eq('houseId', houseId))
    .collect()
  for (const calculation of calculations) {
    const parts = await ctx.db
      .query('loanParts')
      .withIndex('by_calculation', (q) =>
        q.eq('calculationId', calculation._id),
      )
      .collect()
    for (const part of parts) await ctx.db.delete(part._id)
    await ctx.db.delete(calculation._id)
  }
  const costs = await ctx.db
    .query('homeBuyingCosts')
    .withIndex('by_house', (q) => q.eq('houseId', houseId))
    .unique()
  if (costs) await ctx.db.delete(costs._id)
}

export const remove = mutation({
  args: { id: v.id('houses'), groupSlug: v.string() },
  handler: async (ctx, args) => {
    await requireInGroup(ctx, args.groupSlug, args.id)
    await deleteHouseContents(ctx, args.id)
    await ctx.db.delete(args.id)
  },
})

/**
 * The House's one Home-buying costs record, written whole.
 *
 * One mutation rather than a create and an update: there is exactly one per
 * House and the screen always holds every field, so a caller that had to know
 * which of the two it was doing would be a caller that could get it wrong.
 */
export const saveBuyingCosts = mutation({
  args: {
    houseId: v.id('houses'),
    groupSlug: v.string(),
    purchasePriceCents: v.number(),
    ownMoneyCents: v.number(),
    mortgageCents: v.number(),
    mortgageRatePercent: v.number(),
    mortgageTermMonths: v.number(),
    transferTaxBand: transferTaxBandValidator,
    transferTaxPercent: v.number(),
    lines: v.optional(buyingCostLinesValidator),
    nhgPercent: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { group, user } = await requireInGroup(
      ctx,
      args.groupSlug,
      args.houseId,
    )
    const fields = {
      groupId: group._id,
      houseId: args.houseId,
      updatedByUserId: user._id,
      purchasePriceCents: requireAmount(args.purchasePriceCents),
      ownMoneyCents: requireAmount(args.ownMoneyCents),
      mortgageCents: requireAmount(args.mortgageCents),
      mortgageRatePercent: requirePercent(args.mortgageRatePercent),
      mortgageTermMonths: Math.max(1, Math.round(args.mortgageTermMonths)),
      transferTaxBand: args.transferTaxBand,
      transferTaxPercent: requirePercent(args.transferTaxPercent),
      lines: args.lines,
      nhgPercent:
        args.nhgPercent === undefined
          ? undefined
          : requirePercent(args.nhgPercent),
    }

    const existing = await ctx.db
      .query('homeBuyingCosts')
      .withIndex('by_house', (q) => q.eq('houseId', args.houseId))
      .unique()
    if (existing) {
      await ctx.db.patch(existing._id, fields)
      return existing._id
    }
    return await ctx.db.insert('homeBuyingCosts', fields)
  },
})

export const removeBuyingCosts = mutation({
  args: { id: v.id('homeBuyingCosts'), groupSlug: v.string() },
  handler: async (ctx, args) => {
    await requireInGroup(ctx, args.groupSlug, args.id)
    await ctx.db.delete(args.id)
  },
})
