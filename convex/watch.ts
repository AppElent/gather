/**
 * Pairing an Apple Watch with a Group (APP-653).
 *
 * The phone asks for a key and hands it to the watch; the watch then calls
 * `/watch/v1/*` with it, on its own (`lib/watchHttp.ts`,
 * `docs/contracts/watch-api.md`). The key is returned once and only its hash is
 * kept. None of the public functions takes a user id, and each touches only
 * the caller's own watches.
 */
import { watchRefusal } from '@gather/core/refusals'
import { ConvexError, v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import {
  internalMutation,
  mutation,
  type QueryCtx,
  query,
} from './_generated/server'
import { rejectConnectedApps } from './lib/connectedApps'
import { requireGroupBySlug } from './lib/groupAccess'
import { INVALID_SESSION_ID, isSessionId } from './lib/sessions'
import { getCurrentUser, requireCurrentUser } from './lib/sharing'
import { isWatchGroceryList, resolveWatch } from './lib/watchAccess'
import { deleteWatchDevices } from './lib/watchDevices'
import { hashWatchKey, newWatchKey } from './lib/watchKeys'
import { watchLimits } from './lib/watchRateLimits'

/** Watches one person may pair; the least recently seen goes first. */
export const MAX_WATCHES = 10

/** `lastSeenAt` moves at most this often: most calls write no row. */
export const LAST_SEEN_STEP_MS = 60 * 60 * 1000

/** The watch app's own id: a UUID, or anything as short and plain. */
const INSTALL_ID = /^[A-Za-z0-9-]{8,64}$/

// -- The phone ----------------------------------------------------------------

/**
 * Pair a watch: a new key for it, in place of the one it had. `sessionId` is
 * the Clerk session this phone is signed in with; the watch is signed out with
 * it. Convex's token does not carry it, so the phone says, as it does in
 * `notifications.registerDevice`; it only ever labels the caller's own row.
 */
export const pair = mutation({
  args: {
    groupSlug: v.string(),
    installId: v.string(),
    sessionId: v.string(),
    groceryListId: v.optional(v.id('taskLists')),
  },
  returns: v.object({
    deviceId: v.id('watchDevices'),
    /** Shown to no one and stored nowhere else: this is the only time. */
    key: v.string(),
    /** Where the watch calls: this deployment's `.convex.site` origin. */
    siteUrl: v.string(),
  }),
  handler: async (ctx, { groupSlug, installId, sessionId, groceryListId }) => {
    await rejectConnectedApps(ctx)
    const { user, group } = await requireGroupBySlug(ctx, groupSlug)
    if (!INSTALL_ID.test(installId))
      throw new ConvexError(watchRefusal('bad-request'))
    if (!isSessionId(sessionId)) throw new ConvexError(INVALID_SESSION_ID)
    if (groceryListId !== undefined) {
      const list = await ctx.db.get(groceryListId)
      if (!list || !isWatchGroceryList(group, list))
        throw new ConvexError(watchRefusal('not-found'))
    }
    const { ok } = await watchLimits.limit(ctx, 'watchPairings', {
      key: user._id,
    })
    if (!ok) throw new ConvexError(watchRefusal('rate-limited'))

    const before = await ctx.db
      .query('watchDevices')
      .withIndex('by_user_and_install', (q) =>
        q.eq('userId', user._id).eq('installId', installId),
      )
      // More than one after two accounts were merged.
      .collect()
    for (const device of before) await ctx.db.delete(device._id)
    const key = newWatchKey()
    const deviceId = await ctx.db.insert('watchDevices', {
      userId: user._id,
      groupId: group._id,
      keyHash: await hashWatchKey(key),
      installId,
      sessionId,
      groceryListId,
      createdAt: Date.now(),
    })

    const others = (await watchesOf(ctx, user._id)).filter(
      (device) => device._id !== deviceId,
    )
    const oldestFirst = others.sort((a, b) => seenAt(a) - seenAt(b))
    for (const device of oldestFirst.slice(0, -(MAX_WATCHES - 1)))
      await ctx.db.delete(device._id)

    return { deviceId, key, siteUrl: process.env.CONVEX_SITE_URL ?? '' }
  },
})

/** The caller's paired watches, newest first, without anything secret. */
export const devices = query({
  args: {},
  returns: v.array(
    v.object({
      deviceId: v.id('watchDevices'),
      installId: v.string(),
      groupId: v.id('groups'),
      groupName: v.string(),
      groceryListId: v.union(v.id('taskLists'), v.null()),
      createdAt: v.number(),
      lastSeenAt: v.union(v.number(), v.null()),
    }),
  ),
  handler: async (ctx) => {
    await rejectConnectedApps(ctx)
    const user = await getCurrentUser(ctx)
    if (!user) return []
    const rows = await watchesOf(ctx, user._id)
    return await Promise.all(
      rows
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(async (device) => ({
          deviceId: device._id,
          installId: device.installId,
          groupId: device.groupId,
          groupName: (await ctx.db.get(device.groupId))?.name ?? '',
          groceryListId: device.groceryListId ?? null,
          createdAt: device.createdAt,
          lastSeenAt: device.lastSeenAt ?? null,
        })),
    )
  },
})

/**
 * Take a watch's key back. One that is already gone, and somebody else's, are
 * one answer, so an id says nothing.
 */
export const revoke = mutation({
  args: { deviceId: v.id('watchDevices') },
  returns: v.null(),
  handler: async (ctx, { deviceId }) => {
    await rejectConnectedApps(ctx)
    const user = await requireCurrentUser(ctx)
    const device = await ctx.db.get(deviceId)
    if (device?.userId === user._id) await ctx.db.delete(deviceId)
    return null
  },
})

/**
 * Sign out on this phone: the watches it paired lose their keys. Called before
 * Clerk ends the session. A sign-out that never gets here is caught by Clerk's
 * session webhook (`notifications.forgetSessionOf`) and
 * `notifications.forgetEndedSessions`.
 */
export const forgetSession = mutation({
  args: { sessionId: v.string() },
  returns: v.null(),
  handler: async (ctx, { sessionId }) => {
    await rejectConnectedApps(ctx)
    const user = await requireCurrentUser(ctx)
    await deleteWatchDevices(
      ctx,
      user._id,
      (device) => device.sessionId === sessionId,
    )
    return null
  },
})

// -- The routes ---------------------------------------------------------------

/**
 * Let one request in, or say why not: the key and the Membership, then the
 * rate limit. Nothing is counted against a watch whose key does not stand.
 */
export const admit = internalMutation({
  args: {
    keyHash: v.string(),
    /** How many changes it carries; absent on a read. */
    changes: v.optional(v.number()),
  },
  returns: v.union(
    v.object({ ok: v.literal(true) }),
    v.object({
      ok: v.literal(false),
      reason: v.union(v.literal('not-signed-in'), v.literal('not-a-member')),
    }),
    v.object({
      ok: v.literal(false),
      reason: v.literal('rate-limited'),
      retryAfterMs: v.number(),
    }),
  ),
  handler: async (ctx, { keyHash, changes }) => {
    const caller = await resolveWatch(ctx, keyHash)
    if (!caller.ok) return caller
    const { device } = caller
    const requests = await watchLimits.limit(ctx, 'watchRequests', {
      key: device._id,
    })
    if (!requests.ok)
      return {
        ok: false as const,
        reason: 'rate-limited' as const,
        retryAfterMs: requests.retryAfter,
      }
    if (changes !== undefined && changes > 0) {
      const limited = await watchLimits.limit(ctx, 'watchChanges', {
        key: device._id,
        count: changes,
      })
      if (!limited.ok)
        return {
          ok: false as const,
          reason: 'rate-limited' as const,
          retryAfterMs: limited.retryAfter,
        }
    }
    const now = Date.now()
    if (now - (device.lastSeenAt ?? 0) >= LAST_SEEN_STEP_MS)
      await ctx.db.patch(device._id, { lastSeenAt: now })
    return { ok: true as const }
  },
})

function seenAt(device: { createdAt: number; lastSeenAt?: number }): number {
  return Math.max(device.createdAt, device.lastSeenAt ?? 0)
}

async function watchesOf(ctx: QueryCtx, userId: Id<'users'>) {
  return await ctx.db
    .query('watchDevices')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .collect()
}
