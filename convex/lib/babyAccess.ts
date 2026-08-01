/**
 * Authorising a request about one child, from the Group the caller is claiming.
 *
 * This used to ask "is this baby in *any* Group I am in", which is the
 * caller-wide shape ADR-0002 removes: it answers from the caller's memberships
 * rather than from the address they asked for, so `/g/other-household/baby/<id>`
 * succeeded whenever the reader happened to share *some* Group with that child.
 * The Group now comes in with the request and the child must live in *that* one.
 *
 * Two entry points over one implementation, mirroring `groupAccess`:
 *
 * - `findBabyInGroup` returns null, for `babies.get`, which renders "not found".
 * - `requireBabyAccess` throws, for everything that has nothing to render.
 *
 * Either way, "no such child" and "not in this Group" are the same answer on
 * purpose, so neither can be used to find out that a child exists somewhere.
 * Not being a Member of the Group in the URL is *not* folded in with them — it
 * is refused by `requireGroupBySlug` first, and stays a distinct refusal.
 */

import { ConvexError } from 'convex/values'
import type { Id } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { requireGroupBySlug } from './groupAccess'

/**
 * The caller, the Group they named, and the child — or null when that child
 * does not live in that Group. Throws only when the *Group* is refused.
 */
export async function findBabyInGroup(
  ctx: QueryCtx,
  groupSlug: string,
  babyId: Id<'babies'>,
) {
  const { user, group } = await requireGroupBySlug(ctx, groupSlug)
  const baby = await ctx.db.get(babyId)
  if (!baby || baby.groupId !== group._id) return null
  return { user, group, baby }
}

/** As `findBabyInGroup`, but a child outside the named Group is a refusal. */
export async function requireBabyAccess(
  ctx: QueryCtx,
  groupSlug: string,
  babyId: Id<'babies'>,
) {
  const found = await findBabyInGroup(ctx, groupSlug, babyId)
  if (!found) throw new ConvexError('Baby not found')
  return found
}
