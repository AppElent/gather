/**
 * Mortgage calculations and the loan parts they are made of.
 *
 * A calculation is a **record the Group edits in place**, not a disposable
 * result: asking "what if" duplicates it rather than changing it and losing
 * what it said before (ADR-0025). Nothing here computes a payment — that is
 * `@gather/core/finance`'s job, and both clients do it from the same seam so a
 * figure cannot differ between the phone and the web.
 */

import { ConvexError, v } from 'convex/values'

import type { Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { mutation, query } from './_generated/server'
import {
  chargeValidator,
  findInGroup,
  loanPartKindValidator,
  nextOrder,
  repaymentValidator,
  requireAmount,
  requireInGroup,
  requireIsoDate,
  requireName,
  requirePercent,
} from './lib/finance'

async function partsOf(
  ctx: MutationCtx | Parameters<typeof findInGroup>[0],
  calculationId: Id<'mortgageCalculations'>,
) {
  const parts = await ctx.db
    .query('loanParts')
    .withIndex('by_calculation', (q) => q.eq('calculationId', calculationId))
    .collect()
  return parts.sort((a, b) => a.order - b.order)
}

export const get = query({
  args: { id: v.id('mortgageCalculations'), groupSlug: v.string() },
  handler: async (ctx, args) => {
    const found = await findInGroup(ctx, args.groupSlug, args.id)
    if (!found) return null
    const house = await ctx.db.get(found.doc.houseId)
    return {
      ...found.doc,
      houseName: house?.name ?? null,
      updatedByName:
        (await ctx.db.get(found.doc.updatedByUserId))?.name ?? null,
      parts: await partsOf(ctx, args.id),
    }
  },
})

/** One loan part, for the screen that is only about that part. */
export const getPart = query({
  args: { id: v.id('loanParts'), groupSlug: v.string() },
  handler: async (ctx, args) => {
    const found = await findInGroup(ctx, args.groupSlug, args.id)
    return found ? found.doc : null
  },
})

export const create = mutation({
  args: {
    houseId: v.id('houses'),
    groupSlug: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const { group, user } = await requireInGroup(
      ctx,
      args.groupSlug,
      args.houseId,
    )
    const existing = await ctx.db
      .query('mortgageCalculations')
      .withIndex('by_house', (q) => q.eq('houseId', args.houseId))
      .collect()
    return await ctx.db.insert('mortgageCalculations', {
      groupId: group._id,
      houseId: args.houseId,
      createdByUserId: user._id,
      updatedByUserId: user._id,
      updatedAt: Date.now(),
      name: requireName(args.name),
      order: nextOrder(existing),
    })
  },
})

export const rename = mutation({
  args: {
    id: v.id('mortgageCalculations'),
    groupSlug: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await requireInGroup(ctx, args.groupSlug, args.id)
    await ctx.db.patch(args.id, {
      name: requireName(args.name),
      updatedByUserId: user._id,
      updatedAt: Date.now(),
    })
  },
})

/**
 * How a Member asks "what if".
 *
 * The copy carries every part, every repayment and every charge, so the
 * original keeps saying exactly what it said before the question was asked.
 */
export const duplicate = mutation({
  args: {
    id: v.id('mortgageCalculations'),
    groupSlug: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const { doc, group, user } = await requireInGroup(
      ctx,
      args.groupSlug,
      args.id,
    )
    const siblings = await ctx.db
      .query('mortgageCalculations')
      .withIndex('by_house', (q) => q.eq('houseId', doc.houseId))
      .collect()
    const copyId = await ctx.db.insert('mortgageCalculations', {
      groupId: group._id,
      houseId: doc.houseId,
      createdByUserId: user._id,
      updatedByUserId: user._id,
      updatedAt: Date.now(),
      name: requireName(args.name),
      order: nextOrder(siblings),
    })
    for (const part of await partsOf(ctx, args.id)) {
      const { _id, _creationTime, calculationId, ...rest } = part
      await ctx.db.insert('loanParts', { ...rest, calculationId: copyId })
    }
    return copyId
  },
})

export const remove = mutation({
  args: { id: v.id('mortgageCalculations'), groupSlug: v.string() },
  handler: async (ctx, args) => {
    await requireInGroup(ctx, args.groupSlug, args.id)
    for (const part of await partsOf(ctx, args.id))
      await ctx.db.delete(part._id)
    await ctx.db.delete(args.id)
  },
})

const partFields = {
  kind: loanPartKindValidator,
  principalCents: v.number(),
  annualRatePercent: v.number(),
  termMonths: v.number(),
  fixedUntil: v.optional(v.string()),
  expiryRatePercent: v.optional(v.number()),
  expiryRateOptions: v.optional(v.array(v.number())),
  repayments: v.optional(v.array(repaymentValidator)),
  charge: v.optional(chargeValidator),
}

function validatePart(input: {
  principalCents: number
  annualRatePercent: number
  termMonths: number
  fixedUntil?: string
  expiryRatePercent?: number
  expiryRateOptions?: number[]
  repayments?: { kind: 'once' | 'monthly'; amountCents: number; date: string }[]
  charge?: { freeAnnualPercent: number; chargePercent: number }
}) {
  requireAmount(input.principalCents, { allowZero: false })
  requirePercent(input.annualRatePercent)
  if (input.termMonths < 1)
    throw new ConvexError('Term must be at least a month')
  if (input.fixedUntil) requireIsoDate(input.fixedUntil)
  if (input.expiryRatePercent !== undefined)
    requirePercent(input.expiryRatePercent)
  for (const rate of input.expiryRateOptions ?? []) requirePercent(rate)
  for (const repayment of input.repayments ?? []) {
    requireAmount(repayment.amountCents, { allowZero: false })
    requireIsoDate(repayment.date)
  }
  if (input.charge) {
    requirePercent(input.charge.freeAnnualPercent)
    requirePercent(input.charge.chargePercent)
  }
}

export const addPart = mutation({
  args: {
    calculationId: v.id('mortgageCalculations'),
    groupSlug: v.string(),
    ...partFields,
  },
  handler: async (ctx, args) => {
    const { group, user } = await requireInGroup(
      ctx,
      args.groupSlug,
      args.calculationId,
    )
    const { calculationId, groupSlug, ...part } = args
    validatePart(part)
    const partId = await ctx.db.insert('loanParts', {
      ...part,
      groupId: group._id,
      calculationId,
      termMonths: Math.max(1, Math.round(part.termMonths)),
      order: nextOrder(await partsOf(ctx, calculationId)),
    })
    await ctx.db.patch(calculationId, {
      updatedByUserId: user._id,
      updatedAt: Date.now(),
    })
    return partId
  },
})

export const updatePart = mutation({
  args: {
    id: v.id('loanParts'),
    groupSlug: v.string(),
    ...partFields,
  },
  handler: async (ctx, args) => {
    const { doc, user } = await requireInGroup(ctx, args.groupSlug, args.id)
    const { id, groupSlug, ...part } = args
    validatePart(part)
    await ctx.db.patch(id, {
      ...part,
      termMonths: Math.max(1, Math.round(part.termMonths)),
    })
    await ctx.db.patch(doc.calculationId, {
      updatedByUserId: user._id,
      updatedAt: Date.now(),
    })
  },
})

export const removePart = mutation({
  args: { id: v.id('loanParts'), groupSlug: v.string() },
  handler: async (ctx, args) => {
    const { doc, user } = await requireInGroup(ctx, args.groupSlug, args.id)
    await ctx.db.delete(args.id)
    await ctx.db.patch(doc.calculationId, {
      updatedByUserId: user._id,
      updatedAt: Date.now(),
    })
  },
})
