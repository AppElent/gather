/**
 * The scheduled half of destroying things.
 *
 * Two jobs that cannot run inside the mutation that starts them, for the same
 * reason in both cases: a Convex mutation is one bounded transaction, and
 * neither of these has a bound a person's household is guaranteed to fit
 * inside.
 *
 * Neither is callable from a client. Every entry point into them has already
 * resolved who is asking and refused whoever may not — nothing here re-checks,
 * because nothing here has anyone to check against by the time it runs.
 */

import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { internalMutation } from './_generated/server'
import { destroyGroup, detachFromGroup } from './lib/groupCascade'
import { deleteStoredFile } from './lib/storedFiles'

/**
 * How many blobs one step releases.
 *
 * `deleteStoredFile` asks whether any row in any photo-holding table still
 * points at the blob before it goes, so each of these scans all of those tables.
 * Twenty stays comfortably inside a transaction, and a household with hundreds
 * of photos simply takes more steps rather than failing.
 */
const FILES_PER_STEP = 20

export const releaseFiles = internalMutation({
  args: { storageIds: v.array(v.id('_storage')) },
  handler: async (ctx, args) => {
    const batch = args.storageIds.slice(0, FILES_PER_STEP)
    const rest = args.storageIds.slice(FILES_PER_STEP)
    for (const id of batch) await deleteStoredFile(ctx, id)
    if (rest.length) {
      await ctx.scheduler.runAfter(0, internal.cascade.releaseFiles, {
        storageIds: rest,
      })
    }
  },
})

/**
 * Delete a person's account, one Group per step, then the person.
 *
 * The order is the whole design. Their Groups go first — one per invocation,
 * so no single household can be too large — and the `users` row goes *last*,
 * because `users.deletedAt` is the only thing stopping `ensureUser` from
 * handing the account back while the purge is still running.
 *
 * `groupIds` are the Groups they were the only member of. A Group with other
 * people in it is not theirs to destroy: they are removed from it further
 * down, and what they added stays, which is the promise `leaveGroup` already
 * makes.
 */
export const purgeAccount = internalMutation({
  args: {
    userId: v.id('users'),
    groupIds: v.array(v.id('groups')),
  },
  handler: async (ctx, args) => {
    const [next, ...rest] = args.groupIds
    if (next) {
      await destroyGroup(ctx, next)
      await ctx.scheduler.runAfter(0, internal.cascade.purgeAccount, {
        userId: args.userId,
        groupIds: rest,
      })
      return
    }

    await finishAccount(ctx, args.userId)
  },
})

/**
 * Everything of theirs that is not a Group's, and then the row itself.
 *
 * The AI usage counter is personal by design and is reached by index. What is left in the Groups they shared
 * is deliberately *not* deleted: `createdBy` and its siblings are attribution and never conferred
 * access, so a dangling one costs nothing and the household keeps what it was
 * given. The two exceptions are handled here because they are not attribution
 * — a cost split naming somebody who is gone would go on allocating a share to
 * nobody.
 */
async function finishAccount(
  ctx: MutationCtx,
  userId: Id<'users'>,
) {
  const usage = await ctx.db
    .query('aiUsage')
    .withIndex('by_user_and_day', (q) => q.eq('userId', userId))
    .collect()
  for (const row of usage) await ctx.db.delete(row._id)

  // Whatever memberships are left are the shared Groups — the solo ones went
  // with their Group.
  const memberships = await ctx.db
    .query('memberships')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .collect()
  for (const membership of memberships) {
    await detachFromGroup(ctx, userId, membership.groupId)
    await ctx.db.delete(membership._id)
  }

  await ctx.db.delete(userId)
}
