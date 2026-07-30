import type { Doc, Id } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'

/**
 * Pick the row standing for a Clerk subject when the table holds more than one.
 *
 * Duplicates are a data bug — repair them with `maintenance.mergeDuplicateUsers`
 * — but they must never take the app down. This replaced a `.unique()`, which
 * throws on a second match; since every viewer-scoped query resolves through
 * here, one duplicated row 500'd the whole app rather than just that account.
 * Oldest wins, so the choice stays stable across calls.
 */
export function pickCanonicalUser<T extends { _creationTime: number }>(
  rows: T[],
): T | null {
  let canonical: T | null = null
  for (const row of rows) {
    if (!canonical || row._creationTime < canonical._creationTime) {
      canonical = row
    }
  }
  return canonical
}

/** Resolve a Clerk subject to their gather `users` row, or null. */
export async function getUserByClerkId(
  ctx: QueryCtx,
  clerkId: string,
): Promise<Doc<'users'> | null> {
  const matches = await ctx.db
    .query('users')
    .withIndex('by_clerkId', (q) => q.eq('clerkId', clerkId))
    .collect()
  return pickCanonicalUser(matches)
}

/** Resolve the calling Clerk user to their gather `users` row, or null. */
export async function getCurrentUser(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) return null
  return await getUserByClerkId(ctx, identity.subject)
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
