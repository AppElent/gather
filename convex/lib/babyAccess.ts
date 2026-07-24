import { ConvexError } from 'convex/values'
import type { Id } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { getCurrentUser, getMyGroupIds } from './sharing'

/** Resolve the caller and the baby, asserting group membership. */
export async function requireBabyAccess(ctx: QueryCtx, babyId: Id<'babies'>) {
  const user = await getCurrentUser(ctx)
  if (!user) throw new ConvexError('Not authenticated')
  const baby = await ctx.db.get(babyId)
  if (!baby) throw new ConvexError('Baby not found')
  const groupIds = await getMyGroupIds(ctx, user._id)
  if (!groupIds.includes(baby.groupId)) {
    throw new ConvexError('Not a member of this group')
  }
  return { user, baby }
}
