/**
 * Deleting your own account, from inside the app.
 *
 * Gather creates Clerk accounts on the phone, and App Store guideline 5.1.1(v)
 * says an app that does that must let a person delete one without leaving it.
 * Pointing at the web is the pattern that gets rejected.
 *
 * ## What "and all my data" means here
 *
 * Every user-owned record in Gather belongs to exactly one Group (ADR-0030),
 * so the question is only ever about Groups, and it has two answers:
 *
 * - **A Group you are the only member of dies with you**, and everything in it
 *   goes — recipes, lists, the baby's log, the household's finances.
 * - **A Group you share, you simply leave.** What you added stays with the
 *   household, which is exactly what leaving a Group already promises today.
 *   Anything else would let one person delete a shared history on their way
 *   out.
 *
 * ## Convex first, Clerk second
 *
 * The purge needs an authenticated caller, and there is no authenticated
 * caller once the Clerk user is gone — so the order cannot be the other way
 * round. The gap that opens is that `ensureUser` runs on every app mount and
 * would re-provision a fresh account into it; `users.deletedAt` is set here in
 * the first transaction and closes it.
 *
 * The client checks `deleteSelfEnabled` before calling any of this. Purging
 * somebody's household for an account Clerk then refuses to delete would be
 * the worst outcome available.
 */

import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'
import { action, mutation, query } from './_generated/server'
import {
  appleCredentials,
  isAppleClientId,
  revokeAppleAuthorization,
} from './lib/appleSignIn'
import { getGatedIdentity, rejectConnectedApps } from './lib/connectedApps'
import {
  getCurrentUser,
  getMyGroupIds,
  NOT_SIGNED_IN,
  requireCurrentUser,
} from './lib/sharing'

/** The Groups they are in, split by whether anybody else is in them. */
async function partitionGroups(ctx: QueryCtx, userId: Id<'users'>) {
  const ids = await getMyGroupIds(ctx, userId)
  const solo: Id<'groups'>[] = []
  const shared: Id<'groups'>[] = []
  for (const id of ids) {
    const members = await ctx.db
      .query('memberships')
      .withIndex('by_group', (q) => q.eq('groupId', id))
      .collect()
    ;(members.length > 1 ? shared : solo).push(id)
  }
  return { solo, shared }
}

async function namesOf(ctx: QueryCtx, ids: Id<'groups'>[]) {
  const groups = await Promise.all(ids.map((id) => ctx.db.get(id)))
  return groups.filter((g) => g !== null).map((g) => g.name)
}

/**
 * What deleting this account is about to do, in Group names.
 *
 * The screen says it before the confirmation rather than inside it: an alert
 * is the wrong place to read a list, and "everything in them" means nothing
 * until you can see which households it is talking about.
 */
export const deletionPreview = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    if (!user) return null
    const { solo, shared } = await partitionGroups(ctx, user._id)
    return {
      email: user.email,
      deleted: await namesOf(ctx, solo),
      kept: await namesOf(ctx, shared),
    }
  },
})

/**
 * Start the purge. Nothing here takes a user id — the caller is whoever the
 * token says they are, as everywhere else.
 *
 * It returns once the account is marked and the work is scheduled, so the
 * client can go on to delete the Clerk user immediately. The rest runs in
 * bounded steps behind it (`cascade.purgeAccount`).
 */
export const deleteAccount = mutation({
  args: {},
  handler: async (ctx) => {
    // Deleting the account stays in the app (ADR-0046).
    await rejectConnectedApps(ctx)
    const user = await requireCurrentUser(ctx)
    if (user.deletedAt) return

    const { solo } = await partitionGroups(ctx, user._id)
    await ctx.db.patch(user._id, { deletedAt: Date.now() })
    await ctx.scheduler.runAfter(0, internal.cascade.purgeAccount, {
      userId: user._id,
      groupIds: solo,
    })
  },
})

/** Apple authorization codes are opaque strings of a few hundred characters. */
const MAX_AUTHORIZATION_CODE = 2000

/** The stable messages `revokeAppleSignIn` fails with. */
export const APPLE_REVOCATION = {
  invalidCode: 'Invalid Apple authorization code',
  invalidBundleId: 'Not a Gather build',
  unavailable: 'Apple revocation is not configured',
  failed: 'Apple revocation failed',
} as const

/**
 * Revoke the signed-in account's Sign in with Apple grant, just before the
 * account is deleted (`lib/appleSignIn.ts`). The code comes from a fresh
 * native Apple sheet on iOS, with the bundle ID of the build that showed it.
 * Every failure is one stable message; the phone still deletes the account,
 * so Apple can never block a deletion.
 */
export const revokeAppleSignIn = action({
  args: { authorizationCode: v.string(), bundleId: v.string() },
  handler: async (ctx, { authorizationCode, bundleId }) => {
    // Deleting the account stays in the app (ADR-0046).
    await rejectConnectedApps(ctx)
    if (!(await getGatedIdentity(ctx))) throw new ConvexError(NOT_SIGNED_IN)
    if (!authorizationCode || authorizationCode.length > MAX_AUTHORIZATION_CODE)
      throw new ConvexError(APPLE_REVOCATION.invalidCode)
    if (!isAppleClientId(bundleId))
      throw new ConvexError(APPLE_REVOCATION.invalidBundleId)
    const credentials = appleCredentials()
    if (!credentials) throw new ConvexError(APPLE_REVOCATION.unavailable)
    try {
      await revokeAppleAuthorization(credentials, authorizationCode, bundleId)
    } catch (error) {
      console.error('accounts.revokeAppleSignIn failed', error)
      throw new ConvexError(APPLE_REVOCATION.failed)
    }
    return null
  },
})
