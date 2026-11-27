/**
 * Push notifications (APP-298): a person's phones, their switches, and the
 * internal entry points the rest of the backend sends through.
 *
 * The public functions are the phone's: register this install's Expo push
 * token, forget it on sign-out, read and change the switches and per-Group
 * mutes on Settings → Notifications. None of them takes a user id — the
 * caller is whoever the token says they are.
 *
 * The internal ones are `notify`, `schedule` and `cancel`, thin wrappers over
 * `lib/notifications.ts` for callers that are already scheduled work. A
 * mutation that causes a notification calls the helpers directly instead, so
 * the notification is queued in its own transaction. `forgetSessionOf` is
 * the Clerk webhook's: a session that ended anywhere drops its phones.
 *
 * Delivery is Expo's push service. `sendPush` posts the messages and reads
 * the tickets back; an install Expo says is gone (`DeviceNotRegistered`) is
 * forgotten at once from the ticket, or from the receipt `checkReceipts`
 * reads a quarter of an hour later.
 */

import {
  isExpoPushToken,
  NOTIFICATION_SWITCHES,
  resolveSwitches,
} from '@gather/core/notifications'
import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import {
  internalAction,
  internalMutation,
  type MutationCtx,
  mutation,
  query,
} from './_generated/server'
import { rejectConnectedApps } from './lib/connectedApps'
import { requireGroupBySlug } from './lib/groupAccess'
import {
  notificationPayloadValidator,
  pushLocaleValidator,
  pushPlatformValidator,
} from './lib/notificationFields'
import {
  cancelScheduled,
  fireScheduled as fire,
  notify as notifyNow,
  schedule as scheduleSend,
} from './lib/notifications'
import { INVALID_SESSION_ID, isSessionId } from './lib/sessions'
import { getCurrentUser, requireCurrentUser } from './lib/sharing'
import { deleteWatchDevices } from './lib/watchDevices'

/** Phones one person may register; the least recently seen goes first. */
export const MAX_DEVICES = 10

/** The refusal for a token that is not an Expo push token. */
export const INVALID_PUSH_TOKEN = 'Not an Expo push token'

/** A row this recent outlives a session list that may predate it. */
export const SESSION_GRACE_MS = 10 * 60 * 1000

/**
 * How long an ended session's phone may still reach us (APP-887). Clerk's
 * tokens live 60 seconds, so a phone whose session was just revoked can call
 * `registerDevice` for about a minute more; this leaves room for clock skew.
 */
export const ENDED_SESSION_WINDOW_MS = 5 * 60 * 1000

/** Session ids one `forgetEndedSessions` call may hold open; Clerk lists fewer. */
const MAX_ENDED_SESSIONS = 50

const EXPO_SEND = 'https://exp.host/--/api/v2/push/send'
const EXPO_RECEIPTS = 'https://exp.host/--/api/v2/push/getReceipts'

/** Expo's own limits per request. */
const SEND_CHUNK = 100
const RECEIPT_CHUNK = 300

/** Expo keeps receipts for a day; it asks for a wait before reading them. */
const RECEIPT_DELAY_MS = 15 * 60 * 1000

/**
 * The waits before posting a batch again that Expo did not take: no answer,
 * too many requests, or a server error. Three more tries over about ten
 * minutes, so a reminder survives a short outage and is not sent an hour late.
 */
export const SEND_RETRY_DELAYS_MS = [30_000, 120_000, 480_000] as const

const switchValidator = v.union(
  ...NOTIFICATION_SWITCHES.map((name) => v.literal(name)),
)

const pushMessageValidator = v.object({
  to: v.string(),
  title: v.string(),
  body: v.string(),
  data: v.object({ url: v.string() }),
  sound: v.literal('default'),
  categoryId: v.optional(v.string()),
})

// -- The phone ----------------------------------------------------------------

/**
 * Remember this install's token for the signed-in person. A token is one
 * install, so one already held by another account moves here: the phone has
 * changed hands, and the previous account must stop receiving on it.
 *
 * `sessionId` is the Clerk session this phone is signed in with. Convex's
 * token does not carry it, so the phone says; it only ever labels the
 * caller's own row. It is what lets a sign-out release the row without a
 * session (`releaseDevice`) and a revoked session's phone be forgotten
 * (`forgetEndedSessions`).
 *
 * A session that has just ended stores nothing (APP-887): its phone can
 * still call for as long as its last token lives, after the webhook or the
 * revoke already forgot it.
 */
export const registerDevice = mutation({
  args: {
    token: v.string(),
    platform: pushPlatformValidator,
    locale: pushLocaleValidator,
    sessionId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { token, platform, locale, sessionId }) => {
    await rejectConnectedApps(ctx)
    const user = await requireCurrentUser(ctx)
    if (!isExpoPushToken(token)) throw new ConvexError(INVALID_PUSH_TOKEN)
    if (sessionId !== undefined && !isSessionId(sessionId))
      throw new ConvexError(INVALID_SESSION_ID)
    if (
      sessionId !== undefined &&
      (await hasJustEnded(ctx, user._id, sessionId))
    )
      return null

    const now = Date.now()
    const held = await ctx.db
      .query('pushDevices')
      .withIndex('by_token', (q) => q.eq('token', token))
      .collect()
    const [mine, ...rest] = held
    for (const row of rest) await ctx.db.delete(row._id)
    if (mine) {
      await ctx.db.patch(mine._id, {
        userId: user._id,
        platform,
        locale,
        sessionId,
        updatedAt: now,
      })
    } else {
      await ctx.db.insert('pushDevices', {
        userId: user._id,
        token,
        platform,
        locale,
        sessionId,
        updatedAt: now,
      })
    }

    const devices = await ctx.db
      .query('pushDevices')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()
    const oldestFirst = devices.sort((a, b) => a.updatedAt - b.updatedAt)
    for (const row of oldestFirst.slice(0, -MAX_DEVICES))
      await ctx.db.delete(row._id)
    return null
  },
})

/**
 * Forget this install's token on sign-out. Needs no session, because a phone
 * signing out may have none by the time this reaches the server (offline, or
 * sent after the session ended); the phone keeps asking until it lands.
 *
 * Holding the token *and* the session it was registered under is the proof:
 * only that phone knows both. A token registered since under another session
 * (somebody else signed in on the phone) does not match and stays.
 */
export const releaseDevice = mutation({
  args: { token: v.string(), sessionId: v.string() },
  returns: v.null(),
  handler: async (ctx, { token, sessionId }) => {
    await rejectConnectedApps(ctx)
    const rows = await ctx.db
      .query('pushDevices')
      .withIndex('by_token', (q) => q.eq('token', token))
      .collect()
    for (const row of rows)
      if (row.sessionId === sessionId) await ctx.db.delete(row._id)
    return null
  },
})

/**
 * Forget the caller's phones whose session has ended: revoked from another
 * device, or signed out where the release never arrived. The phone passes the
 * sessions Clerk lists as active for this person; a row registered under any
 * other session goes. A row registered in the last few minutes stays, in case
 * its session is newer than the list. `endedSessionIds` are sessions the
 * person just revoked: their phones go whatever their age.
 */
export const forgetEndedSessions = mutation({
  args: {
    activeSessionIds: v.array(v.string()),
    endedSessionIds: v.optional(v.array(v.string())),
  },
  returns: v.null(),
  handler: async (ctx, { activeSessionIds, endedSessionIds = [] }) => {
    await rejectConnectedApps(ctx)
    const user = await requireCurrentUser(ctx)
    // Only the caller's own phones (at most MAX_DEVICES) are read; the lists
    // are just looked up in, however long Clerk's are.
    const active = new Set(activeSessionIds)
    const ended = new Set(endedSessionIds)
    const settled = Date.now() - SESSION_GRACE_MS
    const devices = await ctx.db
      .query('pushDevices')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()
    for (const row of devices)
      if (
        row.sessionId !== undefined &&
        !active.has(row.sessionId) &&
        (ended.has(row.sessionId) || row.updatedAt < settled)
      )
        await ctx.db.delete(row._id)
    // The watches those phones paired lose their keys the same way (APP-653).
    await deleteWatchDevices(
      ctx,
      user._id,
      (watch) =>
        watch.sessionId !== undefined &&
        !active.has(watch.sessionId) &&
        (ended.has(watch.sessionId) || watch.createdAt < settled),
    )
    const closed = [...ended]
      .filter((id) => isSessionId(id) && !active.has(id))
      .slice(0, MAX_ENDED_SESSIONS)
    if (closed.length > 0) await holdEnded(ctx, user._id, closed)
    return null
  },
})

/**
 * A Clerk session that is over, from `POST /clerk/webhook`: wherever it was
 * ended (the account portal too), the phones registered under it get no more
 * pushes and the watches it paired lose their keys. A phone registered since
 * under another session stays.
 */
export const forgetSessionOf = internalMutation({
  args: { clerkId: v.string(), sessionId: v.string() },
  returns: v.null(),
  handler: async (ctx, { clerkId, sessionId }) => {
    const users = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', clerkId))
      .collect()
    for (const user of users) {
      await forgetSessions(ctx, user._id, [sessionId])
      await holdEnded(ctx, user._id, [sessionId])
    }
    return null
  },
})

/**
 * The end of an ended session's window (APP-887): whatever registered under
 * it in the meantime goes too. While this job waits, `registerDevice`
 * stores nothing for those sessions; that pending job is the only record
 * that they ended.
 */
export const sweepEndedSessions = internalMutation({
  args: { userId: v.id('users'), sessionIds: v.array(v.string()) },
  returns: v.null(),
  handler: async (ctx, { userId, sessionIds }) => {
    await forgetSessions(ctx, userId, sessionIds)
    return null
  },
})

/** Drop a person's phones and watches signed in with one of these sessions. */
async function forgetSessions(
  ctx: MutationCtx,
  userId: Id<'users'>,
  sessionIds: readonly string[],
) {
  const ended = new Set(sessionIds)
  const phones = await ctx.db
    .query('pushDevices')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .collect()
  for (const phone of phones)
    if (phone.sessionId !== undefined && ended.has(phone.sessionId))
      await ctx.db.delete(phone._id)
  await deleteWatchDevices(
    ctx,
    userId,
    (watch) => watch.sessionId !== undefined && ended.has(watch.sessionId),
  )
}

/** Keep these sessions closed to `registerDevice` for the window. */
async function holdEnded(
  ctx: MutationCtx,
  userId: Id<'users'>,
  sessionIds: string[],
) {
  await ctx.scheduler.runAfter(
    ENDED_SESSION_WINDOW_MS,
    internal.notifications.sweepEndedSessions,
    { userId, sessionIds },
  )
}

/**
 * Whether this person's session ended within the window: a sweep for it is
 * still waiting. Only jobs scheduled in the window are read, newest first:
 * a household app schedules a handful in five minutes, so this stays small
 * on a phone's launch path. A deployment scheduling thousands a minute would
 * want an `endedSessions` table instead.
 */
async function hasJustEnded(
  ctx: MutationCtx,
  userId: Id<'users'>,
  sessionId: string,
) {
  const since = Date.now() - ENDED_SESSION_WINDOW_MS
  for await (const job of ctx.db.system
    .query('_scheduled_functions')
    .order('desc')) {
    if (job._creationTime < since) return false
    if (job.state.kind !== 'pending' || !job.name.includes('sweepEndedSessions'))
      continue
    const args = job.args[0] as
      | { userId?: unknown; sessionIds?: unknown }
      | undefined
    if (
      args?.userId === userId &&
      Array.isArray(args.sessionIds) &&
      args.sessionIds.includes(sessionId)
    )
      return true
  }
  return false
}

/** The caller's switches, resolved, and the Groups they have muted. */
export const settings = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      switches: v.object({
        taskReminders: v.boolean(),
        taskAssignments: v.boolean(),
        eventReminders: v.boolean(),
        eventAssignments: v.boolean(),
      }),
      mutedGroupIds: v.array(v.id('groups')),
    }),
  ),
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    if (!user) return null
    const memberships = await ctx.db
      .query('memberships')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()
    return {
      switches: resolveSwitches(user.notificationSwitches),
      mutedGroupIds: memberships
        .filter((m) => m.notificationsMuted)
        .map((m) => m.groupId),
    }
  },
})

/** Turn one kind on or off, in every Group. */
export const setSwitch = mutation({
  args: { name: switchValidator, enabled: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { name, enabled }) => {
    await rejectConnectedApps(ctx)
    const user = await requireCurrentUser(ctx)
    await ctx.db.patch(user._id, {
      notificationSwitches: { ...user.notificationSwitches, [name]: enabled },
    })
    return null
  },
})

/** Mute or unmute one Group, for the caller only. */
export const setGroupMuted = mutation({
  args: { groupSlug: v.string(), muted: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { groupSlug, muted }) => {
    await rejectConnectedApps(ctx)
    const { membership } = await requireGroupBySlug(ctx, groupSlug)
    await ctx.db.patch(membership._id, { notificationsMuted: muted })
    return null
  },
})

// -- The backend's entry points ----------------------------------------------

export const notify = internalMutation({
  args: {
    userIds: v.array(v.id('users')),
    payload: notificationPayloadValidator,
  },
  returns: v.null(),
  handler: async (ctx, { userIds, payload }) => {
    await notifyNow(ctx, userIds, payload)
    return null
  },
})

export const schedule = internalMutation({
  args: {
    userId: v.id('users'),
    at: v.number(),
    payload: notificationPayloadValidator,
    dedupeKey: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { userId, at, payload, dedupeKey }) => {
    await scheduleSend(ctx, userId, at, payload, dedupeKey)
    return null
  },
})

export const cancel = internalMutation({
  args: { userId: v.id('users'), dedupeKey: v.string() },
  returns: v.null(),
  handler: async (ctx, { userId, dedupeKey }) => {
    await cancelScheduled(ctx, userId, dedupeKey)
    return null
  },
})

/** The job `schedule` leaves behind (`lib/notifications.ts`). */
export const fireScheduled = internalMutation({
  args: {
    rowId: v.id('scheduledNotifications'),
    generation: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, { rowId, generation }) => {
    await fire(ctx, rowId, generation)
    return null
  },
})

// -- Delivery -----------------------------------------------------------------

interface Ticket {
  status: 'ok' | 'error'
  id?: string
  message?: string
  details?: { error?: string }
}

function chunks<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size)
    out.push(items.slice(i, i + size))
  return out
}

class PushHttpError extends Error {
  constructor(readonly status: number) {
    super(`Expo push: HTTP ${status}`)
  }
}

/** Worth trying again: no answer at all, a rate limit, or Expo's own fault. */
function isTransient(error: unknown): boolean {
  if (!(error instanceof PushHttpError)) return true
  return error.status === 429 || error.status >= 500
}

async function postJson(url: string, body: unknown): Promise<unknown> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new PushHttpError(response.status)
  return await response.json()
}

/**
 * Post the messages to Expo. A ticket that already says the install is gone
 * forgets its token; the rest are checked again by receipt. A batch Expo did
 * not take for a passing reason is posted again later, a bounded number of
 * times (`attempt` counts the tries already made).
 */
export const sendPush = internalAction({
  args: {
    messages: v.array(pushMessageValidator),
    attempt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, { messages, attempt = 0 }) => {
    const gone: string[] = []
    const pending: { id: string; token: string }[] = []
    const again: typeof messages = []
    for (const batch of chunks(messages, SEND_CHUNK)) {
      let tickets: Ticket[]
      try {
        const answer = (await postJson(EXPO_SEND, batch)) as {
          data?: Ticket[]
          errors?: { code?: string }[]
        }
        // A whole-request refusal comes back as 200 with `errors` and no data.
        if (answer.errors?.length)
          console.error(
            'notifications.sendPush refused',
            answer.errors.map((error) => error.code),
          )
        tickets = answer.data ?? []
      } catch (error) {
        const retry =
          isTransient(error) && attempt < SEND_RETRY_DELAYS_MS.length
        console.error('notifications.sendPush failed', {
          attempt,
          retry,
          error: String(error),
        })
        if (retry) again.push(...batch)
        continue
      }
      tickets.forEach((ticket, index) => {
        const token = batch[index]?.to
        if (!token) return
        if (ticket.status === 'ok' && ticket.id)
          pending.push({ id: ticket.id, token })
        else if (ticket.details?.error === 'DeviceNotRegistered')
          gone.push(token)
        else if (ticket.status === 'error')
          console.error('notifications.sendPush ticket', ticket.details?.error)
      })
    }
    if (gone.length)
      await ctx.runMutation(internal.notifications.forgetTokens, {
        tokens: gone,
      })
    if (again.length)
      await ctx.scheduler.runAfter(
        SEND_RETRY_DELAYS_MS[attempt] as number,
        internal.notifications.sendPush,
        { messages: again, attempt: attempt + 1 },
      )
    if (pending.length)
      await ctx.scheduler.runAfter(
        RECEIPT_DELAY_MS,
        internal.notifications.checkReceipts,
        { tickets: pending },
      )
    return null
  },
})

/** Read the receipts for sent tickets and forget the installs that are gone. */
export const checkReceipts = internalAction({
  args: { tickets: v.array(v.object({ id: v.string(), token: v.string() })) },
  returns: v.null(),
  handler: async (ctx, { tickets }) => {
    const gone: string[] = []
    for (const batch of chunks(tickets, RECEIPT_CHUNK)) {
      let receipts: Record<string, Ticket>
      try {
        const answer = (await postJson(EXPO_RECEIPTS, {
          ids: batch.map((ticket) => ticket.id),
        })) as { data?: Record<string, Ticket> }
        receipts = answer.data ?? {}
      } catch (error) {
        console.error('notifications.checkReceipts failed', error)
        continue
      }
      for (const ticket of batch) {
        const receipt = receipts[ticket.id]
        if (receipt?.details?.error === 'DeviceNotRegistered')
          gone.push(ticket.token)
        else if (receipt?.status === 'error')
          console.error(
            'notifications.checkReceipts receipt',
            receipt.details?.error,
          )
      }
    }
    if (gone.length)
      await ctx.runMutation(internal.notifications.forgetTokens, {
        tokens: gone,
      })
    return null
  },
})

/** Forget installs Expo reported as gone. */
export const forgetTokens = internalMutation({
  args: { tokens: v.array(v.string()) },
  returns: v.null(),
  handler: async (ctx, { tokens }) => {
    for (const token of new Set(tokens)) {
      const rows = await ctx.db
        .query('pushDevices')
        .withIndex('by_token', (q) => q.eq('token', token))
        .collect()
      for (const row of rows) await ctx.db.delete(row._id)
    }
    return null
  },
})
