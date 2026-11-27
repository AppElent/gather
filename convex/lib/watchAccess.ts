/**
 * Who a watch's key speaks for (APP-653). The key stands for the Member who
 * paired the watch, in the one Group it was paired with, and nothing more.
 * Every read and every write resolves it here, in its own transaction, so a
 * revoked key, an account on its way out or a Membership that ended stops the
 * very next call.
 *
 * Refusals are answered rather than thrown: the HTTP action turns them into a
 * status and a keyed body (`watchHttp.ts`).
 */
import type { Doc } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { isGroceryList } from './groceryCategories'
import { writableGroceryList } from './groceryStaples'
import { type GroupRefusal, getMembership } from './groupAccess'

export interface WatchCaller {
  device: Doc<'watchDevices'>
  user: Doc<'users'>
  group: Doc<'groups'>
  membership: Doc<'memberships'>
}

export type WatchGroupRefusal = Extract<
  GroupRefusal,
  'not-signed-in' | 'not-a-member'
>

export async function resolveWatch(
  ctx: QueryCtx,
  keyHash: string,
): Promise<
  ({ ok: true } & WatchCaller) | { ok: false; reason: WatchGroupRefusal }
> {
  const device = await ctx.db
    .query('watchDevices')
    .withIndex('by_key_hash', (q) => q.eq('keyHash', keyHash))
    .unique()
  const user = device && (await ctx.db.get(device.userId))
  // An account being deleted is signed out everywhere, its watches included.
  if (!device || !user || user.deletedAt)
    return { ok: false, reason: 'not-signed-in' }
  const group = await ctx.db.get(device.groupId)
  const membership =
    group && (await getMembership(ctx, device.groupId, user._id))
  if (!group || !membership) return { ok: false, reason: 'not-a-member' }
  return { ok: true, device, user, group, membership }
}

/**
 * The grocery list this watch shows and adds to: its own, else the Group's. A
 * watch's list can be deleted or made another kind elsewhere; then it is the
 * Group's again. Null when Gather has no list it can write to.
 */
export async function watchGroceryList(
  ctx: QueryCtx,
  { device, group }: WatchCaller,
): Promise<Doc<'taskLists'> | null> {
  if (device.groceryListId) {
    const own = await ctx.db.get(device.groceryListId)
    if (own && isWatchGroceryList(group, own)) return own
  }
  return await writableGroceryList(ctx, group)
}

/** A grocery list of this Group that Gather keeps itself. */
export function isWatchGroceryList(
  group: Doc<'groups'>,
  list: Doc<'taskLists'>,
): boolean {
  return (
    list.groupId === group._id &&
    list.provider === 'local' &&
    isGroceryList(group, list)
  )
}
