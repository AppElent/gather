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

import {
  APPLE_ACCOUNT_MISMATCH,
  APPLE_WEB_RETURN_URLS,
  APPLE_WEB_SERVICES_ID,
} from '@gather/core/apple-sign-in'
import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server'
import {
  AppleAccountMismatch,
  appleCredentials,
  isAppleClientId,
  revokeAppleAuthorization,
} from './lib/appleSignIn'
import { getGatedIdentity, rejectConnectedApps } from './lib/connectedApps'
import {
  getCurrentUser,
  getMyGroupIds,
  getUserByClerkId,
  notSignedInError,
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
    // The whole account needs a Gather account to be deleting. One already
    // being deleted counts: asking again is a no-op, not a refusal.
    if (!(await getUserByClerkId(ctx, identity.subject)))
      throw notSignedInError()
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
  handler: async (ctx, { subject }) => {
    // The login is gone, so its Apple link is too.
    const link = await appleLinkOf(ctx, subject)
    if (link) await ctx.db.delete(link._id)
    return await purgeSubject(ctx, subject, { releaseLogin: true })
  },
})

// -- Apple links (APP-388) ---------------------------------------------------

async function appleLinkOf(ctx: QueryCtx, clerkId: string) {
  return await ctx.db
    .query('appleSignInLinks')
    .withIndex('by_clerkId', (q) => q.eq('clerkId', clerkId))
    .unique()
}

const appleLink = v.object({
  clerkId: v.string(),
  appleUserIds: v.array(v.string()),
  clerkUpdatedAt: v.number(),
})

/**
 * Mirrors one login's verified Apple users (`appleSignInLinks`). A delivery
 * older than the stored one is ignored, so retries and out-of-order events
 * are harmless; no Apple user removes the row.
 */
async function storeAppleLink(
  ctx: MutationCtx,
  {
    clerkId,
    appleUserIds,
    clerkUpdatedAt,
  }: { clerkId: string; appleUserIds: string[]; clerkUpdatedAt: number },
) {
  const existing = await appleLinkOf(ctx, clerkId)
  if (existing && existing.clerkUpdatedAt > clerkUpdatedAt) return
  if (appleUserIds.length === 0) {
    if (existing) await ctx.db.delete(existing._id)
    return
  }
  if (existing)
    await ctx.db.patch(existing._id, { appleUserIds, clerkUpdatedAt })
  else
    await ctx.db.insert('appleSignInLinks', {
      clerkId,
      appleUserIds,
      clerkUpdatedAt,
    })
}

/** Clerk's `user.created` / `user.updated` (`POST /clerk/webhook`). */
export const syncAppleLink = internalMutation({
  args: appleLink.fields,
  returns: v.null(),
  handler: async (ctx, link) => {
    await storeAppleLink(ctx, link)
    return null
  },
})

/** Links per backfill call: one `convex run` stays a small transaction. */
const MAX_BACKFILL_LINKS = 100

/**
 * One-off backfill for logins whose Apple link predates the webhook
 * subscription (`scripts/backfill-apple-links.mjs`, run locally; see
 * docs/migrations/README.md). The same rules as the webhook, so a newer
 * delivery always wins and a repeat changes nothing.
 */
export const backfillAppleLinks = internalMutation({
  args: { links: v.array(appleLink) },
  returns: v.null(),
  handler: async (ctx, { links }) => {
    if (links.length > MAX_BACKFILL_LINKS)
      throw new ConvexError(`At most ${MAX_BACKFILL_LINKS} links per call`)
    for (const link of links) await storeAppleLink(ctx, link)
    return null
  },
})

/**
 * What web Apple revocation needs to know before it exchanges a code, for the
 * action, which cannot read: whether this login has a Gather account the
 * whole-account deletion would accept, and its mirrored Apple users.
 */
export const appleRevocationCheck = internalQuery({
  args: { clerkId: v.string() },
  returns: v.object({
    hasAccount: v.boolean(),
    appleUserIds: v.array(v.string()),
  }),
  handler: async (ctx, { clerkId }) => ({
    hasAccount: (await getUserByClerkId(ctx, clerkId)) !== null,
    appleUserIds: (await appleLinkOf(ctx, clerkId))?.appleUserIds ?? [],
  }),
})

/** Apple authorization codes are opaque strings of a few hundred characters. */
const MAX_AUTHORIZATION_CODE = 2000

/** The stable messages `revokeAppleSignIn` fails with. */
export const APPLE_REVOCATION = {
  invalidCode: 'Invalid Apple authorization code',
  invalidBundleId: 'Not a Gather build',
  invalidRedirectUri: 'Not a registered Apple return URL',
  mismatch: APPLE_ACCOUNT_MISMATCH,
  unavailable: 'Apple revocation is not configured',
  failed: 'Apple revocation failed',
} as const

/**
 * Revoke the signed-in account's Sign in with Apple grant, just before the
 * whole AppElent account is deleted (`lib/appleSignIn.ts`); never for
 * Gather's data only. The code comes from a fresh native Apple sheet on iOS,
 * with the bundle ID of the build that showed it, or from an Apple JS popup
 * on the web (APP-388), with the web Services ID as `bundleId` and the
 * registered return URL it was requested with.
 *
 * A grant cannot be restored, so a web code is exchanged only once the
 * whole-account deletion would go ahead for this caller: the account the
 * person confirmed (`expectedSubject`) is still the one signed in, and it has
 * a Gather account. It is revoked only when its Apple user is one Clerk links
 * to this login, as mirrored by the Clerk webhook (`appleSignInLinks`);
 * otherwise, including when nothing is mirrored, it fails with
 * `APPLE_REVOCATION.mismatch` and the web stops the deletion. Native codes are
 * not bound yet: installed phones would be refused for every login whose link
 * is not mirrored.
 *
 * Every other failure is one stable message, and the caller still deletes the
 * account, so Apple can never block a deletion.
 */
export const revokeAppleSignIn = action({
  args: {
    authorizationCode: v.string(),
    bundleId: v.string(),
    redirectUri: v.optional(v.string()),
    // The Clerk user the person confirmed the deletion as. The web always
    // sends it; installed phones from APP-213 send none.
    expectedSubject: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (
    ctx,
    { authorizationCode, bundleId, redirectUri, expectedSubject },
  ) => {
    // Deleting the account stays in the app (ADR-0046).
    await rejectConnectedApps(ctx)
    const identity = await getGatedIdentity(ctx)
    if (!identity) throw notSignedInError()
    if (expectedSubject !== undefined && identity.subject !== expectedSubject)
      throw new ConvexError(ACCOUNT_CHANGED)
    if (!authorizationCode || authorizationCode.length > MAX_AUTHORIZATION_CODE)
      throw new ConvexError(APPLE_REVOCATION.invalidCode)
    if (!isAppleClientId(bundleId))
      throw new ConvexError(APPLE_REVOCATION.invalidBundleId)
    const web = bundleId === APPLE_WEB_SERVICES_ID
    // Web codes need their registered return URL; native codes have none.
    if (
      web
        ? !redirectUri || !APPLE_WEB_RETURN_URLS.includes(redirectUri)
        : redirectUri !== undefined
    )
      throw new ConvexError(APPLE_REVOCATION.invalidRedirectUri)
    const credentials = appleCredentials()
    if (!credentials) throw new ConvexError(APPLE_REVOCATION.unavailable)
    let appleUserIds: string[] | undefined
    if (web) {
      if (expectedSubject === undefined) throw new ConvexError(ACCOUNT_CHANGED)
      const check = await ctx.runQuery(internal.accounts.appleRevocationCheck, {
        clerkId: identity.subject,
      })
      // The same refusal the whole-account `deleteAccount` would give.
      if (!check.hasAccount) throw notSignedInError()
      if (check.appleUserIds.length === 0)
        throw new ConvexError(APPLE_REVOCATION.mismatch)
      appleUserIds = check.appleUserIds
    }
    try {
      await revokeAppleAuthorization(credentials, authorizationCode, bundleId, {
        redirectUri,
        appleUserIds,
      })
    } catch (error) {
      if (error instanceof AppleAccountMismatch)
        throw new ConvexError(APPLE_REVOCATION.mismatch)
      console.error('accounts.revokeAppleSignIn failed', error)
      throw new ConvexError(APPLE_REVOCATION.failed)
    }
    return null
  },
})
