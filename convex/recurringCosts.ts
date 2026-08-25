/**
 * What the household pays over and over.
 *
 * The Bills & subscriptions Module folded into Finances as this (ADR-0025).
 * What did not come with it is everything it implied: there are no payment
 * instances, no due dates, no renewals and no reminders. A cost is an amount,
 * how often it comes round, a category and — optionally — a **split ratio**,
 * which divides a standing cost and is not a debt.
 */

import { ConvexError, v } from 'convex/values'

import { mutation, query } from './_generated/server'
import {
  costCategoryValidator,
  costFrequencyValidator,
  findInGroup,
  nextOrder,
  requireAmount,
  requireInGroup,
  requireName,
  splitShareValidator,
} from './lib/finance'
import { getMembership, requireGroupBySlug } from './lib/groupAccess'

export const list = query({
  args: { groupSlug: v.string() },
  handler: async (ctx, args) => {
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    const costs = await ctx.db
      .query('recurringCosts')
      .withIndex('by_group', (q) => q.eq('groupId', group._id))
      .collect()
    return costs.sort((a, b) => a.order - b.order)
  },
})

export const get = query({
  args: { id: v.id('recurringCosts'), groupSlug: v.string() },
  handler: async (ctx, args) => {
    const found = await findInGroup(ctx, args.groupSlug, args.id)
    return found ? found.doc : null
  },
})

/**
 * A ratio has to add to a hundred and may only name people who are in the
 * Group now. Both are refusals rather than corrections: silently dropping a
 * share would change what the Member said the household agreed.
 */
async function validateSplit(
  ctx: Parameters<typeof getMembership>[0],
  groupId: Parameters<typeof getMembership>[1],
  split: { userId: Parameters<typeof getMembership>[2]; percent: number }[],
) {
  if (split.length === 0) return
  const total = split.reduce((sum, share) => sum + share.percent, 0)
  if (total !== 100) throw new ConvexError('Shares must add up to 100')
  for (const share of split) {
    if (share.percent < 0) throw new ConvexError('A share cannot be negative')
    if (!(await getMembership(ctx, groupId, share.userId)))
      throw new ConvexError('Not a member of this group')
  }
}

const costFields = {
  name: v.string(),
  amountCents: v.number(),
  frequency: costFrequencyValidator,
  category: costCategoryValidator,
  note: v.optional(v.string()),
  split: v.optional(v.array(splitShareValidator)),
}

export const create = mutation({
  args: { groupSlug: v.string(), ...costFields },
  handler: async (ctx, args) => {
    const { group, user } = await requireGroupBySlug(ctx, args.groupSlug)
    await validateSplit(ctx, group._id, args.split ?? [])
    const existing = await ctx.db
      .query('recurringCosts')
      .withIndex('by_group', (q) => q.eq('groupId', group._id))
      .collect()
    return await ctx.db.insert('recurringCosts', {
      groupId: group._id,
      createdByUserId: user._id,
      name: requireName(args.name),
      amountCents: requireAmount(args.amountCents, { allowZero: false }),
      frequency: args.frequency,
      category: args.category,
      note: args.note?.trim() || undefined,
      split: args.split,
      order: nextOrder(existing),
    })
  },
})

export const update = mutation({
  args: { id: v.id('recurringCosts'), groupSlug: v.string(), ...costFields },
  handler: async (ctx, args) => {
    const { group } = await requireInGroup(ctx, args.groupSlug, args.id)
    await validateSplit(ctx, group._id, args.split ?? [])
    await ctx.db.patch(args.id, {
      name: requireName(args.name),
      amountCents: requireAmount(args.amountCents, { allowZero: false }),
      frequency: args.frequency,
      category: args.category,
      note: args.note?.trim() || undefined,
      split: args.split,
    })
  },
})

export const remove = mutation({
  args: { id: v.id('recurringCosts'), groupSlug: v.string() },
  handler: async (ctx, args) => {
    await requireInGroup(ctx, args.groupSlug, args.id)
    await ctx.db.delete(args.id)
  },
})
