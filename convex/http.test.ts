import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  alice,
  bob,
  seedGroup,
  seedMember,
  testConvex,
} from '../test/convexHarness'
import { api } from './_generated/api'
import schema from './schema'

/**
 * `POST /clerk/webhook` (APP-397): a Svix-signed `user.deleted` purges that
 * Clerk user's Gather data with the same purge as "Delete Gather data only",
 * and nothing that is not signed does anything at all.
 */

type Harness = ReturnType<typeof testConvex>

// Generated per run: a literal signing secret in the repo reads as a leaked
// one to secret scanning.
const randomKey = () => Buffer.from(crypto.getRandomValues(new Uint8Array(24)))
const KEY = randomKey()
const SECRET = ['whsec', KEY.toString('base64')].join('_')

beforeEach(() => vi.stubEnv('CLERK_WEBHOOK_SECRET', SECRET))
afterEach(() => vi.unstubAllEnvs())

function signed(body: string, key = KEY, at = Date.now()) {
  const id = `msg_${Math.random().toString(36).slice(2)}`
  const timestamp = String(Math.floor(at / 1000))
  const signature = createHmac('sha256', key)
    .update(`${id}.${timestamp}.${body}`)
    .digest('base64')
  return {
    'svix-id': id,
    'svix-timestamp': timestamp,
    'svix-signature': `v1,${signature}`,
    'content-type': 'application/json',
  }
}

const userDeleted = (id: string) =>
  JSON.stringify({
    type: 'user.deleted',
    object: 'event',
    data: { id, object: 'user', deleted: true },
  })

async function post(t: Harness, body: string, headers: HeadersInit) {
  return await t.fetch('/clerk/webhook', { method: 'POST', body, headers })
}

/** Drain the purge's chain of scheduled steps (see accounts.test.ts). */
async function settle(t: Harness) {
  for (let i = 0; i < 30; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0))
    await t.finishInProgressScheduledFunctions()
  }
}

/**
 * Alice with a Group of her own, a household she shares with Bob, a note in
 * each and an AI usage row; Bob with his own row and a Group of his own.
 */
async function household(t: Harness) {
  await t.withIdentity(alice).mutation(api.users.ensureUser, {})
  await t.withIdentity(bob).mutation(api.users.ensureUser, {})
  await t
    .withIdentity(alice)
    .mutation(api.groups.createGroup, { name: 'Allotment' })
  await t.withIdentity(bob).mutation(api.groups.createGroup, { name: 'Shed' })
  await t.run(async (ctx) => {
    const users = await ctx.db.query('users').collect()
    const a = users.find((u) => u.clerkId === alice.subject)!._id
    const b = users.find((u) => u.clerkId === bob.subject)!._id
    const shared = await seedGroup(ctx, { name: 'Household', slug: 'household' })
    await seedMember(ctx, shared, a, 'admin')
    await seedMember(ctx, shared, b, 'member')
    for (const group of await ctx.db.query('groups').collect())
      await ctx.db.insert('notes', {
        groupId: group._id,
        title: group.name,
        body: '',
        createdBy: a,
        updatedAt: 0,
      })
    await ctx.db.insert('aiUsage', { userId: a, day: '2026-11-19', count: 1 })
    await ctx.db.insert('aiUsage', { userId: b, day: '2026-11-19', count: 1 })
  })
}

/** How many rows every table holds: the whole database, minus the ids. */
async function rowCounts(t: Harness) {
  return await t.run(async (ctx) => {
    const counts: Record<string, number> = {}
    for (const table of Object.keys(schema.tables) as (keyof typeof schema.tables)[])
      counts[table] = (await ctx.db.query(table).collect()).length
    return counts
  })
}

describe('POST /clerk/webhook', () => {
  test('a signed user.deleted purges that user, as deleting Gather data does', async () => {
    const viaWebhook = testConvex()
    await household(viaWebhook)
    const response = await post(
      viaWebhook,
      userDeleted(alice.subject),
      signed(userDeleted(alice.subject)),
    )
    expect(response.status).toBe(200)
    await settle(viaWebhook)

    const inApp = testConvex()
    await household(inApp)
    await inApp
      .withIdentity(alice)
      .mutation(api.accounts.deleteAccount, { keepLogin: true })
    await settle(inApp)

    const after = await rowCounts(viaWebhook)
    expect(after).toEqual(await rowCounts(inApp))
    // And what that is: Alice and her own Group gone, the household and Bob
    // left with what Alice wrote there.
    expect(await viaWebhook.withIdentity(alice).query(api.users.me, {})).toBeNull()
    expect(await viaWebhook.withIdentity(bob).query(api.users.me, {})).not.toBeNull()
    const groups = await viaWebhook.run(async (ctx) =>
      (await ctx.db.query('groups').collect()).map((g) => g.name).sort(),
    )
    expect(groups).toEqual(['Household', 'Shed'])
    expect(after.notes).toBe(2)
    expect(after.aiUsage).toBe(1)
  })

  test('a second delivery, or a user Gather never had, is a 200 that does nothing', async () => {
    const t = testConvex()
    await household(t)
    const body = userDeleted(alice.subject)
    expect((await post(t, body, signed(body))).status).toBe(200)
    await settle(t)
    const once = await rowCounts(t)

    expect((await post(t, body, signed(body))).status).toBe(200)
    const stranger = userDeleted('user_nobody')
    expect((await post(t, stranger, signed(stranger))).status).toBe(200)
    await settle(t)
    expect(await rowCounts(t)).toEqual(once)
  })

  test('a delivery while the in-app deletion is still purging does not purge twice', async () => {
    const t = testConvex()
    await household(t)
    // The whole-account choice: purge started, tombstone set, Clerk deleting.
    await t.withIdentity(alice).mutation(api.accounts.deleteAccount, {})
    const body = userDeleted(alice.subject)
    expect((await post(t, body, signed(body))).status).toBe(200)
    await settle(t)

    const groups = await t.run(async (ctx) =>
      (await ctx.db.query('groups').collect()).map((g) => g.name).sort(),
    )
    expect(groups).toEqual(['Household', 'Shed'])
    expect(await t.run(async (ctx) => ctx.db.query('users').collect())).toHaveLength(1)
  })

  describe('refuses, with nothing deleted', () => {
    async function refused(
      headers: (body: string) => HeadersInit,
      status: number,
    ) {
      const t = testConvex()
      await household(t)
      const before = await rowCounts(t)
      const body = userDeleted(alice.subject)
      const response = await post(t, body, headers(body))
      expect(response.status).toBe(status)
      await settle(t)
      expect(await rowCounts(t)).toEqual(before)
      expect(await t.withIdentity(alice).query(api.users.me, {})).not.toBeNull()
    }

    test('an unsigned request', async () => {
      await refused(() => ({ 'content-type': 'application/json' }), 400)
    })

    test('a request signed with another key', async () => {
      await refused(
        (body) => signed(body, randomKey()),
        401,
      )
    })

    test('a signed body that was changed on the way', async () => {
      await refused(() => signed(userDeleted(bob.subject)), 401)
    })

    test('a replayed request, ten minutes old', async () => {
      await refused(
        (body) => signed(body, KEY, Date.now() - 10 * 60 * 1000),
        401,
      )
    })

    test('any request, when the deployment has no secret', async () => {
      vi.stubEnv('CLERK_WEBHOOK_SECRET', '')
      await refused((body) => signed(body), 503)
    })
  })

  test('other events answer 200 and do nothing', async () => {
    const t = testConvex()
    await household(t)
    const before = await rowCounts(t)
    for (const type of ['user.created', 'user.updated', 'session.created']) {
      const body = JSON.stringify({ type, data: { id: alice.subject } })
      expect((await post(t, body, signed(body))).status).toBe(200)
    }
    await settle(t)
    expect(await rowCounts(t)).toEqual(before)
  })

  test('a signed body that is not an event is a 400 that does nothing', async () => {
    const t = testConvex()
    await household(t)
    const before = await rowCounts(t)
    for (const body of ['null', '42', '"user.deleted"', '{"type":"user.deleted","data":null}']) {
      expect((await post(t, body, signed(body))).status).toBe(400)
    }
    await settle(t)
    expect(await rowCounts(t)).toEqual(before)
  })

  test('only POST is routed', async () => {
    const t = testConvex()
    const response = await t.fetch('/clerk/webhook', { method: 'GET' })
    expect(response.status).toBe(404)
  })
})
