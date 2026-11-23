import { groupRefusal } from '@gather/core/refusals'
import { ConvexError } from 'convex/values'
import type { Doc, Id } from '../_generated/dataModel'
import type { ActionCtx, QueryCtx } from '../_generated/server'
import { getGatedIdentity } from './connectedApps'

/**
 * The sentence a signed-out caller was refused with before the refusal was
 * keyed. It rides along as the keyed refusal's `message`. Only the account
 * portal's `portalCaller` still throws it bare, because the portal client
 * matches the string (APP-620).
 */
export const NOT_SIGNED_IN = 'Not authenticated'

/**
 * The keyed refusal for a signed-out caller (APP-581):
 * `{ kind: 'groups:not-signed-in', message: 'Not authenticated' }`, the same
 * one `groupAccess` throws, so web, phone and MCP read every sign-in refusal
 * one way. Never compare against the message: read the kind.
 */
export function notSignedInError(): ConvexError<{
  kind: string
  message: string
}> {
  return new ConvexError(groupRefusal('not-signed-in', NOT_SIGNED_IN))
}

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
  // Gated: a connected app without the write scope is refused in a mutation.
  const identity = await getGatedIdentity(ctx)
  if (!identity) return null
  return await getUserByClerkId(ctx, identity.subject)
}

/**
 * The Clerk identity behind the call, or a refusal. For actions, which have no
 * database to resolve it against, and for provisioning the `users` row itself.
 */
export async function requireIdentity(ctx: Pick<ActionCtx, 'auth'>) {
  const identity = await getGatedIdentity(ctx)
  if (!identity) throw notSignedInError()
  return identity
}

/** The calling Clerk user's `users` row, or a refusal. */
export async function requireCurrentUser(ctx: QueryCtx) {
  const user = await getCurrentUser(ctx)
  if (!user) throw notSignedInError()
  return user
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

