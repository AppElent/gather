import { ConvexError } from 'convex/values'
import type { Id } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { getCurrentUser, getMyGroupIds } from './sharing'

/** Resolve the caller and the list, asserting membership of whichever scope
 * owns it — a Space for module-owned lists (Baby log checklists), or a group
 * for the Tasks module's own lists. */
export async function requireListAccess(
  ctx: QueryCtx,
  listId: Id<'taskLists'>,
) {
  const user = await getCurrentUser(ctx)
  if (!user) throw new ConvexError('Not authenticated')
  const list = await ctx.db.get(listId)
  if (!list) throw new ConvexError('List not found')

  if (list.spaceId) {
    const spaceId = list.spaceId
    const membership = await ctx.db
      .query('spaceMemberships')
      .withIndex('by_space_user', (q) =>
        q.eq('spaceId', spaceId).eq('userId', user._id),
      )
      .unique()
    if (!membership) throw new ConvexError('Not a member of this Space')
    return { user, list }
  }

  const groupIds = await getMyGroupIds(ctx, user._id)
  if (!list.groupId || !groupIds.includes(list.groupId)) {
    throw new ConvexError('Not a member of this group')
  }
  return { user, list }
}
