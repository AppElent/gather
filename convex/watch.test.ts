import rateLimiter from '@convex-dev/rate-limiter/test'
import { BARCODE_FORMATS, type BarcodeFormat } from '@gather/core/barcodes'
import { amsterdamIsoDate } from '@gather/core/civil-date'
import { readGroupRefusal, readWatchRefusal } from '@gather/core/refusals'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  alice,
  bob,
  seedGroup,
  seedMember,
  testConvex,
} from '../test/convexHarness'
import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { MCP_WRITE_SCOPE } from './lib/connectedApps'
import { completionDay } from './lib/taskRepeat'
import { watchBarcode } from './lib/watchBarcodes'
import { bearerKey, hashWatchKey, newWatchKey } from './lib/watchKeys'
import { MAX_CHANGES } from './lib/watchRateLimits'
import { LAST_SEEN_STEP_MS, MAX_WATCHES } from './watch'

/**
 * A paired watch (APP-653). The key stands for one Member in one Group, and the
 * promises are: only its hash is kept, anything that ends the Member's access
 * ends the key, nothing of another Group is reachable with it, and a change
 * sent twice happens once.
 */

type Harness = ReturnType<typeof testConvex>

const SITE = 'https://home.convex.site'
const SESSION = 'sess_alicephone'
const connectedApp = {
  ...alice,
  client_id: 'client_1',
  scope: MCP_WRITE_SCOPE,
}

beforeEach(() => vi.stubEnv('CONVEX_SITE_URL', SITE))
afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

/** Alice and Bob share Home; Bob alone has Shed. Each has a grocery list. */
async function setup() {
  const t = testConvex()
  rateLimiter.register(t)
  await t.withIdentity(alice).mutation(api.users.ensureUser, {})
  await t.withIdentity(bob).mutation(api.users.ensureUser, {})
  const ids = await t.run(async (ctx) => {
    const users = await ctx.db.query('users').collect()
    const a = users.find((u) => u.clerkId === alice.subject)!._id
    const b = users.find((u) => u.clerkId === bob.subject)!._id
    const home = await seedGroup(ctx, { name: 'Home', slug: 'home-653' })
    const shed = await seedGroup(ctx, { name: 'Shed', slug: 'shed-653' })
    await seedMember(ctx, home, a, 'admin')
    await seedMember(ctx, home, b, 'member')
    await seedMember(ctx, shed, b, 'admin')
    const list = (
      groupId: Id<'groups'>,
      name: string,
      kind?: 'groceries',
      provider: 'local' | 'todoist' = 'local',
    ) =>
      ctx.db.insert('taskLists', { groupId, name, provider, order: 0, kind })
    const groceries = await list(home, 'Boodschappen')
    const market = await list(home, 'Markt', 'groceries')
    const chores = await list(home, 'Klusjes')
    const linked = await list(home, 'Todoist', undefined, 'todoist')
    const shedGroceries = await list(shed, 'Schuur')
    await ctx.db.patch(home, { groceryListId: groceries })
    await ctx.db.patch(shed, { groceryListId: shedGroceries })
    return { a, b, home, shed, groceries, market, chores, linked, shedGroceries }
  })
  return { t, ...ids }
}

async function pair(
  t: Harness,
  {
    as = alice,
    groupSlug = 'home-653',
    installId = 'watch-install-1',
    sessionId = SESSION,
    groceryListId,
  }: {
    as?: typeof alice
    groupSlug?: string
    installId?: string
    sessionId?: string
    groceryListId?: Id<'taskLists'>
  } = {},
) {
  return await t.withIdentity(as).mutation(api.watch.pair, {
    groupSlug,
    installId,
    sessionId,
    groceryListId,
  })
}

const get = (t: Harness, module: string, key?: string) =>
  t.fetch(`/watch/v1/${module}`, {
    headers: key ? { authorization: `Bearer ${key}` } : {},
  })

const post = (t: Harness, key: string | undefined, body: unknown) =>
  t.fetch('/watch/v1/changes', {
    method: 'POST',
    headers: key ? { authorization: `Bearer ${key}` } : {},
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })

interface Result {
  key: string | null
  ok: boolean
  kind?: string
  taskId?: Id<'tasks'>
}

async function send(t: Harness, key: string, ...changes: unknown[]) {
  const response = await post(t, key, { changes })
  expect(response.status).toBe(200)
  return ((await response.json()) as { results: Result[] }).results
}

const task = (t: Harness, listId: Id<'taskLists'>, title: string, extra = {}) =>
  t.run(async (ctx) => {
    const createdBy = (await ctx.db.query('users').first())!._id
    return await ctx.db.insert('tasks', {
      listId,
      title,
      done: false,
      order: 0,
      createdBy,
      ...extra,
    })
  })

const watches = (t: Harness) =>
  t.run((ctx) => ctx.db.query('watchDevices').collect())

async function expectRefused(response: Response, status: number, kind: string) {
  expect(response.status).toBe(status)
  expect(await response.json()).toMatchObject({ kind })
}

async function refusalOf(call: Promise<unknown>) {
  const error = await call.then(
    () => null,
    (thrown: unknown) => thrown,
  )
  return readGroupRefusal(error) ?? readWatchRefusal(error) ?? String(error)
}

describe('the key', () => {
  test('is 256 random bits, and only its hash is stored', async () => {
    const { t, a, home } = await setup()
    const { key, siteUrl } = await pair(t)
    expect(key).toMatch(/^gw_[0-9a-f]{64}$/)
    expect(siteUrl).toBe(SITE)
    const [row, ...rest] = await watches(t)
    expect(rest).toEqual([])
    expect(row).toMatchObject({
      userId: a,
      groupId: home,
      installId: 'watch-install-1',
      sessionId: SESSION,
      keyHash: await hashWatchKey(key),
    })
    expect(JSON.stringify(row)).not.toContain(key.slice(3))
  })

  test('hashes to the known SHA-256', async () => {
    expect(await hashWatchKey('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  test('differs every time, and is read from a Bearer header only', () => {
    const key = newWatchKey()
    expect(newWatchKey()).not.toBe(key)
    expect(bearerKey(`Bearer ${key}`)).toBe(key)
    expect(bearerKey(`bearer ${key}`)).toBe(key)
    for (const header of [
      null,
      '',
      key,
      `Basic ${key}`,
      `Bearer ${key} x`,
      'Bearer gw_short',
    ])
      expect(bearerKey(header)).toBeNull()
  })

  test('pairing the same watch again replaces its key', async () => {
    const { t } = await setup()
    const first = await pair(t)
    const second = await pair(t)
    expect(await watches(t)).toHaveLength(1)
    await expectRefused(
      await get(t, 'modules', first.key),
      401,
      'groups:not-signed-in',
    )
    expect((await get(t, 'modules', second.key)).status).toBe(200)
  })

  test('two rows for one watch, after a merge, become one', async () => {
    const { t, a, home } = await setup()
    await t.run(async (ctx) => {
      for (const keyHash of ['x', 'y'])
        await ctx.db.insert('watchDevices', {
          userId: a,
          groupId: home,
          keyHash,
          installId: 'watch-install-1',
          createdAt: 1,
        })
    })
    await pair(t)
    expect(await watches(t)).toHaveLength(1)
  })

  test('the least recently seen watch goes when there are too many', async () => {
    const { t } = await setup()
    for (let i = 0; i <= MAX_WATCHES; i++)
      await pair(t, { installId: `watch-install-${i}` })
    const ids = (await watches(t)).map((row) => row.installId)
    expect(ids).toHaveLength(MAX_WATCHES)
    expect(ids).not.toContain('watch-install-0')
  })
})

describe('pairing', () => {
  test('refuses a signed-out caller, a stranger and an unknown Group', async () => {
    const { t } = await setup()
    const args = {
      groupSlug: 'home-653',
      installId: 'watch-install-1',
      sessionId: SESSION,
    }
    expect(await refusalOf(t.mutation(api.watch.pair, args))).toBe(
      'not-signed-in',
    )
    expect(await refusalOf(pair(t, { groupSlug: 'shed-653' }))).toBe(
      'not-a-member',
    )
    expect(await refusalOf(pair(t, { groupSlug: 'nowhere' }))).toBe(
      'unknown-slug',
    )
    expect(await watches(t)).toEqual([])
  })

  test('refuses malformed ids and lists the Group cannot use', async () => {
    const { t, chores, linked, shedGroceries } = await setup()
    expect(await refusalOf(pair(t, { installId: 'x' }))).toBe('bad-request')
    expect(await refusalOf(pair(t, { sessionId: 'nope' }))).toContain(
      'Not a session id',
    )
    for (const groceryListId of [chores, linked, shedGroceries])
      expect(await refusalOf(pair(t, { groceryListId }))).toBe('not-found')
  })

  test('is rate limited per person', async () => {
    const { t } = await setup()
    for (let i = 0; i < 20; i++) await pair(t)
    expect(await refusalOf(pair(t))).toBe('rate-limited')
    await pair(t, { as: bob })
  })

  test('refuses connected apps, on every function', async () => {
    const { t } = await setup()
    const { deviceId } = await pair(t)
    const app = t.withIdentity(connectedApp)
    const calls = [
      app.mutation(api.watch.pair, {
        groupSlug: 'home-653',
        installId: 'watch-install-1',
        sessionId: SESSION,
      }),
      app.query(api.watch.devices, {}),
      app.mutation(api.watch.revoke, { deviceId }),
      app.mutation(api.watch.forgetSession, { sessionId: SESSION }),
    ]
    for (const call of calls)
      expect(await refusalOf(call)).toContain('Connected apps cannot do this')
    expect(await watches(t)).toHaveLength(1)
  })

  test("lists the caller's own watches without a secret", async () => {
    const { t } = await setup()
    const { key, deviceId } = await pair(t)
    const listed = await t.withIdentity(alice).query(api.watch.devices, {})
    expect(listed).toMatchObject([{ deviceId, groupName: 'Home' }])
    expect(JSON.stringify(listed)).not.toContain(await hashWatchKey(key))
    expect(await t.withIdentity(bob).query(api.watch.devices, {})).toEqual([])
    expect(await t.query(api.watch.devices, {})).toEqual([])
  })
})

describe('what ends a key', () => {
  test('its Member revoking it, and nobody else', async () => {
    const { t } = await setup()
    const { key, deviceId } = await pair(t)
    expect(await refusalOf(t.mutation(api.watch.revoke, { deviceId }))).toBe(
      'not-signed-in',
    )
    await t.withIdentity(bob).mutation(api.watch.revoke, { deviceId })
    expect((await get(t, 'modules', key)).status).toBe(200)
    await t.withIdentity(alice).mutation(api.watch.revoke, { deviceId })
    await expectRefused(
      await get(t, 'modules', key),
      401,
      'groups:not-signed-in',
    )
    // Gone already is the same answer.
    await t.withIdentity(alice).mutation(api.watch.revoke, { deviceId })
  })

  test('signing out, for the watches of that session', async () => {
    const { t } = await setup()
    const { key } = await pair(t)
    const other = await pair(t, {
      installId: 'watch-install-2',
      sessionId: 'sess_other',
    })
    expect(
      await refusalOf(
        t.mutation(api.watch.forgetSession, { sessionId: SESSION }),
      ),
    ).toBe('not-signed-in')
    await t
      .withIdentity(bob)
      .mutation(api.watch.forgetSession, { sessionId: SESSION })
    expect(await watches(t)).toHaveLength(2)
    await t
      .withIdentity(alice)
      .mutation(api.watch.forgetSession, { sessionId: SESSION })
    expect((await get(t, 'modules', key)).status).toBe(401)
    expect((await get(t, 'modules', other.key)).status).toBe(200)
  })

  test("Clerk's session webhook, for that login's watches only", async () => {
    const { t } = await setup()
    await pair(t)
    await pair(t, { as: bob, installId: 'watch-install-2' })
    await t.mutation(internal.notifications.forgetSessionOf, {
      clerkId: alice.subject,
      sessionId: SESSION,
    })
    expect((await watches(t)).map((row) => row.installId)).toEqual([
      'watch-install-2',
    ])
  })

  test('a session revoked from another device', async () => {
    const { t } = await setup()
    await pair(t)
    const forget = (active: string[], ended: string[] = []) =>
      t.withIdentity(alice).mutation(api.notifications.forgetEndedSessions, {
        activeSessionIds: active,
        endedSessionIds: ended,
      })
    await forget([SESSION], [SESSION])
    // Just paired: the list may be older than its session.
    await forget(['sess_other'])
    expect(await watches(t)).toHaveLength(1)
    await forget(['sess_other'], [SESSION])
    expect(await watches(t)).toEqual([])
  })

  test('leaving the Group', async () => {
    const { t, home } = await setup()
    const { key } = await pair(t, { as: bob })
    const shed = await pair(t, {
      as: bob,
      groupSlug: 'shed-653',
      installId: 'watch-install-2',
    })
    await t
      .withIdentity(bob)
      .mutation(api.groups.leaveGroup, { groupId: home })
    expect((await get(t, 'modules', key)).status).toBe(401)
    expect((await get(t, 'modules', shed.key)).status).toBe(200)
  })

  test('a Membership that is gone, checked on every call', async () => {
    const { t, a, groceries } = await setup()
    const { key } = await pair(t)
    await t.run(async (ctx) => {
      for (const row of await ctx.db.query('memberships').collect())
        if (row.userId === a) await ctx.db.delete(row._id)
    })
    for (const module of ['modules', 'groceries', 'today', 'cards'])
      await expectRefused(await get(t, module, key), 403, 'groups:not-a-member')
    await expectRefused(
      await post(t, key, {
        changes: [{ key: 'change-1', kind: 'grocery.add', text: 'melk' }],
      }),
      403,
      'groups:not-a-member',
    )
    // The query and the write check it themselves, not only the door.
    const keyHash = await hashWatchKey(key)
    expect(
      await t.query(internal.watchReads.groceries, {
        keyHash,
        now: Date.now(),
      }),
    ).toMatchObject({ ok: false, reason: 'not-a-member' })
    expect(
      await t.mutation(internal.watchChanges.apply, {
        keyHash,
        key: 'change-1',
        change: { kind: 'grocery.add', text: 'melk' },
      }),
    ).toEqual({ ok: false, refused: 'not-a-member' })
    const rows = await t.run((ctx) =>
      ctx.db
        .query('tasks')
        .withIndex('by_list', (q) => q.eq('listId', groceries))
        .collect(),
    )
    expect(rows).toEqual([])
  })

  test('an account on its way out, before the purge reaches it', async () => {
    const { t, a } = await setup()
    const { key } = await pair(t)
    await t.run((ctx) => ctx.db.patch(a, { deletedAt: Date.now() }))
    await expectRefused(
      await get(t, 'modules', key),
      401,
      'groups:not-signed-in',
    )
  })

  test('deleting the account or the Group deletes the rows', async () => {
    const { t, a, shed } = await setup()
    await pair(t)
    await pair(t, {
      as: bob,
      groupSlug: 'shed-653',
      installId: 'watch-install-2',
    })
    await t
      .withIdentity(alice)
      .mutation(api.accounts.deleteAccount, { keepLogin: true })
    for (let i = 0; i < 30; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0))
      await t.finishInProgressScheduledFunctions()
    }
    expect(await t.run((ctx) => ctx.db.get(a))).toBeNull()
    expect((await watches(t)).map((row) => row.groupId)).toEqual([shed])
    await t
      .withIdentity(bob)
      .mutation(api.groups.deleteGroup, { groupId: shed })
    for (let i = 0; i < 30; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0))
      await t.finishInProgressScheduledFunctions()
    }
    expect(await watches(t)).toEqual([])
  })
})

describe('the door', () => {
  test('refuses no key, a malformed one and an unknown one alike', async () => {
    const { t } = await setup()
    for (const key of [undefined, 'nonsense', newWatchKey()]) {
      for (const module of ['modules', 'groceries', 'today', 'cards'])
        await expectRefused(
          await get(t, module, key),
          401,
          'groups:not-signed-in',
        )
      await expectRefused(
        await post(t, key, { changes: [] }),
        401,
        'groups:not-signed-in',
      )
    }
  })

  test('limits each watch on its own, and says when to come back', async () => {
    vi.useFakeTimers({ now: Date.now(), toFake: ['Date'] })
    const { t } = await setup()
    const { key } = await pair(t)
    const other = await pair(t, { installId: 'watch-install-2' })
    for (let i = 0; i < 120; i++)
      expect((await get(t, 'cards', key)).status).toBe(200)
    const limited = await get(t, 'cards', key)
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0)
    await expectRefused(limited, 429, 'watch:rate-limited')
    expect((await get(t, 'cards', other.key)).status).toBe(200)
    vi.setSystemTime(Date.now() + 60_000)
    expect((await get(t, 'cards', key)).status).toBe(200)
  })

  test('limits changes by how many a request carries', async () => {
    vi.useFakeTimers({ now: Date.now(), toFake: ['Date'] })
    const { t } = await setup()
    const { key } = await pair(t)
    const full = {
      changes: Array.from({ length: MAX_CHANGES }, () => ({ kind: 'x' })),
    }
    for (let i = 0; i < 6; i++)
      expect((await post(t, key, full)).status).toBe(200)
    await expectRefused(await post(t, key, full), 429, 'watch:rate-limited')
  })

  test('writes lastSeenAt at most hourly', async () => {
    vi.useFakeTimers({ now: Date.now(), toFake: ['Date'] })
    const { t } = await setup()
    const { key } = await pair(t)
    const seen = async () => {
      await get(t, 'modules', key)
      return (await watches(t))[0]!.lastSeenAt!
    }
    const first = await seen()
    vi.setSystemTime(first + LAST_SEEN_STEP_MS - 1000)
    expect(await seen()).toBe(first)
    vi.setSystemTime(first + LAST_SEEN_STEP_MS)
    expect(await seen()).toBeGreaterThanOrEqual(first + LAST_SEEN_STEP_MS)
  })
})

describe('reading', () => {
  test('answers the Modules with their versions and counts', async () => {
    const { t, groceries, chores } = await setup()
    await task(t, groceries, 'melk')
    await task(t, chores, 'ramen', { dueDate: '2020-01-01' })
    const { key } = await pair(t)
    const response = await get(t, 'modules', key)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({
      version: 1,
      group: { name: 'Home' },
      modules: [
        { id: 'groceries', version: 1, open: 1 },
        { id: 'today', version: 1, events: 0, tasks: 1 },
        { id: 'cards', version: 1, cards: 0 },
      ],
    })
  })

  test("answers the watch's list by aisle, and what is in the basket", async () => {
    const { t, groceries, market } = await setup()
    await task(t, groceries, 'melk', { category: 'dairy', quantity: 2 })
    await task(t, groceries, 'iets')
    await task(t, groceries, 'kaas', { done: true, doneAt: 2000 })
    await task(t, groceries, 'oud', { done: true, doneAt: 500 })
    await t.run((ctx) => ctx.db.patch(groceries, { checkedClearedAt: 1000 }))
    await task(t, market, 'bloemen')
    const { key } = await pair(t)
    expect(await (await get(t, 'groceries', key)).json()).toMatchObject({
      version: 1,
      list: { id: groceries, name: 'Boodschappen' },
      sections: [
        { aisle: 'dairy', items: [{ title: 'melk', quantity: 2 }] },
        { aisle: 'other', items: [{ title: 'iets' }] },
      ],
      checked: [{ title: 'kaas' }],
    })
    const other = await pair(t, { groceryListId: market })
    expect(await (await get(t, 'groceries', other.key)).json()).toMatchObject({
      list: { id: market },
      sections: [{ items: [{ title: 'bloemen' }] }],
      checked: [],
    })
  })

  test('leaves out a repeating item checked off until its next date (APP-520)', async () => {
    const { t, groceries } = await setup()
    const repeat = { mode: 'afterDone', every: 1, unit: 'week' } as const
    await task(t, groceries, 'melk')
    await task(t, groceries, 'koffie', { repeat, dueDate: '2999-01-01' })
    await task(t, groceries, 'brood', { repeat, dueDate: '2020-01-01' })
    const { key } = await pair(t)
    expect(await (await get(t, 'groceries', key)).json()).toMatchObject({
      sections: [{ items: [{ title: 'melk' }, { title: 'brood' }] }],
    })
    expect(await (await get(t, 'modules', key)).json()).toMatchObject({
      modules: [{ id: 'groceries', open: 2 }, {}, {}],
    })
  })

  test('a waiting item is back once the moment asked is its day (APP-991)', async () => {
    const { t, home, groceries } = await setup()
    const now = Date.now()
    const later = now + 24 * 3_600_000
    const zone = (await t.run((ctx) => ctx.db.get(home)))?.timeZone
    const repeat = { mode: 'afterDone', every: 1, unit: 'week' } as const
    await task(t, groceries, 'melk')
    await task(t, groceries, 'koffie', {
      repeat,
      dueDate: completionDay(undefined, zone, later),
    })
    const { key } = await pair(t)
    const keyHash = await hashWatchKey(key)
    const read = async (at: number) => {
      const answer = await t.query(internal.watchReads.groceries, {
        keyHash,
        now: at,
      })
      if (!answer.ok) throw new Error(answer.reason)
      return answer.data.sections.flatMap((s) => s.items.map((i) => i.title))
    }
    const open = async (at: number) => {
      const answer = await t.query(internal.watchReads.modules, {
        keyHash,
        now: at,
      })
      if (!answer.ok) throw new Error(answer.reason)
      return answer.data.modules[0]
    }
    expect(await read(now)).toEqual(['melk'])
    expect(await open(now)).toMatchObject({ id: 'groceries', open: 1 })
    // The same rows, asked a day later: koffie is due and back.
    expect(await read(later)).toEqual(['melk', 'koffie'])
    expect(await open(later)).toMatchObject({ id: 'groceries', open: 2 })
  })

  test("falls back to the Group's list, and to none", async () => {
    const { t, market, home, groceries } = await setup()
    const { key } = await pair(t, { groceryListId: market })
    await t
      .withIdentity(alice)
      .mutation(api.taskLists.remove, { listId: market, groupSlug: 'home-653' })
    expect((await watches(t))[0]!.groceryListId).toBeUndefined()
    expect(await (await get(t, 'groceries', key)).json()).toMatchObject({
      list: { id: groceries },
    })
    await t.run((ctx) => ctx.db.patch(home, { groceryListId: undefined }))
    expect(await (await get(t, 'groceries', key)).json()).toMatchObject({
      list: null,
      sections: [],
      checked: [],
    })
    expect(
      await send(t, key, { key: 'change-1', kind: 'grocery.add', text: 'x' }),
    ).toMatchObject([{ ok: false, kind: 'watch:not-found' }])
  })

  test("answers the day: events, due tasks, meals, tomorrow's first", async () => {
    const { t, a, home, shed, chores } = await setup()
    const today = amsterdamIsoDate(Date.now())
    const tomorrow = new Date(Date.parse(today) + 86_400_000)
      .toISOString()
      .slice(0, 10)
    await t.run(async (ctx) => {
      const calendar = (groupId: Id<'groups'>, name: string) =>
        ctx.db.insert('calendars', {
          groupId,
          name,
          source: 'local',
          createdBy: a,
        })
      const own = await calendar(home, 'Thuis')
      const hidden = await calendar(home, 'Verborgen')
      const elsewhere = await calendar(shed, 'Schuur')
      const event = (
        calendarId: Id<'calendars'>,
        title: string,
        date: string,
        startMinutes: number,
      ) =>
        ctx.db.insert('calendarEvents', {
          calendarId,
          title,
          date,
          startMinutes,
          allDay: false,
          createdBy: a,
        })
      await event(own, 'Tandarts', today, 600)
      await event(own, 'Koffie', today, 540)
      await event(hidden, 'Geheim', today, 500)
      await event(elsewhere, 'Schuurdag', today, 500)
      await event(own, 'Sport', tomorrow, 480)
      for (const row of await ctx.db.query('memberships').collect())
        if (row.userId === a && row.groupId === home)
          await ctx.db.patch(row._id, { hiddenCalendarIds: [hidden] })
      for (const [title, slot] of [
        ['Pasta', 'dinner'],
        ['Brood', 'lunch'],
      ] as const)
        await ctx.db.insert('plannedDinners', {
          groupId: home,
          date: today,
          title,
          slot,
        })
    })
    await task(t, chores, 'Te laat', { dueDate: '2020-01-01' })
    await task(t, chores, 'Vandaag', { dueDate: today })
    await task(t, chores, 'Later', { dueDate: tomorrow })
    const { key } = await pair(t)
    expect(await (await get(t, 'today', key)).json()).toMatchObject({
      version: 1,
      date: today,
      events: [{ title: 'Koffie' }, { title: 'Tandarts' }],
      tasks: [
        { title: 'Te laat', overdue: true, listName: 'Klusjes' },
        { title: 'Vandaag', overdue: false },
      ],
      meals: [{ title: 'Brood' }, { title: 'Pasta' }],
      tomorrow: { title: 'Sport' },
    })
  })

  test("answers the Group's own cards with bars, or a bare number", async () => {
    const { t, a, home, shed } = await setup()
    await t.run(async (ctx) => {
      const card = (
        groupId: Id<'groups'>,
        storeName: string,
        barcodeFormat: BarcodeFormat,
        cardNumber: string,
      ) =>
        ctx.db.insert('loyaltyCards', {
          groupId,
          storeName,
          barcodeFormat,
          cardNumber,
          createdByUserId: a,
        })
      await card(home, 'A', 'EAN_13', '8712345678906')
      await card(home, 'B', 'QR', 'hello')
      await card(home, 'C', 'EAN_13', 'broken')
      await card(shed, 'D', 'QR', 'secret')
    })
    const { key } = await pair(t)
    const { cards } = (await (await get(t, 'cards', key)).json()) as {
      cards: { storeName: string; number: string; barcode: unknown }[]
    }
    expect(cards).toMatchObject([
      { storeName: 'A', barcode: { quietLeft: 11, quietRight: 7 } },
      { storeName: 'B', barcode: { size: 21, quiet: 4 } },
      { storeName: 'C', number: 'broken', barcode: null },
    ])
  })
})

describe('barcodes', () => {
  const VALUES: Record<BarcodeFormat, string> = {
    EAN_13: '8712345678906',
    EAN_8: '96385074',
    UPC_A: '036000291452',
    UPC_E: '01234565',
    CODE_128: 'ABC-123',
    CODE_39: 'ABC 123',
    CODE_93: 'ABC 123',
    CODABAR: '12345',
    ITF: '1234',
    QR: 'hello',
    PDF417: 'hello',
    AZTEC: 'hello',
    DATA_MATRIX: 'hello',
  }

  test.each(BARCODE_FORMATS)('%s encodes in whole modules', (format) => {
    const code = watchBarcode(format, VALUES[format])
    if (!code) throw new Error('did not encode')
    if ('sbs' in code) {
      expect(code.sbs.every((w) => Number.isInteger(w) && w > 0)).toBe(true)
      expect(code.bhs).toHaveLength(Math.ceil(code.sbs.length / 2))
      expect(code.bbs).toHaveLength(code.bhs.length)
      // Guard bars are flat: every bar is as tall as the next.
      expect(new Set(code.bhs).size).toBe(1)
      expect(new Set(code.bbs)).toEqual(new Set([0]))
      expect(Math.min(code.quietLeft, code.quietRight)).toBeGreaterThan(0)
    } else {
      expect(code.pixs.length % code.size).toBe(0)
      expect(code.pixs.every((m) => m === 0 || m === 1)).toBe(true)
      expect(code.quiet).toBeGreaterThan(0)
    }
  })

  test('an EAN-13 is 95 modules wide', () => {
    const code = watchBarcode('EAN_13', VALUES.EAN_13)
    if (!code || !('sbs' in code)) throw new Error('not linear')
    expect(code.sbs.reduce((sum, width) => sum + width, 0)).toBe(95)
  })

  test('PDF417 rows are three square modules tall', () => {
    const code = watchBarcode('PDF417', VALUES.PDF417)
    if (!code || !('pixs' in code)) throw new Error('not a matrix')
    const rows = Array.from({ length: code.pixs.length / code.size }, (_, i) =>
      code.pixs.slice(i * code.size, (i + 1) * code.size).join(''),
    )
    expect(rows.length % 3).toBe(0)
    for (let i = 0; i < rows.length; i += 3)
      expect(new Set(rows.slice(i, i + 3)).size).toBe(1)
  })

  test('a number that does not encode is null', () => {
    expect(watchBarcode('EAN_13', '8712345678901')).toBeNull()
  })
})

describe('changes', () => {
  const row = (t: Harness, id: Id<'tasks'>) => t.run((ctx) => ctx.db.get(id))

  test('adds a line through the recognition, once per key', async () => {
    const { t, a, groceries } = await setup()
    const { key } = await pair(t)
    const add = {
      key: 'change-1',
      kind: 'grocery.add',
      text: ' 2  pakken melk ',
    }
    const [first] = await send(t, key, add)
    const [again] = await send(t, key, add)
    expect(again).toEqual(first)
    const rows = await t.run((ctx) => ctx.db.query('tasks').collect())
    expect(rows).toMatchObject([
      {
        listId: groceries,
        title: 'melk',
        quantity: 2,
        unit: 'pak',
        category: 'dairy',
        createdBy: a,
      },
    ])
    // Deleted since: a late retry does not bring it back.
    await t.run((ctx) => ctx.db.delete(rows[0]!._id))
    expect(await send(t, key, add)).toEqual([first])
    expect(await t.run((ctx) => ctx.db.query('tasks').collect())).toEqual([])
  })

  test('sends a repeated key within one outbox once', async () => {
    const { t } = await setup()
    const { key } = await pair(t)
    const add = { key: 'change-1', kind: 'grocery.add', text: 'melk' }
    await send(t, key, add, add)
    expect(await t.run((ctx) => ctx.db.query('tasks').collect())).toHaveLength(1)
  })

  test('a receipt outlives re-pairing the watch', async () => {
    const { t } = await setup()
    const add = { key: 'change-1', kind: 'grocery.add', text: 'melk' }
    await send(t, (await pair(t)).key, add)
    await send(t, (await pair(t)).key, add)
    expect(await t.run((ctx) => ctx.db.query('tasks').collect())).toHaveLength(1)
  })

  test('checks and unchecks, and a late retry undoes nobody', async () => {
    const { t, groceries } = await setup()
    const id = await task(t, groceries, 'melk')
    const { key } = await pair(t)
    const check = { key: 'change-1', kind: 'grocery.check', taskId: id }
    expect(await send(t, key, check)).toMatchObject([{ ok: true, taskId: id }])
    expect(await row(t, id)).toMatchObject({
      done: true,
      doneAt: expect.any(Number),
    })
    await send(t, key, { key: 'change-2', kind: 'grocery.uncheck', taskId: id })
    expect((await row(t, id))?.done).toBe(false)
    await send(t, key, check)
    expect((await row(t, id))?.done).toBe(false)
  })

  test('checking puts a running-low staple back in stock', async () => {
    const { t, a, home, groceries } = await setup()
    const id = await task(t, groceries, 'melk')
    const staple = await t.run((ctx) =>
      ctx.db.insert('groceryStaples', {
        groupId: home,
        name: 'Melk',
        key: 'melk',
        aisle: 'dairy',
        low: true,
        createdBy: a,
      }),
    )
    const { key } = await pair(t)
    await send(t, key, { key: 'change-1', kind: 'grocery.check', taskId: id })
    expect((await t.run((ctx) => ctx.db.get(staple)))?.low).toBe(false)
  })

  test('completes a task, and a repeating one exactly once', async () => {
    const { t, a, chores } = await setup()
    const once = await task(t, chores, 'ramen')
    const weekly = await task(t, chores, 'afval', {
      dueDate: '2026-01-05',
      repeat: { mode: 'fixed', unit: 'week', every: 1 },
    })
    const { key } = await pair(t)
    const done = {
      key: 'change-2',
      kind: 'task.done',
      taskId: weekly,
      occurrence: '2026-01-05',
    }
    await send(
      t,
      key,
      { key: 'change-1', kind: 'task.done', taskId: once },
      done,
    )
    expect((await row(t, once))?.done).toBe(true)
    const moved = await row(t, weekly)
    expect(moved?.done).toBe(false)
    expect(moved?.dueDate).not.toBe('2026-01-05')
    await send(t, key, done)
    // A second watch, with its own key, saw the same occurrence.
    const other = await pair(t, { as: bob, installId: 'watch-install-2' })
    await send(t, other.key, done)
    expect((await row(t, weekly))?.dueDate).toBe(moved?.dueDate)
    const completions = await t.run((ctx) =>
      ctx.db.query('taskCompletions').collect(),
    )
    expect(completions).toMatchObject([{ completedBy: a }])
  })

  test('cannot touch another Group, and says the same as for nothing', async () => {
    const { t, shedGroceries, chores, linked } = await setup()
    // Bob is in both Groups; his watch is paired with Home.
    const elsewhere = await task(t, shedGroceries, 'schroeven')
    const chore = await task(t, chores, 'ramen')
    const external = await task(t, linked, 'extern')
    const gone = await task(t, chores, 'weg')
    await t.run((ctx) => ctx.db.delete(gone))
    const { key } = await pair(t, { as: bob })
    const results = await send(
      t,
      key,
      { key: 'change-1', kind: 'grocery.check', taskId: elsewhere },
      { key: 'change-2', kind: 'task.done', taskId: elsewhere },
      { key: 'change-3', kind: 'task.done', taskId: gone },
      { key: 'change-4', kind: 'task.done', taskId: 'no-such-id' },
      { key: 'change-5', kind: 'grocery.check', taskId: chore },
      { key: 'change-6', kind: 'task.done', taskId: external },
    )
    expect(results.map((result) => result.kind)).toEqual([
      'watch:not-found',
      'watch:not-found',
      'watch:not-found',
      'watch:not-found',
      'watch:not-found',
      'watch:read-only',
    ])
    expect((await row(t, elsewhere))?.done).toBe(false)
    expect((await row(t, chore))?.done).toBe(false)
    // A refused change leaves no receipt.
    expect(
      await t.run((ctx) => ctx.db.query('idempotencyKeys').collect()),
    ).toEqual([])
  })

  test('refuses a key reused for another item', async () => {
    const { t, groceries } = await setup()
    const melk = await task(t, groceries, 'melk')
    const kaas = await task(t, groceries, 'kaas')
    const { key } = await pair(t)
    const results = await send(
      t,
      key,
      { key: 'change-1', kind: 'grocery.check', taskId: melk },
      { key: 'change-1', kind: 'grocery.check', taskId: kaas },
    )
    expect(results[1]).toMatchObject({ ok: false, kind: 'watch:key-reused' })
    expect((await row(t, kaas))?.done).toBe(false)
  })

  test("a person's key is their own", async () => {
    const { t } = await setup()
    const add = { key: 'change-1', kind: 'grocery.add', text: 'melk' }
    await send(t, (await pair(t)).key, add)
    await send(
      t,
      (await pair(t, { as: bob, installId: 'watch-install-2' })).key,
      add,
    )
    expect(await t.run((ctx) => ctx.db.query('tasks').collect())).toHaveLength(2)
  })

  test('a malformed change does not hold up the rest', async () => {
    const { t } = await setup()
    const { key } = await pair(t)
    const bad = [
      null,
      'text',
      { kind: 'grocery.add', text: 'melk' },
      { key: 'short', kind: 'grocery.add', text: 'melk' },
      { key: 'change-1', kind: 'grocery.delete', taskId: 'x' },
      { key: 'change-1', kind: 'grocery.add', text: '   ' },
      { key: 'change-1', kind: 'grocery.add', text: 'x'.repeat(201) },
      { key: 'change-1', kind: 'grocery.check', taskId: 5 },
      { key: 'change-1', kind: 'task.done', taskId: 'x', occurrence: 5 },
    ]
    const results = await send(t, key, ...bad, {
      key: 'change-1',
      kind: 'grocery.add',
      text: 'melk',
    })
    expect(results.slice(0, -1).map((result) => result.kind)).toEqual(
      bad.map(() => 'watch:bad-request'),
    )
    expect(results.at(-1)).toMatchObject({ ok: true })
  })

  test('a change the app itself refuses is final', async () => {
    const { t, chores } = await setup()
    const parent = await task(t, chores, 'poetsen')
    const id = await task(t, chores, 'ramen', {
      parentTaskId: parent,
      dueDate: '2026-01-05',
      repeat: { mode: 'fixed', unit: 'week', every: 1 },
    })
    const { key } = await pair(t)
    const done = { key: 'change-1', kind: 'task.done', taskId: id }
    expect(await send(t, key, done)).toMatchObject([
      { ok: false, kind: 'watch:bad-request' },
    ])
  })

  test('refuses a body that is not an outbox', async () => {
    const { t } = await setup()
    const { key } = await pair(t)
    for (const body of [
      'not json',
      [],
      {},
      { changes: [] },
      { changes: Array.from({ length: MAX_CHANGES + 1 }, () => ({})) },
    ])
      await expectRefused(await post(t, key, body), 400, 'watch:bad-request')
    await expectRefused(
      await post(t, key, 'x'.repeat(64 * 1024 + 1)),
      413,
      'watch:bad-request',
    )
  })
})
