/**
 * Deleting a person's paired watches (`watchDevices`, APP-653). Revoking is
 * deleting: the key is looked up by its hash, so without the row it opens
 * nothing.
 */
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'

/** Delete this person's watches, all of them or the ones that match. */
export async function deleteWatchDevices(
  ctx: MutationCtx,
  userId: Id<'users'>,
  matches: (device: Doc<'watchDevices'>) => boolean = () => true,
): Promise<number> {
  const devices = await ctx.db
    .query('watchDevices')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .collect()
  const gone = devices.filter(matches)
  for (const device of gone) await ctx.db.delete(device._id)
  return gone.length
}
