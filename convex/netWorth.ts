/**
 * What the household owns and owes, and the dated snapshots it chose to keep.
 *
 * Three of the rows on the current view are **derived** rather than asked for
 * again — the House's value, that House's mortgage balance, and the Portfolio's
 * calculated value (ADR-0025). Those are assembled on the client from the same
 * seam that draws them elsewhere; what this file stores is the rest, plus the
 * snapshots.
 *
 * A snapshot is only ever explicit. There is no background valuation and no
 * scheduled history, and a snapshot is never edited afterwards: it freezes the
 * derived rows too, including the moment the prices came from. So `take` sends
 * the rows the screen was showing rather than recomputing them here — a
 * snapshot that recalculated on read would be a record of nothing.
 */

import { v } from 'convex/values'

import { mutation, query } from './_generated/server'
import {
  netWorthKindValidator,
  netWorthRowValidator,
  requireAmount,
  requireName,
} from './lib/finance'
import { requireGroupBySlug } from './lib/groupAccess'
import { nextOrder } from './lib/order'

export const entries = query({
  args: { groupSlug: v.string() },
  handler: async (ctx, args) => {
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    const rows = await ctx.db
      .query('netWorthEntries')
      .withIndex('by_group', (q) => q.eq('groupId', group._id))
      .collect()
    return rows.sort((a, b) => a.order - b.order)
  },
})

export const snapshots = query({
  args: { groupSlug: v.string() },
  handler: async (ctx, args) => {
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    const rows = await ctx.db
      .query('netWorthSnapshots')
      .withIndex('by_group', (q) => q.eq('groupId', group._id))
      .collect()
    return await Promise.all(
      rows
        .sort((a, b) => b.takenAt - a.takenAt)
        .map(async (snapshot) => ({
          ...snapshot,
          takenByName: (await ctx.db.get(snapshot.takenByUserId))?.name ?? null,
        })),
    )
  },
})

export const addEntry = mutation({
  args: {
    groupSlug: v.string(),
    kind: netWorthKindValidator,
    label: v.string(),
    amountCents: v.number(),
  },
  handler: async (ctx, args) => {
    const { group, user } = await requireGroupBySlug(ctx, args.groupSlug)
    const existing = await ctx.db
      .query('netWorthEntries')
      .withIndex('by_group', (q) => q.eq('groupId', group._id))
      .collect()
    return await ctx.db.insert('netWorthEntries', {
      groupId: group._id,
      createdByUserId: user._id,
      kind: args.kind,
      label: requireName(args.label),
      amountCents: requireAmount(args.amountCents),
      order: nextOrder(existing),
    })
  },
})

/**
 * Freeze today.
 *
 * The rows come in from the screen, derived ones included, and the totals are
 * recomputed from those rows so a snapshot can never disagree with itself.
 */
export const take = mutation({
  args: {
    groupSlug: v.string(),
    takenOn: v.string(),
    rows: v.array(netWorthRowValidator),
  },
  handler: async (ctx, args) => {
    const { group, user } = await requireGroupBySlug(ctx, args.groupSlug)
    const assets = args.rows
      .filter((row) => row.kind === 'asset')
      .reduce((sum, row) => sum + row.amountCents, 0)
    const liabilities = args.rows
      .filter((row) => row.kind === 'liability')
      .reduce((sum, row) => sum + row.amountCents, 0)
    return await ctx.db.insert('netWorthSnapshots', {
      groupId: group._id,
      takenByUserId: user._id,
      takenOn: args.takenOn,
      takenAt: Date.now(),
      rows: args.rows,
      assetsCents: assets,
      liabilitiesCents: liabilities,
      netCents: assets - liabilities,
    })
  },
})
