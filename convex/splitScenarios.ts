/**
 * Shared costs, on the rare occasion somebody keeps one.
 *
 * The calculator itself stores nothing: it is the only disposable one left in
 * the Module (ADR-0025), and closing the screen is meant to lose it. What lives
 * here is the exception — a result a Member explicitly saved so the household
 * could revisit it.
 *
 * A saved split is **immutable**. There is no update mutation, and there will
 * not be one: `duplicate` is how a Member changes one, which is what keeps a
 * comparison holding the assumptions that produced it.
 *
 * The results are stored frozen rather than recomputed on read, and the
 * Members are stored by name as well as by id. A scenario has to keep reading
 * correctly after somebody leaves the Group, and one that recalculated would
 * quietly stop being the thing that was saved.
 */

import { ConvexError, v } from 'convex/values'

import { mutation, query } from './_generated/server'
import {
  findInGroup,
  requireInGroup,
  requireName,
  splitPartyValidator,
} from './lib/finance'
import { requireGroupBySlug } from './lib/groupAccess'

export const list = query({
  args: { groupSlug: v.string() },
  handler: async (ctx, args) => {
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    const scenarios = await ctx.db
      .query('splitScenarios')
      .withIndex('by_group', (q) => q.eq('groupId', group._id))
      .collect()
    return scenarios.sort((a, b) => b.createdAt - a.createdAt)
  },
})

export const get = query({
  args: { id: v.id('splitScenarios'), groupSlug: v.string() },
  handler: async (ctx, args) => {
    const found = await findInGroup(ctx, args.groupSlug, args.id)
    if (!found) return null
    return {
      ...found.doc,
      createdByName:
        (await ctx.db.get(found.doc.createdByUserId))?.name ?? null,
    }
  },
})

const scenarioFields = {
  name: v.string(),
  payments: v.array(
    v.object({
      party: splitPartyValidator,
      amountCents: v.number(),
      label: v.optional(v.string()),
    }),
  ),
  participants: v.array(splitPartyValidator),
  mode: v.union(v.literal('equal'), v.literal('custom')),
  owed: v.array(
    v.object({ party: splitPartyValidator, amountCents: v.number() }),
  ),
  transfers: v.array(
    v.object({
      from: splitPartyValidator,
      to: splitPartyValidator,
      amountCents: v.number(),
    }),
  ),
  totalCents: v.number(),
}

/**
 * The one check worth making on a frozen result: it has to hand out exactly
 * what was paid. A scenario whose allocation does not add up is one that
 * invents or loses money every time anybody reads it.
 */
function requireBalanced(args: {
  payments: { amountCents: number }[]
  owed: { amountCents: number }[]
  totalCents: number
}) {
  const paid = args.payments.reduce((sum, p) => sum + p.amountCents, 0)
  const owed = args.owed.reduce((sum, o) => sum + o.amountCents, 0)
  if (paid !== args.totalCents || owed !== args.totalCents)
    throw new ConvexError('A saved split has to add up to what was paid')
}

export const save = mutation({
  args: { groupSlug: v.string(), ...scenarioFields },
  handler: async (ctx, args) => {
    const { group, user } = await requireGroupBySlug(ctx, args.groupSlug)
    requireBalanced(args)
    const { groupSlug, ...scenario } = args
    return await ctx.db.insert('splitScenarios', {
      ...scenario,
      name: requireName(args.name),
      groupId: group._id,
      createdByUserId: user._id,
      createdAt: Date.now(),
    })
  },
})

/** The only way to change a saved split: make another one from it. */
export const duplicate = mutation({
  args: {
    id: v.id('splitScenarios'),
    groupSlug: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const { doc, group, user } = await requireInGroup(
      ctx,
      args.groupSlug,
      args.id,
    )
    const { _id, _creationTime, ...rest } = doc
    return await ctx.db.insert('splitScenarios', {
      ...rest,
      name: requireName(args.name),
      groupId: group._id,
      createdByUserId: user._id,
      createdAt: Date.now(),
    })
  },
})

export const remove = mutation({
  args: { id: v.id('splitScenarios'), groupSlug: v.string() },
  handler: async (ctx, args) => {
    await requireInGroup(ctx, args.groupSlug, args.id)
    await ctx.db.delete(args.id)
  },
})
