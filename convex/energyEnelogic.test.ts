// @vitest-environment node
import { enelogicMoment } from '@gather/core/energy'
import { readEnergyRefusal } from '@gather/core/refusals'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { alice, bob } from '../test/convexHarness'
import {
  HOME,
  insertManualMeters,
  insertSite,
  seedEnergyGroups,
} from '../test/energyUsageFixture'
import { api, internal } from './_generated/api'
import type { Doc } from './_generated/dataModel'

/**
 * The Enelogic connector end to end (APP-497): the real actions against a
 * fake Enelogic behind `fetch`, which rotates its refresh tokens the way an
 * OAuth2 server may.
 */

vi.mock('./lib/energyWritePace', () => ({
  writePauseMs: () => 0,
  pacedWrite: async (_rows: number, write: () => Promise<unknown>) =>
    await write(),
}))

const HOUR = 3_600_000
const DAY = 24 * HOUR
const NOW = Date.UTC(2026, 10, 20, 9, 25)
const THIS_HOUR = Date.UTC(2026, 10, 20, 9)
const AMS = 'Europe/Amsterdam'
const REDIRECT = 'http://localhost:5173/integrations/callback'

/** Local wall time in Amsterdam, as Enelogic writes it. */
const local = (at: number) =>
  new Intl.DateTimeFormat('sv-SE', {
    timeZone: AMS,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(at))

/** Each register's running total: a steady amount per hour. */
const PER_HOUR: Record<string, number> = {
  '11:181': 0.25,
  '11:182': 0.5,
  '12:180': 0.1,
}
const total = (ref: string, at: number) =>
  ((PER_HOUR[ref] ?? 0) * at) / HOUR

function fakeEnelogic() {
  const state = {
    refresh: new Set<string>(),
    access: new Set<string>(),
    issued: 0,
    revoked: false,
    calls: [] as string[],
  }
  const issue = () => {
    state.issued += 1
    const access = `access-${state.issued}`
    const refresh = `refresh-${state.issued}`
    state.access = new Set([access])
    state.refresh = new Set([refresh])
    return { access_token: access, refresh_token: refresh, expires_in: 3600 }
  }
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })

  const fetch = async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    state.calls.push(url.pathname)
    if (url.pathname === '/oauth/v2/token') {
      const form = new URLSearchParams(String(init?.body))
      if (
        form.get('client_id') !== 'client-id' ||
        form.get('client_secret') !== 'client-secret'
      ) {
        return json({ error: 'invalid_client' }, 401)
      }
      if (state.revoked) return json({ error: 'invalid_grant' }, 400)
      if (form.get('grant_type') === 'authorization_code') {
        return form.get('code') === 'good-code' &&
          form.get('redirect_uri') === REDIRECT
          ? json(issue())
          : json({ error: 'invalid_grant' }, 400)
      }
      const refresh = form.get('refresh_token') ?? ''
      return state.refresh.has(refresh)
        ? json(issue())
        : json({ error: 'invalid_grant' }, 400)
    }
    const bearer = new Headers(init?.headers).get('Authorization') ?? ''
    if (!state.access.has(bearer.replace('Bearer ', ''))) {
      return json({ error: 'invalid_token' }, 401)
    }
    const path = url.pathname.replace(/^\/api/, '')
    if (path === '/measuringpoints/') {
      return json([
        { id: 11, label: 'Stroom', dayMax: '2026-11-20 00:00:00', timezone: AMS },
        { id: 12, label: 'Gas', unitType: 1, dayMax: '2026-11-20 00:00:00' },
      ])
    }
    const match =
      /^\/measuringpoints\/(\d+)\/(datapoints|datapoint\/days)\/(\S+)\/(\S+)$/.exec(
        path,
      )
    if (!match) return json({ error: 'not found' }, 404)
    const [, point, , from, to] = match
    const rates = point === '11' ? [181, 182] : point === '12' ? [180] : []
    if (rates.length === 0) return json({ error: 'not found' }, 404)
    const start = enelogicMoment(`${from} 00:00:00`, AMS) ?? 0
    const end = Math.min(
      (enelogicMoment(`${to} 00:00:00`, AMS) ?? 0) + DAY,
      Date.now(),
    )
    const rows = []
    for (let at = start; at <= end; at += HOUR) {
      for (const rate of rates) {
        rows.push({
          id: rows.length,
          quantity: total(`${point}:${rate}`, at).toFixed(4),
          rate,
          [match[2] === 'datapoints' ? 'datetime' : 'date']: local(at),
        })
      }
    }
    return json(rows)
  }
  return { state, fetch }
}

let fake: ReturnType<typeof fakeEnelogic>

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
  vi.stubEnv('ENELOGIC_CLIENT_ID', 'client-id')
  vi.stubEnv('ENELOGIC_CLIENT_SECRET', 'client-secret')
  fake = fakeEnelogic()
  vi.stubGlobal('fetch', vi.fn(fake.fetch))
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

async function seed() {
  const seeded = await seedEnergyGroups()
  const siteId = await seeded.t.run((ctx) =>
    insertSite(ctx, seeded.homeId, seeded.aliceId),
  )
  return { ...seeded, siteId, as: seeded.t.withIdentity(alice) }
}
type Seeded = Awaited<ReturnType<typeof seed>>

async function settle(t: Seeded['t']) {
  await new Promise((resolve) => setTimeout(resolve, 5))
  await t.finishInProgressScheduledFunctions()
}

const rows = <T extends 'energyIntervals' | 'energyChannels' | 'energySources'>(
  t: Seeded['t'],
  table: T,
): Promise<Doc<T>[]> =>
  t.run((ctx) => ctx.db.query(table).collect()) as Promise<Doc<T>[]>

async function refusalOf(promise: Promise<unknown>) {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  )
  return readEnergyRefusal(error)
}

async function signIn({ as }: Pick<Seeded, 'as'>) {
  await as.action(api.energyEnelogic.completeOAuth, {
    ...HOME,
    code: 'good-code',
    redirectUri: REDIRECT,
  })
}

const SPLIT = [
  { kind: 'gridImport', tariff: 't1', statisticId: '11:181' },
  { kind: 'gridImport', tariff: 't2', statisticId: '11:182' },
] as const

describe('signing in', () => {
  test('builds the authorize URL with the client and the round trip', async () => {
    const { as } = await seed()
    const url = new URL(
      await as.action(api.energyEnelogic.authorizeUrl, {
        ...HOME,
        redirectUri: REDIRECT,
        state: 'enelogic.abc',
      }),
    )
    expect(url.origin + url.pathname).toBe('https://enelogic.com/oauth/v2/auth')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: 'client-id',
      response_type: 'code',
      scope: 'account',
      redirect_uri: REDIRECT,
      state: 'enelogic.abc',
    })
  })

  test('is for admins only', async () => {
    const { t } = await seed()
    expect(
      await refusalOf(
        t.withIdentity(bob).action(api.energyEnelogic.authorizeUrl, {
          ...HOME,
          redirectUri: REDIRECT,
          state: 'enelogic.abc',
        }),
      ),
    ).toBe('adminOnly')
  })

  test('without a client, says Enelogic is not set up', async () => {
    const { as } = await seed()
    vi.stubEnv('ENELOGIC_CLIENT_SECRET', '')
    expect(
      await refusalOf(
        as.action(api.energyEnelogic.authorizeUrl, {
          ...HOME,
          redirectUri: REDIRECT,
          state: 'enelogic.abc',
        }),
      ),
    ).toBe('enelogicNotConfigured')
  })

  test('stores the refresh token server-side only', async () => {
    const seeded = await seed()
    await signIn(seeded)
    const [source] = (await rows(seeded.t, 'energySources')).filter(
      (each) => each.kind === 'enelogic',
    )
    expect(source).toMatchObject({
      label: 'Enelogic',
      status: 'ok',
      secret: 'refresh-1',
      connectedByUserId: seeded.aliceId,
    })
    const list = await seeded.as.query(api.energySources.list, HOME)
    expect(JSON.stringify(list)).not.toContain('refresh-1')
    expect(list?.sources.find((each) => each.kind === 'enelogic')).toMatchObject(
      { connected: true, channelCount: 0 },
    )
  })

  test('a refused code stores nothing', async () => {
    const { t, as } = await seed()
    expect(
      await refusalOf(
        as.action(api.energyEnelogic.completeOAuth, {
          ...HOME,
          code: 'bad-code',
          redirectUri: REDIRECT,
        }),
      ),
    ).toBe('enelogicRefused')
    expect(await rows(t, 'energySources')).toEqual([])
  })
})

describe('picking channels', () => {
  test('proposes both tariffs of the power point and the gas point', async () => {
    const seeded = await seed()
    await signIn(seeded)
    const tested = await seeded.as.action(api.energyEnelogic.test, HOME)
    expect(
      tested.proposals.map((each) => [
        each.kind,
        each.tariff,
        each.statisticId,
        each.on,
      ]),
    ).toEqual([
      ['gridImport', 't1', '11:181', true],
      ['gridImport', 't2', '11:182', true],
      ['gas', undefined, '12:180', true],
    ])
    expect(tested.statistics.map((each) => each.id)).toEqual([
      '11:181',
      '11:182',
      '12:180',
    ])
    // The token rotated, and the new one is the one stored.
    const [source] = await rows(seeded.t, 'energySources')
    expect(source?.secret).toBe('refresh-2')
  })

  test('a channel a typed meter supplies starts off, and says so', async () => {
    const seeded = await seed()
    await seeded.t.run((ctx) =>
      insertManualMeters(ctx, seeded.homeId, seeded.siteId, seeded.aliceId),
    )
    await signIn(seeded)
    const tested = await seeded.as.action(api.energyEnelogic.test, HOME)
    expect(tested.proposals.every((each) => !each.on)).toBe(true)
    expect(tested.proposals[0]?.suppliedBy).not.toBeNull()
  })

  test('refuses a register that does not read the channel', async () => {
    const seeded = await seed()
    await signIn(seeded)
    expect(
      await refusalOf(
        seeded.as.action(api.energyEnelogic.connect, {
          ...HOME,
          channels: [{ kind: 'gas', statisticId: '11:181' }],
          history: false,
        }),
      ),
    ).toBe('registerNotFound')
  })

  test('without signing in, there is nothing to read', async () => {
    const { as } = await seed()
    expect(await refusalOf(as.action(api.energyEnelogic.test, HOME))).toBe(
      'enelogicNotConnected',
    )
  })
})

describe('reading', () => {
  test('imports history, then reads only the new hours', async () => {
    const seeded = await seed()
    await signIn(seeded)
    await seeded.as.action(api.energyEnelogic.connect, {
      ...HOME,
      channels: [...SPLIT],
      history: true,
    })
    await settle(seeded.t)

    const channels = await rows(seeded.t, 'energyChannels')
    const t1 = channels.find((each) => each.externalRef === '11:181')
    expect(t1).toMatchObject({ kind: 'gridImport', tariff: 't1' })
    const intervals = await rows(seeded.t, 'energyIntervals')
    const own = intervals.filter((each) => each.channelId === t1?._id)
    // A year of hours, each the steady 0.25 kWh, up to the last whole hour.
    // Only the hour October's clock change repeats reads as one of two.
    expect(own.length).toBeGreaterThan(360 * 24)
    expect(own.filter((each) => each.amount !== 0.25)).toEqual([
      expect.objectContaining({
        hourStart: Date.UTC(2026, 9, 25, 1),
        amount: 0.5,
      }),
    ])
    expect(Math.max(...own.map((each) => each.hourStart))).toBe(
      THIS_HOUR - HOUR,
    )
    const [source] = await rows(seeded.t, 'energySources')
    expect(source?.status).toBe('ok')
    expect(source?.lastSyncedAt).toBeGreaterThanOrEqual(NOW)

    // Three hours on: one call per point, and three new hours.
    vi.setSystemTime(NOW + 3 * HOUR)
    fake.state.calls = []
    await seeded.t.mutation(internal.energySources.startSyncs, {
      kind: 'enelogic',
    })
    await settle(seeded.t)
    expect(fake.state.calls).toEqual([
      '/oauth/v2/token',
      '/api/measuringpoints/11/datapoints/2026-11-20/2026-11-21',
    ])
    const after = (await rows(seeded.t, 'energyIntervals')).filter(
      (each) => each.channelId === t1?._id,
    )
    expect(after.length - own.length).toBe(3)
  })

  test('a revoked grant asks an admin to sign in again', async () => {
    const seeded = await seed()
    await signIn(seeded)
    await seeded.as.action(api.energyEnelogic.connect, {
      ...HOME,
      channels: [...SPLIT],
      history: false,
    })
    await settle(seeded.t)
    fake.state.revoked = true
    await seeded.t.mutation(internal.energySources.startSyncs, {
      kind: 'enelogic',
    })
    await settle(seeded.t)
    const [source] = await rows(seeded.t, 'energySources')
    expect(source).toMatchObject({
      status: 'needsReconnect',
      lastError: 'enelogicRevoked',
    })
    // The cron leaves it alone until then.
    fake.state.calls = []
    await seeded.t.mutation(internal.energySources.startSyncs, {
      kind: 'enelogic',
    })
    await settle(seeded.t)
    expect(fake.state.calls).toEqual([])

    // Signing in again picks up where it was.
    fake.state.revoked = false
    await signIn(seeded)
    await settle(seeded.t)
    const [again] = await rows(seeded.t, 'energySources')
    expect(again).toMatchObject({ status: 'ok' })
    expect(again?.lastError).toBeUndefined()
  })

  test('a run that loses the token to another one stops quietly', async () => {
    const seeded = await seed()
    await signIn(seeded)
    await seeded.as.action(api.energyEnelogic.connect, {
      ...HOME,
      channels: [...SPLIT],
      history: false,
    })
    await settle(seeded.t)
    const [source] = await rows(seeded.t, 'energySources')
    if (!source) throw new Error('no source')
    // Another run rotated the token after this one read it.
    const stale = source.secret ?? ''
    await seeded.t.run((ctx) =>
      ctx.db.patch(source._id, { secret: 'refresh-elsewhere' }),
    )
    fake.state.refresh = new Set(['refresh-elsewhere'])
    expect(
      await seeded.t.mutation(internal.energyEnelogic.rotateSecret, {
        sourceId: source._id,
        from: stale,
        to: 'refresh-mine',
      }),
    ).toBe(false)
    await seeded.t.action(internal.energyEnelogic.syncSource, {
      sourceId: source._id,
    })
    const [after] = await rows(seeded.t, 'energySources')
    expect(after?.status).toBe('ok')
  })

  test('a run that started before a new sign-in says nothing', async () => {
    const seeded = await seed()
    await signIn(seeded)
    await settle(seeded.t)
    const [source] = await rows(seeded.t, 'energySources')
    if (!source) throw new Error('no source')
    await seeded.t.mutation(internal.energyEnelogic.finishSync, {
      sourceId: source._id,
      secret: 'refresh-before',
      problem: 'enelogicRevoked',
      missing: [],
    })
    const [after] = await rows(seeded.t, 'energySources')
    expect(after?.status).toBe('ok')
  })

  test('a refused client is not a revoked grant', async () => {
    const seeded = await seed()
    await signIn(seeded)
    await seeded.as.action(api.energyEnelogic.connect, {
      ...HOME,
      channels: [...SPLIT],
      history: false,
    })
    await settle(seeded.t)
    vi.stubEnv('ENELOGIC_CLIENT_SECRET', 'rotated-elsewhere')
    await seeded.t.mutation(internal.energySources.startSyncs, {
      kind: 'enelogic',
    })
    await settle(seeded.t)
    const [source] = await rows(seeded.t, 'energySources')
    expect(source).toMatchObject({
      status: 'error',
      lastError: 'enelogicUnreachable',
    })
  })

  test('disconnecting forgets the token and keeps what was read', async () => {
    const seeded = await seed()
    await signIn(seeded)
    await seeded.as.action(api.energyEnelogic.connect, {
      ...HOME,
      channels: [...SPLIT],
      history: false,
    })
    await settle(seeded.t)
    vi.setSystemTime(NOW + 2 * HOUR)
    await seeded.t.mutation(internal.energySources.startSyncs, {
      kind: 'enelogic',
    })
    await settle(seeded.t)
    const read = (await rows(seeded.t, 'energyIntervals')).length
    expect(read).toBeGreaterThan(0)
    await seeded.as.mutation(api.energySources.disconnect, {
      ...HOME,
      kind: 'enelogic',
    })
    const [source] = await rows(seeded.t, 'energySources')
    expect(source?.secret).toBeUndefined()
    expect((await rows(seeded.t, 'energyIntervals')).length).toBe(read)
  })
})
