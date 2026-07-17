import { ConvexError } from 'convex/values'
import type { Id } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { getCurrentUser, getMyGroupIds } from './sharing'

/** Resolve the caller and the list, asserting group membership. */
export async function requireListAccess(
  ctx: QueryCtx,
  listId: Id<'taskLists'>,
) {
  const user = await getCurrentUser(ctx)
  if (!user) throw new ConvexError('Not authenticated')
  const list = await ctx.db.get(listId)
  if (!list) throw new ConvexError('List not found')
  const groupIds = await getMyGroupIds(ctx, user._id)
  if (!groupIds.includes(list.groupId)) {
    throw new ConvexError('Not a member of this group')
  }
  return { user, list }
}
