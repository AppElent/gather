/**
 * What a Group is saving towards.
 *
 * The target, the date and what has been put aside are all typed in; the
 * required monthly amount and the expected completion date are calculated and
 * never stored, because a stored answer is one that goes stale the day after
 * it is written (ADR-0025).
 */

import { v } from 'convex/values'

import { mutation, query } from './_generated/server'
import {
  findInGroup,
  nextOrder,
  requireAmount,
  requireInGroup,
  requireIsoDate,
  requireName,
} from './lib/finance'
import { requireGroupBySlug } from './lib/groupAccess'

export const list = query({
  args: { groupSlug: v.string() },
  handler: async (ctx, args) => {
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    const goals = await ctx.db
      .query('savingsGoals')
      .withIndex('by_group', (q) => q.eq('groupId', group._id))
      .collect()
    return await Promise.all(
      goals
        .sort((a, b) => a.order - b.order)
        .map(async (goal) => ({
          ...goal,
          updatedByName: (await ctx.db.get(goal.updatedByUserId))?.name ?? null,
        })),
    )
  },
})

export const get = query({
  args: { id: v.id('savingsGoals'), groupSlug: v.string() },
  handler: async (ctx, args) => {
    const found = await findInGroup(ctx, args.groupSlug, args.id)
    if (!found) return null
    return {
      ...found.doc,
      updatedByName:
        (await ctx.db.get(found.doc.updatedByUserId))?.name ?? null,
    }
  },
})

export const create = mutation({
  args: {
    groupSlug: v.string(),
    name: v.string(),
    targetCents: v.number(),
    targetDate: v.string(),
    savedCents: v.optional(v.number()),
    monthlyCents: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { group, user } = await requireGroupBySlug(ctx, args.groupSlug)
    const existing = await ctx.db
      .query('savingsGoals')
      .withIndex('by_group', (q) => q.eq('groupId', group._id))
      .collect()
    return await ctx.db.insert('savingsGoals', {
      groupId: group._id,
      createdByUserId: user._id,
      name: requireName(args.name),
      targetCents: requireAmount(args.targetCents, { allowZero: false }),
      targetDate: requireIsoDate(args.targetDate),
      savedCents: requireAmount(args.savedCents ?? 0),
      monthlyCents:
        args.monthlyCents === undefined
          ? undefined
          : requireAmount(args.monthlyCents),
      updatedByUserId: user._id,
      updatedAt: Date.now(),
      order: nextOrder(existing),
    })
  },
})

export const update = mutation({
  args: {
    id: v.id('savingsGoals'),
    groupSlug: v.string(),
    name: v.optional(v.string()),
    targetCents: v.optional(v.number()),
    targetDate: v.optional(v.string()),
    savedCents: v.optional(v.number()),
    monthlyCents: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireInGroup(ctx, args.groupSlug, args.id)
    const patch: Record<string, unknown> = {
      updatedByUserId: user._id,
      updatedAt: Date.now(),
    }
    if (args.name !== undefined) patch.name = requireName(args.name)
    if (args.targetCents !== undefined)
      patch.targetCents = requireAmount(args.targetCents, { allowZero: false })
    if (args.targetDate !== undefined)
      patch.targetDate = requireIsoDate(args.targetDate)
    if (args.savedCents !== undefined)
      patch.savedCents = requireAmount(args.savedCents)
    if (args.monthlyCents !== undefined)
      patch.monthlyCents = requireAmount(args.monthlyCents)
    await ctx.db.patch(args.id, patch)
  },
})

export const remove = mutation({
  args: { id: v.id('savingsGoals'), groupSlug: v.string() },
  handler: async (ctx, args) => {
    await requireInGroup(ctx, args.groupSlug, args.id)
    await ctx.db.delete(args.id)
  },
})
