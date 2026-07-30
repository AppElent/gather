/**
 * The one place a Group-scoped request is authorised.
 *
 * ADR-0002 puts the Group in the URL so that membership is checked once, at the
 * route boundary, instead of every function re-deriving "the active Group" from
 * hidden state on the user. This module is that check. Every Group-scoped query
 * and mutation resolves its Group through here, from the slug the caller asked
 * for — never from a stored default, and never falling back to a Group the
 * caller happens to belong to. A refusal is a refusal.
 *
 * Two entry points over one implementation:
 *
 * - `resolveGroupBySlug` returns a discriminated result, for callers that want
 *   to render "no such group" differently from "not yours".
 * - `requireGroupBySlug` throws, for callers that have nothing sensible to
 *   render either way.
 */

import type { Doc, Id } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { getCurrentUser } from './sharing'

/** A Member's standing in a Group. */
export type GroupRole = Doc<'memberships'>['role']

/**
 * Why a Group could not be resolved.
 *
 * These stay distinct all the way to the UI. Collapsing "no such group" into
 * "not yours" would tell a stranger that a slug exists; collapsing the other
 * way would show a member of nothing a permission error for a typo.
 */
export type GroupRefusal = 'not-signed-in' | 'unknown-slug' | 'not-a-member'

export interface ResolvedGroup {
  user: Doc<'users'>
  group: Doc<'groups'>
  membership: Doc<'memberships'>
  role: GroupRole
}

export type GroupResolution =
  | ({ ok: true } & ResolvedGroup)
  | { ok: false; reason: GroupRefusal }

/**
 * The message `requireGroupBySlug` throws for each refusal. Exported so that a
 * caller — or a test — can tell the cases apart by something more stable than
 * prose, and so the two never drift into the same string.
 */
export const GROUP_REFUSAL_MESSAGES: Record<GroupRefusal, string> = {
  'not-signed-in': 'Not authenticated',
  'unknown-slug': 'No group has that slug',
  'not-a-member': 'Not a member of that group',
}

/** The given user's membership of a Group, or null when they are not in it. */
export async function getMembership(
  ctx: QueryCtx,
  groupId: Id<'groups'>,
  userId: Id<'users'>,
): Promise<Doc<'memberships'> | null> {
  return await ctx.db
    .query('memberships')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .filter((q) => q.eq(q.field('groupId'), groupId))
    .unique()
}

/**
 * Resolve `(caller, slug)` to a Group and the caller's standing in it, or say
 * precisely why not.
 *
 * The checks run in this order on purpose: an unknown slug is reported as
 * unknown to everybody, so that "does this Group exist?" and "am I allowed in?"
 * are answered by two different states rather than one ambiguous one.
 */
export async function resolveGroupBySlug(
  ctx: QueryCtx,
  slug: string,
): Promise<GroupResolution> {
  const user = await getCurrentUser(ctx)
  if (!user) return { ok: false, reason: 'not-signed-in' }

  const group = await ctx.db
    .query('groups')
    .withIndex('by_slug', (q) => q.eq('slug', slug))
    .unique()
  if (!group) return { ok: false, reason: 'unknown-slug' }

  const membership = await getMembership(ctx, group._id, user._id)
  if (!membership) return { ok: false, reason: 'not-a-member' }

  return { ok: true, user, group, membership, role: membership.role }
}

/**
 * Resolve `(caller, slug)` or throw. `MutationCtx` satisfies `QueryCtx`, so
 * mutations authorise through this too.
 */
export async function requireGroupBySlug(
  ctx: QueryCtx,
  slug: string,
): Promise<ResolvedGroup> {
  const resolution = await resolveGroupBySlug(ctx, slug)
  if (!resolution.ok) throw new Error(GROUP_REFUSAL_MESSAGES[resolution.reason])
  const { user, group, membership, role } = resolution
  return { user, group, membership, role }
}
