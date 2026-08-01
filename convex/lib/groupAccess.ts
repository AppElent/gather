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
 * Group-scoped content as the visibility rule sees it: it lives in one Group
 * and may additionally be shared into others (ADR-0003).
 *
 * Generic over the id type so the rule can be exercised as a rule, without a
 * database behind it. Every caller in the app passes `Id<'groups'>`.
 */
export interface GroupScopedContent<G = Id<'groups'>> {
  /** The home Group. Where the content lives; changed only by a *move*. */
  groupId: G
  /** The further Groups it is visible in. Never contains `groupId`. */
  sharedGroupIds: readonly G[]
}

/**
 * The one visibility rule for Group-scoped content: the caller is a Member of
 * its home Group, or of any Group in its shared list.
 *
 * Who created the content does not appear here, and that is the point.
 * Attribution records *who*; it never confers ownership or access, so the
 * person who added a recipe stops seeing it the moment they leave its Group,
 * exactly like anybody else who was never in it.
 */
export function isVisibleToGroups<G>(
  content: GroupScopedContent<G>,
  viewerGroupIds: readonly G[],
): boolean {
  if (viewerGroupIds.includes(content.groupId)) return true
  return content.sharedGroupIds.some((id) => viewerGroupIds.includes(id))
}

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

/**
 * The Group a slug names, or null — asking nothing at all about the caller.
 *
 * Almost nothing should want this: authorising a request is what
 * `resolveGroupBySlug` is for, and reaching for the unauthorised form is how a
 * Group-scoped query quietly stops checking membership. It exists for the one
 * shape that legitimately has no membership to check — undoing a Share into a
 * Group the caller has since left — where authorisation has already been done
 * against the *content*, not against the Group being named.
 */
export async function getGroupBySlug(
  ctx: QueryCtx,
  slug: string,
): Promise<Doc<'groups'> | null> {
  return await ctx.db
    .query('groups')
    .withIndex('by_slug', (q) => q.eq('slug', slug))
    .unique()
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

  const group = await getGroupBySlug(ctx, slug)
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

/**
 * Which Group a Group-scoped function is being asked about, during the window
 * where both route trees exist.
 *
 * Given a slug — which only a `/g/<slug>/…` route supplies — that Group and no
 * other, authorised here and refused if the caller is not a Member of it.
 * Given none, the caller's `defaultGroupId`: the pre-ADR-0002 answer, kept
 * exactly as it was so that every flat route goes on behaving as before.
 *
 * The fallback is the thing this rebuild is removing, not a design. It survives
 * only as long as the flat routes do; #24 deletes both together, and this
 * function collapses into `requireGroupBySlug` when it goes.
 *
 * `null` means "no default group", which the slug branch can never return —
 * it has already thrown by then.
 */
export async function groupIdFromSlugOrDefault(
  ctx: QueryCtx,
  groupSlug: string | undefined,
): Promise<Id<'groups'> | null> {
  if (groupSlug !== undefined) {
    const { group } = await requireGroupBySlug(ctx, groupSlug)
    return group._id
  }
  const user = await getCurrentUser(ctx)
  return user?.defaultGroupId ?? null
}
