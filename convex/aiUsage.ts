import { ConvexError, v } from 'convex/values'
import { internalMutation, type MutationCtx } from './_generated/server'
import { DAILY_AI_CALLS, utcDay } from './lib/aiUsage'
import { getUserByClerkId, NOT_SIGNED_IN } from './lib/sharing'

/**
 * Count one AI call against today, or refuse it.
 *
 * One mutation reads the counter and writes it, so two calls racing for the
 * last slot cannot both get it. Not callable from a client: the actions that
 * reach a provider are the only callers, and they have already resolved who is
 * asking.
 */
export const take = internalMutation({
  args: { clerkId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => (await takeOne(ctx, args.clerkId)) !== null,
})

/**
 * As `take`, answering how many calls today has used with this one, or null
 * when it was refused: the grocery sheet says "1 of your 30 today" (APP-312).
 */
export const takeCounted = internalMutation({
  args: { clerkId: v.string() },
  returns: v.union(v.number(), v.null()),
  handler: async (ctx, args) => await takeOne(ctx, args.clerkId),
})

async function takeOne(
  ctx: MutationCtx,
  clerkId: string,
): Promise<number | null> {
  const user = await getUserByClerkId(ctx, clerkId)
  if (!user) throw new ConvexError(NOT_SIGNED_IN)

  const day = utcDay(Date.now())
  const row = await ctx.db
    .query('aiUsage')
    .withIndex('by_user_and_day', (q) =>
      q.eq('userId', user._id).eq('day', day),
    )
    .unique()
  if (row && row.count >= DAILY_AI_CALLS) return null

  if (row) await ctx.db.patch(row._id, { count: row.count + 1 })
  else await ctx.db.insert('aiUsage', { userId: user._id, day, count: 1 })
  return (row?.count ?? 0) + 1
}
