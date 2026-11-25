/**
 * The scheduled half of destroying things.
 *
 * Jobs that cannot run inside the mutation that starts them, all for the same
 * reason: a Convex mutation is one bounded transaction, and none of these has
 * a bound a person's household is guaranteed to fit inside.
 *
 * None is callable from a client. Every entry point into them has already
 * resolved who is asking and refused whoever may not — nothing here re-checks,
 * because nothing here has anyone to check against by the time it runs.
 */

import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { internalMutation } from './_generated/server'
import { writePauseMs } from './lib/energyWritePace'
import { destroyGroup, detachFromGroup, purgeGroupPage } from './lib/groupCascade'
import { deletePushData } from './lib/notifications'
import { deleteStoredFile } from './lib/storedFiles'
import { deleteWatchDevices } from './lib/watchDevices'

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

/** Interval, reading and account price rows one step deletes. */
const ENERGY_ROWS_PER_STEP = 1000

/**
 * Delete a destroyed Group's hourly usage or typed readings, a page per step:
 * a year of hours for seven channels is some 61,000 rows, which no single
 * transaction holds (APP-495).
 */
export const purgeEnergyRows = internalMutation({
  args: {
    groupId: v.id('groups'),
    table: v.union(v.literal('energyIntervals'), v.literal('energyReadings')),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query(args.table)
      .withIndex('by_group', (q) => q.eq('groupId', args.groupId))
      .take(ENERGY_ROWS_PER_STEP)
    for (const row of rows) await ctx.db.delete(row._id)
    if (rows.length === ENERGY_ROWS_PER_STEP) {
      await ctx.scheduler.runAfter(
        writePauseMs(rows.length),
        internal.cascade.purgeEnergyRows,
        args,
      )
    }
  },
})

/** Delete the rest of a destroyed Group's rows, a page per step (APP-842). */
export const purgeGroup = internalMutation({
  args: {
    groupId: v.id('groups'),
    storageIds: v.array(v.id('_storage')),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await purgeGroupPage(ctx, args.groupId, args.storageIds)
    return null
  },
})

/**
 * Nothing schedules this any more: it finishes the steps a Group deleted before
 * APP-842 was deployed still had queued (docs/migrations/README.md).
 */
export const purgeNotes = internalMutation({
  args: { groupId: v.id('groups') },
  returns: v.null(),
  handler: async (ctx, args) => {
    await purgeGroupPage(ctx, args.groupId, [])
    return null
  },
})

/** Delete the account prices of a feed that is gone, a page per step. */
export const purgeAccountPrices = internalMutation({
  args: { feedId: v.id('energyPriceFeeds') },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('energyPrices')
      .withIndex('by_feed_carrier_start', (q) => q.eq('feedId', args.feedId))
      .take(ENERGY_ROWS_PER_STEP)
    for (const row of rows) await ctx.db.delete(row._id)
    if (rows.length === ENERGY_ROWS_PER_STEP) {
      await ctx.scheduler.runAfter(
        writePauseMs(rows.length),
        internal.cascade.purgeAccountPrices,
        args,
      )
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
 * The AI usage counter, retry receipts, push phones and queued push
 * notifications belong to the person rather than to a Group and are reached
 * by index. What is left in the Groups they shared is deliberately
 * *not* deleted: `createdBy` and its siblings are attribution and never conferred
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
  const receipts = await ctx.db
    .query('idempotencyKeys')
    .withIndex('by_user_and_key', (q) => q.eq('userId', userId))
    .collect()
  for (const row of receipts) await ctx.db.delete(row._id)
  // Their phones and queued push notifications (APP-298).
  await deletePushData(ctx, userId)
  // Their watches' keys (APP-653).
  await deleteWatchDevices(ctx, userId)

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
