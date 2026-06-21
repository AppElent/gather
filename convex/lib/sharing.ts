import type { Id } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'

export interface Viewer<U = string, G = string> {
  userId: U
  groupIds: G[]
}

export interface ShareableRecord<U = string, G = string> {
  ownerId: U
  sharedGroupIds: G[]
}

export function isVisibleTo<U, G>(
  record: ShareableRecord<U, G>,
  viewer: Viewer<U, G>,
): boolean {
  if (record.ownerId === viewer.userId) return true
  return record.sharedGroupIds.some((g) => viewer.groupIds.includes(g))
}

/** Resolve the calling Clerk user to their gather `users` row, or null. */
export async function getCurrentUser(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) return null
  return await ctx.db
    .query('users')
    .withIndex('by_clerkId', (q) => q.eq('clerkId', identity.subject))
    .unique()
}

/** Group ids the given user belongs to. */
export async function getMyGroupIds(
  ctx: QueryCtx,
  userId: Id<'users'>,
): Promise<Id<'groups'>[]> {
  const memberships = await ctx.db
    .query('memberships')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .collect()
  return memberships.map((m) => m.groupId)
}
