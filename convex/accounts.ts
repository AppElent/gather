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
 *
 * ## Gather's data only, or the whole AppElent login (APP-397)
 *
 * Gather, Foundry, Fairway and Arcade Club share one Clerk login, so deleting
 * it is not Gather's alone to decide. The person chooses (ADR-0050):
 *
 * - **Gather's data only** (`keepLogin`): the same purge, and the login stays.
 *   The `users` row lets go of the Clerk subject in the same transaction
 *   (`releasedSubject`), so nothing that looks the subject up finds it again —
 *   `ensureUser` included. Signing in again, a minute or a year later, starts
 *   a fresh, empty account rather than meeting the tombstone.
 * - **The whole AppElent account**: the purge as it always was, keeping the
 *   subject and the tombstone, because the same session is about to ask Clerk
 *   to delete the login and must not be handed an account in between.
 *
 * Clerk's `user.deleted` webhook (`convex/http.ts`) runs the first kind for
 * the deleted subject, which is how deleting the login from another app, or
 * from the Clerk dashboard, wipes Gather too. All three go through
 * `purgeSubject`; there is no second copy of the purge.
 */

import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import {
  action,
  internalMutation,
  mutation,
  query,
} from './_generated/server'
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
  requireIdentity,
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

/** The refusal when the signed-in account is not the one being deleted. */
export const ACCOUNT_CHANGED =
  'You are signed in to a different account now. Nothing was deleted.'

/**
 * What a released `users` row holds in place of its Clerk subject.
 *
 * Clerk subjects start `user_`, so this can never be one, and it is unique per
 * row, so `maintenance.mergeDuplicateUsers` never mistakes two released rows
 * for one person.
 */
export function releasedSubject(userId: Id<'users'>): string {
  return `released:${userId}`
}

/**
 * Start purging one person's rows: one Group per scheduled step, then the
 * person (`cascade.purgeAccount`). The single purge behind every way in —
 * `deleteAccount` with either choice, and the Clerk webhook.
 *
 * Every row the subject resolves to is purged, not just the canonical one:
 * a duplicate left behind would otherwise become the account a later sign-in
 * resolves to, with the old data in it.
 *
 * `releaseLogin` lets go of the subject as well (see the header). Without it
 * the row keeps the subject and `deletedAt` stops `ensureUser` until the purge
 * deletes the row. A row already being purged is not purged twice; asked to
 * release it, it lets go of the subject too, so a later sign-in is never
 * stuck behind an earlier deletion. Returns how many rows it touched.
 */
export async function purgeSubject(
  ctx: MutationCtx,
  subject: string,
  { releaseLogin }: { releaseLogin: boolean },
): Promise<number> {
  const rows = await ctx.db
    .query('users')
    .withIndex('by_clerkId', (q) => q.eq('clerkId', subject))
    .collect()
  for (const user of rows) await purgeUser(ctx, user, releaseLogin)
  return rows.length
}

async function purgeUser(
  ctx: MutationCtx,
  user: Doc<'users'>,
  releaseLogin: boolean,
) {
  const release = releaseLogin ? { clerkId: releasedSubject(user._id) } : {}
  if (user.deletedAt) {
    if (releaseLogin) await ctx.db.patch(user._id, release)
    return
  }
  const { solo } = await partitionGroups(ctx, user._id)
  await ctx.db.patch(user._id, { deletedAt: Date.now(), ...release })
  await ctx.scheduler.runAfter(0, internal.cascade.purgeAccount, {
    userId: user._id,
    groupIds: solo,
  })
}

/**
 * Start the purge. Nothing here takes a user id — the caller is whoever the
 * token says they are, as everywhere else.
 *
 * It returns once the account is marked and the work is scheduled, so the
 * client can go on to delete the Clerk user immediately (or, with
 * `keepLogin`, sign out). The rest runs in bounded steps behind it
 * (`cascade.purgeAccount`).
 */
export const deleteAccount = mutation({
  args: {
    // The Clerk user id the phone means to delete. Optional so builds from
    // before APP-213 keep working; when given, a session that has changed
    // account since the person confirmed (the Apple sheet can stay up a while)
    // is refused instead of purging the account it changed to.
    expectedSubject: v.optional(v.string()),
    // Delete Gather's data and keep the AppElent login (APP-397). Absent is
    // the whole account, which is what every build from before it means.
    keepLogin: v.optional(v.boolean()),
  },
  handler: async (ctx, { expectedSubject, keepLogin }) => {
    // Deleting the account stays in the app (ADR-0046).
    await rejectConnectedApps(ctx)
    const identity = await requireIdentity(ctx)
    if (expectedSubject !== undefined && identity.subject !== expectedSubject)
      throw new ConvexError(ACCOUNT_CHANGED)
    if (keepLogin) {
      // Nothing left under this subject is the same answer as having just
      // deleted it: a second tap after the release is a no-op, not a refusal.
      await purgeSubject(ctx, identity.subject, { releaseLogin: true })
      return
    }
    // The whole account needs a Gather account to be deleting.
    await requireCurrentUser(ctx)
    await purgeSubject(ctx, identity.subject, { releaseLogin: false })
  },
})

/**
 * The Clerk user is gone (the `user.deleted` webhook, `convex/http.ts`), so
 * purge everything Gather holds for it. The same purge as deleting Gather's
 * data in the app. Idempotent: a subject with nothing left here, or a second
 * delivery, does nothing.
 */
export const purgeDeletedClerkUser = internalMutation({
  args: { subject: v.string() },
  returns: v.number(),
  handler: async (ctx, { subject }) =>
    await purgeSubject(ctx, subject, { releaseLogin: true }),
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
  returns: v.null(),
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
