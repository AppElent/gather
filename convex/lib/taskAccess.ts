/**
 * Authorising a request about one task list, from the Group the caller is
 * claiming.
 *
 * This used to ask "is this list in *any* Group I am in", which is the
 * caller-wide shape ADR-0002 removes: it answers from the caller's memberships
 * rather than from the address they asked for, so a housemate in two households
 * could reach one household's list under the other household's address, and
 * every write behind that address went through the same check. The Group now
 * comes in with the request and the list must live in *that* one.
 *
 * Two entry points over one implementation, mirroring `babyAccess`:
 *
 * - `findListInGroup` returns null, for callers that render "not found".
 * - `requireListAccess` throws, for everything that has nothing to render.
 *
 * Either way, "no such list" and "not in this Group" are the same answer on
 * purpose, so neither can be used to find out that a list exists somewhere.
 * Not being a Member of the Group in the URL is *not* folded in with them — it
 * is refused by `requireGroupBySlug` first, and stays a distinct refusal.
 */

import { ConvexError } from 'convex/values'
import type { Id } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { requireGroupBySlug } from './groupAccess'

/**
 * The caller, the Group they named, and the list — or null when that list does
 * not live in that Group. Throws only when the *Group* is refused.
 */
export async function findListInGroup(
  ctx: QueryCtx,
  groupSlug: string,
  listId: Id<'taskLists'>,
) {
  const { user, group } = await requireGroupBySlug(ctx, groupSlug)
  const list = await ctx.db.get(listId)
  if (!list || list.groupId !== group._id) return null
  return { user, group, list }
}

/** As `findListInGroup`, but a list outside the named Group is a refusal. */
export async function requireListAccess(
  ctx: QueryCtx,
  groupSlug: string,
  listId: Id<'taskLists'>,
) {
  const found = await findListInGroup(ctx, groupSlug, listId)
  if (!found) throw new ConvexError('List not found')
  return found
}
