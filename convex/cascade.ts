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
import { internalMutation } from './_generated/server'
import { deleteGroupContent } from './lib/groupCascade'
import { deleteStoredFile } from './lib/storedFiles'

/**
 * How many blobs one step releases.
 *
 * `deleteStoredFile` asks whether any row in any of five tables still points
 * at the blob before it goes, so each of these is five table scans. Twenty is
 * a hundred scans — comfortably inside a transaction, and small enough that a
 * household with hundreds of photos simply takes more steps rather than
 * failing.
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
      const files = await deleteGroupContent(ctx, next)
      if (files.length) {
        await ctx.scheduler.runAfter(0, internal.cascade.releaseFiles, {
          storageIds: files,
        })
      }
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
 * The diary and its combos are personal by design (ADR-0003) and are reached
 * by index. What is left in the Groups they shared is deliberately *not*
 * deleted: `createdBy` and its siblings are attribution and never conferred
 * access, so a dangling one costs nothing and the household keeps what it was
 * given. The two exceptions are handled here because they are not attribution
 * — a cost split naming somebody who is gone would go on allocating a share to
 * nobody.
 */
async function finishAccount(
  ctx: Parameters<typeof deleteGroupContent>[0],
  userId: Id<'users'>,
) {
  const combos = await ctx.db
    .query('combos')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .collect()
  for (const combo of combos) {
    const items = await ctx.db
      .query('comboItems')
      .withIndex('by_combo', (q) => q.eq('comboId', combo._id))
      .collect()
    for (const item of items) await ctx.db.delete(item._id)
    await ctx.db.delete(combo._id)
  }

  const entries = await ctx.db
    .query('consumptionEntries')
    .withIndex('by_user_date', (q) => q.eq('userId', userId))
    .collect()
  for (const entry of entries) await ctx.db.delete(entry._id)

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

/**
 * Take a departing member out of the two places a Group stores them as more
 * than a byline.
 *
 * A **cost split** is refused on save unless it adds to a hundred and names
 * only current members (`recurringCosts.validateSplit`), so a split with one
 * party missing is not a split the household could ever have agreed to, and it
 * is not this function's business to invent a new one. It is cleared, and the
 * cost goes back to being undivided until somebody says how it should be.
 *
 * A **saved split scenario** is the opposite: it is immutable on purpose and
 * already stores each party's name beside their id precisely so it keeps
 * reading after somebody leaves. So only the id goes.
 */
async function detachFromGroup(
  ctx: Parameters<typeof deleteGroupContent>[0],
  userId: Id<'users'>,
  groupId: Id<'groups'>,
) {
  const costs = await ctx.db
    .query('recurringCosts')
    .withIndex('by_group', (q) => q.eq('groupId', groupId))
    .collect()
  for (const cost of costs) {
    if (!cost.split?.some((share) => share.userId === userId)) continue
    await ctx.db.patch(cost._id, { split: undefined })
  }

  const scenarios = await ctx.db
    .query('splitScenarios')
    .withIndex('by_group', (q) => q.eq('groupId', groupId))
    .collect()
  for (const scenario of scenarios) {
    const anonymise = <P extends { userId?: Id<'users'>; name: string }>(
      party: P,
    ): P => (party.userId === userId ? { ...party, userId: undefined } : party)
    const names = [
      ...scenario.payments.map((p) => p.party),
      ...scenario.participants,
      ...scenario.owed.map((o) => o.party),
      ...scenario.transfers.flatMap((t) => [t.from, t.to]),
    ]
    if (!names.some((party) => party.userId === userId)) continue
    await ctx.db.patch(scenario._id, {
      payments: scenario.payments.map((p) => ({
        ...p,
        party: anonymise(p.party),
      })),
      participants: scenario.participants.map(anonymise),
      owed: scenario.owed.map((o) => ({ ...o, party: anonymise(o.party) })),
      transfers: scenario.transfers.map((t) => ({
        ...t,
        from: anonymise(t.from),
        to: anonymise(t.to),
      })),
    })
  }
}
