// @vitest-environment node
import { ENERGY_CHANNEL_ORDER } from '@gather/core/energy'
import { readEnergyRefusal } from '@gather/core/refusals'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { alice, bob, carol } from '../test/convexHarness'
import {
  HOME,
  insertManualMeters,
  insertReading,
  insertSite,
  OTHER,
  seedEnergyGroups,
} from '../test/energyUsageFixture'
import {
  closedPort,
  counter,
  type FakeHomeAssistant,
  startFakeHomeAssistant,
} from '../test/fakeHomeAssistant'
import { api, internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'

/**
 * The Home Assistant connector end to end (APP-495): the real actions and
 * the real WebSocket client, against a fake server on this machine. Only
 * where the socket goes is replaced, because the real one refuses an address
 * that is not public; `lib/homeAssistantAddress.test.ts` covers that.
 */

const target = vi.hoisted(() => ({ url: '' }))
vi.mock('./lib/homeAssistantAddress', () => ({
  homeAssistantSocket: () => ({ url: target.url, options: {} }),
}))
/** How many rows each write was paced for; the pause itself is not waited. */
const paced = vi.hoisted(() => [] as number[])
vi.mock('./lib/energyWritePace', () => ({
  writePauseMs: () => 0,
  pacedWrite: async (rows: number, write: () => Promise<unknown>) => {
    paced.push(rows)
    return await write()
  },
}))

const HOUR = 3_600_000
const DAY = 24 * HOUR
const NOW = Date.UTC(2026, 10, 20, 9, 25)
const THIS_HOUR = Date.UTC(2026, 10, 20, 9)
const ADDRESS = 'https://ha.example.com'
const TOKEN = 'fake-token'
const CONNECTION = { ...HOME, address: ADDRESS, token: TOKEN }

let fake: FakeHomeAssistant

beforeEach(async () => {
  // Only the clock: the socket needs real timers.
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
  fake = await startFakeHomeAssistant()
  target.url = fake.url
})
afterEach(async () => {
  await fake.stop()
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

const IMPORT = { kind: 'gridImport', statisticId: 'sensor.zonneplan_import' } as const
const GAS = { kind: 'gas', statisticId: 'sensor.p1_gas' } as const

/** Connect without history and run the first sync it schedules. */
async function connect(
  { t, as }: Pick<Seeded, 't' | 'as'>,
  channels: {
    kind: Doc<'energyChannels'>['kind']
    tariff?: 't1' | 't2'
    statisticId: string
  }[] = [IMPORT],
  history = false,
) {
  await as.action(api.energyHomeAssistant.connect, {
    ...CONNECTION,
    channels,
    history,
  })
  await settle(t)
}

/** Run what is due now; a retry an hour away stays scheduled. */
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
  return { code: readEnergyRefusal(error), error }
}

describe('testing a connection', () => {
  test('answers the version and the dashboard’s channels', async () => {
    const { as } = await seed()
    const tested = await as.action(api.energyHomeAssistant.test, CONNECTION)
    expect(tested.version).toBe('2026.11.2')
    expect(tested.hasDashboard).toBe(true)
    expect(
      tested.proposals.map((each) => [each.kind, each.tariff, each.on]),
    ).toEqual([
      ['gridImport', 't1', true],
      ['gridImport', 't2', true],
      ['gridExport', 't1', true],
      ['gridExport', 't2', true],
      ['solar', undefined, true],
      ['batteryCharge', undefined, true],
      ['batteryDischarge', undefined, true],
      ['gas', undefined, true],
    ])
    expect(tested.proposals[7]?.statisticId).toBe('sensor.p1_gas')
    // To pick another sensor from; never a temperature.
    expect(tested.statistics.map((each) => each.id)).toContain(
      'sensor.zonneplan_import',
    )
    expect(tested.statistics.map((each) => each.id)).not.toContain(
      'sensor.outside_temperature',
    )
  })

  test('saves nothing and returns no token', async () => {
    const { t, as } = await seed()
    const tested = await as.action(api.energyHomeAssistant.test, CONNECTION)
    expect(JSON.stringify(tested)).not.toContain(TOKEN)
    expect(await rows(t, 'energySources')).toEqual([])
  })

  test('a channel another source supplies starts off', async () => {
    const seeded = await seed()
    await seeded.t.run((ctx) =>
      insertManualMeters(ctx, seeded.homeId, seeded.siteId, seeded.aliceId),
    )
    const tested = await seeded.as.action(api.energyHomeAssistant.test, CONNECTION)
    const of = (kind: string) => tested.proposals.find((each) => each.kind === kind)
    expect(of('gas')).toMatchObject({ on: false, suppliedBy: 'Meterstanden' })
    expect(of('solar')).toMatchObject({ on: true, suppliedBy: null })
  })

  test('a proposed sensor without a statistic is named unavailable and off', async () => {
    const { as } = await seed()
    fake.statistics = fake.statistics.filter(
      (each) => each.statistic_id !== 'sensor.solar_total',
    )
    const tested = await as.action(api.energyHomeAssistant.test, CONNECTION)
    expect(tested.proposals.find((each) => each.kind === 'solar')).toMatchObject({
      available: false,
      on: false,
    })
  })

  test('says so when there is no Energy dashboard', async () => {
    const { as } = await seed()
    fake.prefs = null
    expect(
      await as.action(api.energyHomeAssistant.test, CONNECTION),
    ).toMatchObject({ hasDashboard: false, proposals: [] })
  })

  test('refuses in words for a wrong token, without repeating it', async () => {
    const { as } = await seed()
    const { code, error } = await refusalOf(
      as.action(api.energyHomeAssistant.test, { ...CONNECTION, token: 'wrong-one' }),
    )
    expect(code).toBe('sourceBadToken')
    expect(String(error) + JSON.stringify(error)).not.toContain('wrong-one')
  })

  test('refuses in words when nothing answers', async () => {
    const { as } = await seed()
    target.url = `ws://127.0.0.1:${await closedPort()}/api/websocket`
    const { code, error } = await refusalOf(
      as.action(api.energyHomeAssistant.test, CONNECTION),
    )
    expect(code).toBe('sourceUnreachable')
    expect(String(error) + JSON.stringify(error)).not.toContain(TOKEN)
  })

  test('refuses in words when something else answers', async () => {
    const { as } = await seed()
    target.url = fake.url.replace('/api/websocket', '/other')
    expect(
      (await refusalOf(as.action(api.energyHomeAssistant.test, CONNECTION))).code,
    ).toBe('sourceNotHomeAssistant')
  })

  test('distinguishes a refused command from not Home Assistant', async () => {
    const { as } = await seed()
    fake.refuseCommand['recorder/list_statistic_ids'] = 'unauthorized'
    expect(
      (await refusalOf(as.action(api.energyHomeAssistant.test, CONNECTION))).code,
    ).toBe('sourceRefused')
    fake.refuseCommand = { 'energy/get_prefs': 'home_assistant_error' }
    expect(
      (await refusalOf(as.action(api.energyHomeAssistant.test, CONNECTION))).code,
    ).toBe('sourceRefused')
  })

  test('refuses an address that is not https or not public before connecting', async () => {
    const { as } = await seed()
    for (const [address, code] of [
      ['http://ha.example.com', 'addressNotHttps'],
      ['https://192.168.1.10:8123', 'addressPrivate'],
      ['https://homeassistant.local:8123', 'addressPrivate'],
      ['https://user:pass@ha.example.com', 'addressInvalid'],
    ] as const) {
      expect(
        (
          await refusalOf(
            as.action(api.energyHomeAssistant.test, { ...CONNECTION, address }),
          )
        ).code,
      ).toBe(code)
    }
    expect(fake.connections).toBe(0)
  })

  test('the stored token goes only to the address it was stored for', async () => {
    const seeded = await seed()
    await connect(seeded)
    const { token: _, ...tokenless } = CONNECTION
    const before = fake.connections
    expect(
      (
        await refusalOf(
          seeded.as.action(api.energyHomeAssistant.test, {
            ...tokenless,
            address: 'https://evil.example.com',
          }),
        )
      ).code,
    ).toBe('tokenNeeded')
    expect(fake.connections).toBe(before)
    expect(
      await seeded.as.action(api.energyHomeAssistant.test, tokenless),
    ).toMatchObject({ version: '2026.11.2' })
  })
})

describe('who may connect', () => {
  const denied = [
    ['a member who is not an admin', bob, 'adminOnly'],
    ['someone outside the Group', carol, null],
    ['a signed-out caller', null, null],
  ] as const

  test.each(denied)('refuses %s', async (_, person, code) => {
    const { t } = await seed()
    const as = person ? t.withIdentity(person) : t
    for (const attempt of [
      as.action(api.energyHomeAssistant.test, CONNECTION),
      as.action(api.energyHomeAssistant.connect, {
        ...CONNECTION,
        channels: [IMPORT],
        history: true,
      }),
      as.mutation(api.energySources.disconnect, HOME),
    ]) {
      const refused = await refusalOf(attempt)
      expect(refused.error).not.toBeNull()
      if (code) expect(refused.code).toBe(code)
    }
    expect(fake.connections).toBe(0)
    expect(await rows(t, 'energySources')).toEqual([])
  })

  test('only a Member reads the sources', async () => {
    const seeded = await seed()
    await connect(seeded)
    await expect(
      seeded.t.withIdentity(carol).query(api.energySources.list, HOME),
    ).rejects.toThrow()
    await expect(seeded.t.query(api.energySources.list, HOME)).rejects.toThrow()
    expect(
      await seeded.t.withIdentity(bob).query(api.energySources.list, HOME),
    ).toMatchObject({ canManage: false, homeAssistantAddress: null })
    expect(
      await seeded.t.withIdentity(alice).query(api.energySources.list, HOME),
    ).toMatchObject({ canManage: true, homeAssistantAddress: ADDRESS })
    expect(
      await seeded.t.withIdentity(carol).query(api.energySources.list, OTHER),
    ).toBeNull()
  })

  test('a connected app is refused', async () => {
    const { t } = await seed()
    const app = t.withIdentity({ ...alice, client_id: 'some-app' })
    const refused = await Promise.allSettled([
      app.action(api.energyHomeAssistant.test, CONNECTION),
      app.mutation(api.energySources.disconnect, HOME),
    ])
    expect(refused.map((each) => each.status)).toEqual(['rejected', 'rejected'])
    expect(fake.connections).toBe(0)
  })
})

describe('the token', () => {
  test('is in no query result, export, scheduled argument or error text', async () => {
    const seeded = await seed()
    fake.sums[IMPORT.statisticId] = counter(THIS_HOUR - 5 * HOUR, 5, 1)
    await connect(seeded, [IMPORT], true)
    const { t, as } = seeded
    expect((await rows(t, 'energySources'))[0]?.secret).toBe(TOKEN)
    const seen = [
      await as.query(api.energySources.list, HOME),
      await as.query(api.energy.overview, HOME),
      await as.query(api.energyUsage.month, {
        ...HOME,
        month: '2026-11',
        today: '2026-11-20',
      }),
      await as.query(api.energyReadings.form, { ...HOME, day: '2026-11-20' }),
      await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect()),
    ]
    expect(JSON.stringify(seen)).not.toContain(TOKEN)
  })

  test('is forgotten on disconnecting; what was read stays', async () => {
    const seeded = await seed()
    fake.sums[IMPORT.statisticId] = counter(THIS_HOUR - 5 * HOUR, 5, 1)
    await connect(seeded, [IMPORT], true)
    const before = await rows(seeded.t, 'energyIntervals')
    expect(before.length).toBeGreaterThan(0)
    await seeded.as.mutation(api.energySources.disconnect, HOME)
    const [source] = await rows(seeded.t, 'energySources')
    expect(source?.secret).toBeUndefined()
    expect(source).toMatchObject({
      status: 'needsReconnect',
      lastError: 'disconnected',
    })
    expect(await rows(seeded.t, 'energyIntervals')).toEqual(before)
    // And no sync reads it any more.
    const connections = fake.connections
    await seeded.t.action(internal.energyHomeAssistant.syncSource, {
      sourceId: source?._id as Id<'energySources'>,
    })
    expect(fake.connections).toBe(connections)
  })
})

describe('what it may send', () => {
  test('only the three read commands, whatever it does', async () => {
    const seeded = await seed()
    await seeded.as.action(api.energyHomeAssistant.test, CONNECTION)
    fake.sums[IMPORT.statisticId] = counter(THIS_HOUR - 5 * HOUR, 5, 1)
    await connect(seeded, [IMPORT], true)
    expect(new Set(fake.received.map((each) => each.type))).toEqual(
      new Set([
        'energy/get_prefs',
        'recorder/list_statistic_ids',
        'recorder/statistics_during_period',
      ]),
    )
  })
})

describe('history', () => {
  test('a year of hours arrives in batches, oldest first and once', async () => {
    const seeded = await seed()
    const from = THIS_HOUR - 365 * DAY
    fake.sums[IMPORT.statisticId] = counter(from, 365 * 24, 0.5)
    paced.length = 0
    await connect(seeded, [IMPORT], true)
    const stored = await rows(seeded.t, 'energyIntervals')
    expect(paced.reduce((sum, each) => sum + each, 0)).toBe(stored.length)
    expect(Math.max(...paced)).toBeLessThanOrEqual(500)
    // The first hour is the baseline of the second.
    expect(stored).toHaveLength(365 * 24 - 1)
    expect(new Set(stored.map((each) => each.hourStart)).size).toBe(stored.length)
    expect(stored.every((each) => each.amount === 0.5 && !each.estimated)).toBe(true)
    const asked = fake.received.filter(
      (each) => each.type === 'recorder/statistics_during_period',
    )
    expect(asked).toHaveLength(12)
    expect(asked[0]).toMatchObject({ period: 'hour', units: { energy: 'kWh' } })
    // The hour before is the first one's baseline.
    expect(asked[0]?.start_time).toBe(new Date(from - HOUR).toISOString())
    for (const each of asked) {
      expect(
        Date.parse(each.end_time as string) - Date.parse(each.start_time as string),
      ).toBeLessThanOrEqual(31 * DAY)
    }
    expect((await rows(seeded.t, 'energySources'))[0]).toMatchObject({
      status: 'ok',
      lastSyncedAt: expect.closeTo(NOW, -3),
    })
  }, 60_000)

  test('importing twice stores nothing twice', async () => {
    const seeded = await seed()
    fake.sums[IMPORT.statisticId] = counter(THIS_HOUR - 50 * HOUR, 50, 1)
    await connect(seeded, [IMPORT], true)
    const first = await rows(seeded.t, 'energyIntervals')
    await connect(seeded, [IMPORT], true)
    expect(await rows(seeded.t, 'energyIntervals')).toEqual(first)
  })

  test('switched off reads no past', async () => {
    const seeded = await seed()
    fake.sums[IMPORT.statisticId] = counter(THIS_HOUR - 100 * HOUR, 100, 1)
    await connect(seeded, [IMPORT], false)
    const stored = await rows(seeded.t, 'energyIntervals')
    expect(stored.length).toBeLessThanOrEqual(1)
  })

  test('an import that breaks off keeps what it read and carries on', async () => {
    const seeded = await seed()
    fake.sums[IMPORT.statisticId] = counter(THIS_HOUR - 90 * DAY, 90 * 24, 1)
    fake.dropAfterPeriods = 11
    await connect(seeded, [IMPORT], true)
    const [source] = await rows(seeded.t, 'energySources')
    expect(source).toMatchObject({ status: 'error', lastError: 'unreachable' })
    expect(source?.lastSyncedAt).toBeUndefined()
    const partial = await rows(seeded.t, 'energyIntervals')
    expect(partial.length).toBeGreaterThan(0)
    expect(partial.length).toBeLessThan(90 * 24 - 1)
    // It asks again by itself in an hour.
    const pending = await seeded.t.run((ctx) =>
      ctx.db.system.query('_scheduled_functions').collect(),
    )
    expect(
      pending.filter((each) => each.state.kind === 'pending' && !each.name.includes('endImport')).map((each) => each.args[0]),
    ).toEqual([
      expect.objectContaining({ attempt: 1, sourceId: source?._id }),
    ])
    // So does the hourly sync, from the last stored hour.
    fake.dropAfterPeriods = null
    await seeded.t.action(internal.energyHomeAssistant.syncSource, {
      sourceId: source?._id as Id<'energySources'>,
    })
    expect(await rows(seeded.t, 'energyIntervals')).toHaveLength(90 * 24 - 1)
    expect((await rows(seeded.t, 'energySources'))[0]?.status).toBe('ok')
  }, 60_000)
})

describe('the hourly sync', () => {
  async function connected(hours = 24) {
    const seeded = await seed()
    fake.sums[IMPORT.statisticId] = counter(THIS_HOUR - hours * HOUR, hours, 1)
    await connect(seeded, [IMPORT], true)
    const [source] = await rows(seeded.t, 'energySources')
    fake.received.length = 0
    return { ...seeded, sourceId: source?._id as Id<'energySources'> }
  }

  test('asks only from the last stored hour', async () => {
    const { t, sourceId } = await connected()
    vi.setSystemTime(NOW + 2 * HOUR)
    for (let hour = 0; hour < 2; hour += 1) {
      fake.sums[IMPORT.statisticId]?.set(THIS_HOUR + hour * HOUR, 25.25 + hour * 1.5)
    }
    await t.action(internal.energyHomeAssistant.syncSource, { sourceId })
    const asked = fake.received.filter((each) => 'start_time' in each)
    expect(asked).toHaveLength(1)
    expect(asked[0]).toMatchObject({
      start_time: new Date(THIS_HOUR - HOUR).toISOString(),
      end_time: new Date(THIS_HOUR + 2 * HOUR).toISOString(),
    })
    const stored = (await rows(t, 'energyIntervals')).slice(-2)
    expect(stored.map((each) => [each.hourStart, each.amount])).toEqual([
      [THIS_HOUR, 1.25],
      [THIS_HOUR + HOUR, 1.5],
    ])
  })

  test('a refused token needs reconnecting and is not tried again', async () => {
    const { t, as, sourceId } = await connected()
    const data = await rows(t, 'energyIntervals')
    fake.token = 'another'
    vi.setSystemTime(NOW + HOUR)
    await t.action(internal.energyHomeAssistant.syncSource, { sourceId })
    expect((await rows(t, 'energySources'))[0]).toMatchObject({
      status: 'needsReconnect',
      lastError: 'badToken',
      lastSyncedAt: expect.closeTo(NOW, -3),
    })
    expect(await rows(t, 'energyIntervals')).toEqual(data)
    const connections = fake.connections
    await t.mutation(internal.energySources.startSyncs, {})
    await settle(t)
    expect(fake.connections).toBe(connections)
    // Data stays visible, and Sources says when it is from.
    const month = await as.query(api.energyUsage.month, {
      ...HOME,
      month: '2026-11',
      today: '2026-11-20',
    })
    expect(month?.totals.importKwh).toBeCloseTo(23)
    expect((await as.query(api.energySources.list, HOME))?.sources[0]).toMatchObject({
      status: 'needsReconnect',
      lastError: 'badToken',
      lastSyncedAt: expect.closeTo(NOW, -3),
    })
  })

  test('unreachable keeps the data and the last sync time, then recovers', async () => {
    const { t, sourceId } = await connected()
    const url = target.url
    target.url = `ws://127.0.0.1:${await closedPort()}/api/websocket`
    vi.setSystemTime(NOW + HOUR)
    await t.action(internal.energyHomeAssistant.syncSource, { sourceId })
    expect((await rows(t, 'energySources'))[0]).toMatchObject({
      status: 'error',
      lastError: 'unreachable',
      lastSyncedAt: expect.closeTo(NOW, -3),
    })
    target.url = url
    await t.action(internal.energyHomeAssistant.syncSource, { sourceId })
    const [source] = await rows(t, 'energySources')
    expect(source).toMatchObject({ status: 'ok', lastSyncedAt: expect.closeTo(NOW + HOUR, -3) })
    expect(source?.lastError).toBeUndefined()
  })

  test('a missing statistic is named; the other channels are still read', async () => {
    const seeded = await seed()
    fake.sums[IMPORT.statisticId] = counter(THIS_HOUR - 4 * HOUR, 4, 1)
    fake.sums[GAS.statisticId] = counter(THIS_HOUR - 4 * HOUR, 4, 0.2)
    await connect(seeded, [IMPORT, GAS], true)
    const [source] = await rows(seeded.t, 'energySources')
    vi.setSystemTime(NOW + HOUR)
    fake.sums[IMPORT.statisticId]?.set(THIS_HOUR, 5)
    fake.statistics = fake.statistics.filter(
      (each) => each.statistic_id !== GAS.statisticId,
    )
    await seeded.t.action(internal.energyHomeAssistant.syncSource, {
      sourceId: source?._id as Id<'energySources'>,
    })
    expect((await rows(seeded.t, 'energySources'))[0]).toMatchObject({
      status: 'error',
      lastError: 'statisticMissing|sensor.p1_gas',
      lastSyncedAt: expect.closeTo(NOW, -3),
    })
    const stored = await rows(seeded.t, 'energyIntervals')
    expect(stored.filter((each) => each.hourStart === THIS_HOUR)).toHaveLength(1)
  })

  test('a refused command during sync records syncFailed, not notHomeAssistant', async () => {
    const { t, sourceId } = await connected()
    fake.refuseCommand['recorder/statistics_during_period'] = 'home_assistant_error'
    vi.setSystemTime(NOW + HOUR)
    await t.action(internal.energyHomeAssistant.syncSource, { sourceId })
    expect((await rows(t, 'energySources'))[0]).toMatchObject({
      status: 'error',
      lastError: 'syncFailed',
      lastSyncedAt: expect.closeTo(NOW, -3),
    })
  })

  test('the cron starts one sync per connected source', async () => {
    const { t } = await connected()
    const connections = fake.connections
    await t.mutation(internal.energySources.startSyncs, {})
    await settle(t)
    expect(fake.connections).toBe(connections + 1)
  })

  test('a battery’s charge is a level, not a difference', async () => {
    const seeded = await seed()
    fake.statistics.push({
      statistic_id: 'sensor.battery_soc',
      has_sum: false,
      has_mean: true,
      statistics_unit_of_measurement: '%',
    })
    fake.means['sensor.battery_soc'] = new Map([
      [THIS_HOUR - 2 * HOUR, 40],
      [THIS_HOUR - HOUR, 35],
    ])
    await connect(
      seeded,
      [{ kind: 'batterySoc', statisticId: 'sensor.battery_soc' }],
      true,
    )
    expect(
      (await rows(seeded.t, 'energyIntervals')).map((each) => each.amount),
    ).toEqual([40, 35])
  })

  test('a sync that outlives its connection writes nothing', async () => {
    const { t, sourceId } = await connected()
    const [channel] = await rows(t, 'energyChannels')
    const write = {
      sourceId,
      baseUrl: ADDRESS,
      batches: [
        {
          channelId: channel?._id as Id<'energyChannels'>,
          statisticId: 'sensor.old_one',
          hours: [{ hourStart: THIS_HOUR, amount: 9 }],
        },
      ],
    }
    // A channel that got another sensor is left out; another address stops it.
    const before = await rows(t, 'energyIntervals')
    expect(await t.mutation(internal.energySources.storeIntervals, write)).toBe('partly')
    expect(
      await t.mutation(internal.energySources.storeIntervals, {
        ...write,
        baseUrl: 'https://old.example.com',
      }),
    ).toBe('stop')
    expect(await rows(t, 'energyIntervals')).toEqual(before)
    await t.mutation(internal.energySources.finishSync, {
      sourceId,
      baseUrl: ADDRESS,
      secret: 'an earlier token',
      problem: 'badToken',
      done: false,
      missing: [],
    })
    expect((await rows(t, 'energySources'))[0]?.status).toBe('ok')
  })
})

describe('the daily lookback for corrections', () => {
  /** A statistic that grows by `index + 1` hundredths, so no two hours agree. */
  const growing = (hours: number) => {
    const sums = new Map<number, number>()
    let sum = 100
    for (let index = 0; index < hours; index += 1) {
      sum += (index + 1) / 100
      sums.set(THIS_HOUR - (hours - index) * HOUR, sum)
    }
    return sums
  }
  async function connected(sums: Map<number, number>) {
    const seeded = await seed()
    fake.sums[IMPORT.statisticId] = sums
    await connect(seeded, [IMPORT], true)
    const [source] = await rows(seeded.t, 'energySources')
    fake.received.length = 0
    const sourceId = source?._id as Id<'energySources'>
    return {
      ...seeded,
      sourceId,
      lookback: () =>
        seeded.t.action(internal.energyHomeAssistant.lookbackSource, {
          sourceId,
        }),
    }
  }
  /** Every sum from `at` on, as Home Assistant's own adjustment changes them. */
  const adjust = (at: number, by: number) => {
    const sums = fake.sums[IMPORT.statisticId] ?? new Map<number, number>()
    for (const [hour, sum] of sums) if (hour >= at) sums.set(hour, sum + by)
  }
  const amounts = async (t: Seeded['t']) =>
    new Map(
      (await rows(t, 'energyIntervals')).map((each) => [
        each.hourStart,
        each.amount,
      ]),
    )

  test('an edited hour updates its stored row and no other', async () => {
    const { t, sourceId, lookback } = await connected(growing(300))
    const before = await rows(t, 'energyIntervals')
    const at = THIS_HOUR - 5 * DAY
    adjust(at, -0.75)
    // The hourly sync does not see it.
    await t.action(internal.energyHomeAssistant.syncSource, { sourceId })
    expect(await rows(t, 'energyIntervals')).toEqual(before)
    await lookback()
    const after = await rows(t, 'energyIntervals')
    expect(after).toEqual(
      before.map((each) =>
        each.hourStart === at
          ? { ...each, amount: expect.closeTo(each.amount - 0.75, 6) }
          : each,
      ),
    )
    // Again: the same rows.
    await lookback()
    expect(await rows(t, 'energyIntervals')).toEqual(after)
  })

  test('unchanged hours write nothing, and one question reads eight days', async () => {
    const { t, sourceId, lookback } = await connected(growing(300))
    const before = await rows(t, 'energyIntervals')
    const source = await rows(t, 'energySources')
    vi.setSystemTime(NOW + 10 * 60_000)
    paced.length = 0
    await lookback()
    expect(paced).toEqual([191])
    const asked = fake.received.filter((each) => 'start_time' in each)
    expect(asked).toHaveLength(1)
    expect(asked[0]).toMatchObject({
      start_time: new Date(THIS_HOUR - 8 * DAY).toISOString(),
      end_time: new Date(THIS_HOUR).toISOString(),
    })
    expect(await rows(t, 'energyIntervals')).toEqual(before)
    expect(await rows(t, 'energySources')).toEqual(source)
    // Equal rows could also have been patched to the same value.
    const [channel] = await rows(t, 'energyChannels')
    expect(
      await t.mutation(internal.energySources.storeCorrections, {
        sourceId,
        baseUrl: ADDRESS,
        channelId: channel?._id as Id<'energyChannels'>,
        statisticId: IMPORT.statisticId,
        hours: before.map(({ hourStart, amount }) => ({
          hourStart,
          amount,
          after: hourStart - HOUR,
        })),
      }),
    ).toBe(0)
  })

  test('hours filled in late take their share from the catch-up row', async () => {
    const whole = growing(300)
    const sums = new Map(whole)
    for (let hour = 50; hour < 60; hour += 1) sums.delete(THIS_HOUR - hour * HOUR)
    const { t, lookback } = await connected(sums)
    const before = await rows(t, 'energyIntervals')
    fake.sums[IMPORT.statisticId] = whole
    await lookback()
    const after = await rows(t, 'energyIntervals')
    const total = (of: typeof after) => of.reduce((sum, each) => sum + each.amount, 0)
    expect(after).toHaveLength(before.length + 10)
    expect(new Set(after.map((each) => each.hourStart)).size).toBe(after.length)
    expect(total(after)).toBeCloseTo(total(before), 5)
    expect((await amounts(t)).get(THIS_HOUR - 49 * HOUR)).toBeCloseTo(2.52, 6)
  })

  test('an outage across the start of the window is never filled in half', async () => {
    const whole = growing(400)
    const sums = new Map(whole)
    for (let hour = 185; hour < 250; hour += 1) sums.delete(THIS_HOUR - hour * HOUR)
    const { t, lookback } = await connected(sums)
    const before = await rows(t, 'energyIntervals')
    fake.sums[IMPORT.statisticId] = whole
    await lookback()
    // The catch-up row keeps the whole, so nothing is lost or counted twice.
    expect(await rows(t, 'energyIntervals')).toEqual(before)
  })

  test('another sensor’s past does not replace the earlier one’s hours', async () => {
    const seeded = await connected(growing(300))
    const other = 'sensor.p1_import_tariff_1'
    const sums = new Map<number, number>()
    let sum = 0
    for (let hour = 300; hour > 0; hour -= 1) {
      sum += 0.001 * hour + 7
      sums.set(THIS_HOUR - hour * HOUR, sum)
    }
    fake.sums[other] = sums
    await connect(seeded, [{ ...IMPORT, statisticId: other }])
    const before = await rows(seeded.t, 'energyIntervals')
    await seeded.lookback()
    expect(await rows(seeded.t, 'energyIntervals')).toEqual(before)
    // Its own hours are corrected, two days on; the earlier one's still not.
    for (let hour = 0; hour < 48; hour += 1) {
      sum += 7 + 0.01 * hour
      sums.set(THIS_HOUR + hour * HOUR, sum)
    }
    vi.setSystemTime(NOW + 2 * DAY)
    await seeded.t.action(internal.energyHomeAssistant.syncSource, {
      sourceId: seeded.sourceId,
    })
    const at = THIS_HOUR + 30 * HOUR
    for (const [hour, value] of sums) if (hour >= at) sums.set(hour, value + 1)
    const synced = await rows(seeded.t, 'energyIntervals')
    await seeded.lookback()
    expect(await rows(seeded.t, 'energyIntervals')).toEqual(
      synced.map((each) =>
        each.hourStart === at
          ? { ...each, amount: expect.closeTo(each.amount + 1, 6) }
          : each,
      ),
    )
  })

  test('a sensor that is given back leaves the hours of the one between', async () => {
    const { t, lookback } = await connected(growing(300))
    // Three days of another sensor, while this one stood still.
    await t.run(async (ctx) => {
      for (const each of await ctx.db.query('energyIntervals').collect()) {
        const ago = (THIS_HOUR - each.hourStart) / HOUR
        if (ago > 48 && ago <= 120) {
          await ctx.db.patch(each._id, { amount: 10 + ago / 10 })
        }
      }
    })
    const before = await rows(t, 'energyIntervals')
    await lookback()
    expect(await rows(t, 'energyIntervals')).toEqual(before)
  })

  test.each([
    ['zeros', true],
    ['no hours at all', false],
  ])('nor when its nights have %s', async (_, zeros) => {
    // Eight hours a day, never two the same.
    const sums = new Map<number, number>()
    let sum = 100
    for (let hour = 300; hour > 0; hour -= 1) {
      const day = hour % 24 < 8
      if (day) sum += (400 - hour) / 100
      if (day || zeros) sums.set(THIS_HOUR - hour * HOUR, sum)
    }
    const { t, lookback } = await connected(sums)
    // Three days of another sensor: 24 hours that differ, over 56 in all.
    let differing = 0
    await t.run(async (ctx) => {
      for (const each of await ctx.db.query('energyIntervals').collect()) {
        const ago = (THIS_HOUR - each.hourStart) / HOUR
        if (ago >= 48 && ago < 120 && each.amount > 0) {
          differing += 1
          await ctx.db.patch(each._id, { amount: each.amount + 7 })
        }
      }
    })
    expect(differing).toBe(24)
    const before = await rows(t, 'energyIntervals')
    await lookback()
    expect(await rows(t, 'energyIntervals')).toEqual(before)
  })

  test.each([
    [24, true],
    [25, false],
  ])('a run of %i hours is written: %s', async (length, written) => {
    const { t, lookback } = await connected(growing(300))
    const before = await rows(t, 'energyIntervals')
    const inside = (at: number) =>
      at >= THIS_HOUR - 100 * HOUR && at < THIS_HOUR - (100 - length) * HOUR
    await t.run(async (ctx) => {
      for (const each of await ctx.db.query('energyIntervals').collect()) {
        if (inside(each.hourStart)) {
          await ctx.db.patch(each._id, { amount: each.amount + 7 })
        }
      }
    })
    const changed = await rows(t, 'energyIntervals')
    await lookback()
    expect(await rows(t, 'energyIntervals')).toEqual(written ? before : changed)
  })

  test('a full battery does not make two sensors the same', async () => {
    const seeded = await seed()
    const id = 'sensor.battery_soc'
    fake.statistics.push({
      statistic_id: id,
      has_sum: false,
      has_mean: true,
      statistics_unit_of_measurement: '%',
    })
    const levels = new Map<number, number>()
    for (let hour = 60; hour > 0; hour -= 1) {
      levels.set(THIS_HOUR - hour * HOUR, 100)
    }
    levels.set(THIS_HOUR - 30 * HOUR, 80)
    fake.means[id] = levels
    await connect(seeded, [{ kind: 'batterySoc', statisticId: id }], true)
    const before = await rows(seeded.t, 'energyIntervals')
    levels.set(THIS_HOUR - 30 * HOUR, 60)
    const [source] = await rows(seeded.t, 'energySources')
    await seeded.t.action(internal.energyHomeAssistant.lookbackSource, {
      sourceId: source?._id as Id<'energySources'>,
    })
    expect(await rows(seeded.t, 'energyIntervals')).toEqual(before)
  })

  test('a correction at the newest hour waits until hours follow it', async () => {
    const { t, sourceId, lookback } = await connected(growing(300))
    const at = THIS_HOUR - HOUR
    const was = (await amounts(t)).get(at) ?? 0
    adjust(at, 2)
    await lookback()
    expect((await amounts(t)).get(at)).toBe(was)
    const sums = fake.sums[IMPORT.statisticId] as Map<number, number>
    let sum = sums.get(at) as number
    for (let hour = 0; hour < 24; hour += 1) {
      sum += 5 + hour / 100
      sums.set(THIS_HOUR + hour * HOUR, sum)
    }
    vi.setSystemTime(NOW + DAY)
    await t.action(internal.energyHomeAssistant.syncSource, { sourceId })
    await lookback()
    expect((await amounts(t)).get(at)).toBeCloseTo(was + 2, 6)
  })

  test('zeros alone do not make two sensors the same', async () => {
    const solar = { kind: 'solar', statisticId: 'sensor.solar_total' } as const
    const seeded = await seed()
    fake.sums[solar.statisticId] = counter(THIS_HOUR - 100 * HOUR, 100, 0, 5)
    await connect(seeded, [solar], true)
    const before = await rows(seeded.t, 'energyIntervals')
    fake.sums[solar.statisticId]?.set(THIS_HOUR - HOUR, 9)
    const [source] = await rows(seeded.t, 'energySources')
    await seeded.t.action(internal.energyHomeAssistant.lookbackSource, {
      sourceId: source?._id as Id<'energySources'>,
    })
    expect(await rows(seeded.t, 'energyIntervals')).toEqual(before)
  })

  test('hours Home Assistant lost are not counted twice', async () => {
    const { t, lookback } = await connected(growing(300))
    const before = await rows(t, 'energyIntervals')
    for (let hour = 20; hour < 60; hour += 1) {
      fake.sums[IMPORT.statisticId]?.delete(THIS_HOUR - hour * HOUR)
    }
    await lookback()
    expect(await rows(t, 'energyIntervals')).toEqual(before)
  })

  test('the daily cron looks back once per source; a failure leaves its state', async () => {
    const { t } = await connected(growing(300))
    const at = THIS_HOUR - 2 * DAY
    const was = (await amounts(t)).get(at) ?? 0
    adjust(at, 4)
    const source = await rows(t, 'energySources')
    const url = target.url
    target.url = `ws://127.0.0.1:${await closedPort()}/api/websocket`
    await t.mutation(internal.energySources.startSyncs, { lookback: true })
    await settle(t)
    expect(await rows(t, 'energySources')).toEqual(source)
    target.url = url
    const connections = fake.connections
    await t.mutation(internal.energySources.startSyncs, { lookback: true })
    await settle(t)
    expect(fake.connections).toBe(connections + 1)
    expect((await amounts(t)).get(at)).toBeCloseTo(was + 4, 6)
    // A refused token is not tried.
    await t.run(async (ctx) => {
      for (const each of await ctx.db.query('energySources').collect()) {
        await ctx.db.patch(each._id, { status: 'needsReconnect' })
      }
    })
    await t.mutation(internal.energySources.startSyncs, { lookback: true })
    await settle(t)
    expect(fake.connections).toBe(connections + 1)
  })
})

describe('the channels saved', () => {
  test.each([
    ['none', [], 'pickChannel'],
    [
      'one sensor twice',
      [IMPORT, { kind: 'solar', statisticId: IMPORT.statisticId }],
      'channelTwice',
    ],
    [
      'a total next to a tariff',
      [IMPORT, { kind: 'gridImport', tariff: 't1', statisticId: 'sensor.p1_import_tariff_1' }],
      'channelsMixed',
    ],
    ['an unknown sensor', [{ kind: 'gas', statisticId: 'sensor.nope' }], 'statisticNotFound'],
    [
      'a sensor of another measure',
      [{ kind: 'gas', statisticId: 'sensor.solar_total' }],
      'statisticNotFound',
    ],
  ] as const)('refuses %s', async (_, channels, code) => {
    const { t, as } = await seed()
    expect(
      (
        await refusalOf(
          as.action(api.energyHomeAssistant.connect, {
            ...CONNECTION,
            channels: channels.map((each) => ({ ...each })),
            history: false,
          }),
        )
      ).code,
    ).toBe(code)
    expect(await rows(t, 'energySources')).toEqual([])
  })

  test('connecting again edits the one source and keeps its channels', async () => {
    const seeded = await seed()
    await connect(seeded, [IMPORT, GAS])
    const before = await rows(seeded.t, 'energyChannels')
    await connect(seeded, [
      { kind: 'gridImport', statisticId: 'sensor.p1_import_tariff_1' },
    ])
    expect(await rows(seeded.t, 'energySources')).toHaveLength(1)
    const after = await rows(seeded.t, 'energyChannels')
    expect(after).toHaveLength(2)
    expect(after.find((each) => each.kind === 'gridImport')).toMatchObject({
      _id: before[0]?._id,
      externalRef: 'sensor.p1_import_tariff_1',
    })
    expect(after.find((each) => each.kind === 'gas')?.retiredAt).toBeDefined()
    await connect(seeded, [IMPORT, GAS])
    expect(
      (await rows(seeded.t, 'energyChannels')).map((each) => [
        each._id,
        each.retiredAt,
      ]),
    ).toEqual(before.map((each) => [each._id, undefined]))
  })

  test('every kind is stored in its own unit', async () => {
    const seeded = await seed()
    const tested = await seeded.as.action(api.energyHomeAssistant.test, CONNECTION)
    await connect(
      seeded,
      tested.proposals.map(({ kind, tariff, statisticId }) => ({
        kind,
        tariff,
        statisticId,
      })),
    )
    const channels = await rows(seeded.t, 'energyChannels')
    expect(
      channels.map((each) => ENERGY_CHANNEL_ORDER.indexOf(each.kind)),
    ).toHaveLength(8)
    expect(channels.find((each) => each.kind === 'gas')?.unit).toBe('m3')
  })
})

describe('never counting one meter twice', () => {
  async function withMeters() {
    const seeded = await seed()
    const meters = await seeded.t.run(async (ctx) => {
      const ids = await insertManualMeters(
        ctx,
        seeded.homeId,
        seeded.siteId,
        seeded.aliceId,
      )
      for (const channelId of [ids.importT1, ids.importT2]) {
        await insertReading(ctx, seeded.homeId, channelId, '2026-11-10', 1000)
        await insertReading(ctx, seeded.homeId, channelId, '2026-11-20', 1100)
      }
      return ids
    })
    return { ...seeded, ...meters }
  }
  const month = (as: Seeded['as']) =>
    as.query(api.energyUsage.month, {
      ...HOME,
      month: '2026-11',
      today: '2026-11-20',
    })

  test('a connected channel retires the typed meters of the same kind', async () => {
    const seeded = await withMeters()
    await connect(seeded, [IMPORT])
    const channels = await rows(seeded.t, 'energyChannels')
    const retired = (id: Id<'energyChannels'>) =>
      channels.find((each) => each._id === id)?.retiredAt !== undefined
    expect(retired(seeded.importT1)).toBe(true)
    expect(retired(seeded.importT2)).toBe(true)
    expect(retired(seeded.gas)).toBe(false)
    const form = await seeded.as.query(api.energyReadings.form, {
      ...HOME,
      day: '2026-11-20',
    })
    expect(form?.channels.map((each) => each.kind)).toEqual(['gridExport', 'gas'])
  })

  test('only the same tariff is retired', async () => {
    const seeded = await withMeters()
    await connect(seeded, [
      { kind: 'gridImport', tariff: 't1', statisticId: 'sensor.p1_import_tariff_1' },
    ])
    const channels = await rows(seeded.t, 'energyChannels')
    expect(
      channels.find((each) => each._id === seeded.importT1)?.retiredAt,
    ).toBeDefined()
    expect(
      channels.find((each) => each._id === seeded.importT2)?.retiredAt,
    ).toBeUndefined()
  })

  test('disconnecting asks for the typed meters again', async () => {
    const seeded = await withMeters()
    await connect(seeded, [IMPORT])
    await seeded.as.mutation(api.energySources.disconnect, HOME)
    const channels = await rows(seeded.t, 'energyChannels')
    for (const id of [seeded.importT1, seeded.importT2]) {
      expect(channels.find((each) => each._id === id)?.retiredAt).toBeUndefined()
    }
  })

  test('a day measured per hour takes nothing from typed readings', async () => {
    const seeded = await withMeters()
    const typedOnly = (await month(seeded.as))?.days.find(
      (each) => each.day === '2026-11-15',
    )
    expect(typedOnly?.importKwh).toBeCloseTo(20)
    // From the 15th on, 0.1 kWh an hour.
    const from = Date.UTC(2026, 10, 14, 22)
    fake.sums[IMPORT.statisticId] = counter(from, (THIS_HOUR - from) / HOUR, 0.1)
    await connect(seeded, [IMPORT], true)
    const days = (await month(seeded.as))?.days ?? []
    const day = (name: string) => days.find((each) => each.day === name)?.importKwh
    expect(day('2026-11-14')).toBeCloseTo(20)
    expect(day('2026-11-15')).toBeCloseTo(2.4)
    expect(day('2026-11-16')).toBeCloseTo(2.4)
  })

  const SETUP = {
    ...HOME,
    split: true,
    export: false,
    gas: true,
    sourceLabel: 'Meterstanden',
  }
  const activeTyped = async (seeded: Seeded) => {
    const sources = await rows(seeded.t, 'energySources')
    const manual = sources.find((each) => each.kind === 'manual')?._id
    return (await rows(seeded.t, 'energyChannels'))
      .filter((each) => each.sourceId === manual && each.retiredAt === undefined)
      .map((each) => each.kind)
  }

  test('meter setup adds no second meter next to a connected one', async () => {
    const seeded = await seed()
    await connect(seeded, [IMPORT])
    const form = () =>
      seeded.as.query(api.energyReadings.form, { ...HOME, day: '2026-11-20' })
    expect((await form())?.measured).toEqual(['gridImport'])
    await seeded.as.mutation(api.energyReadings.setupChannels, SETUP)
    expect(await activeTyped(seeded)).toEqual(['gas'])
    // The meter it left out is asked for once nothing measures it.
    await seeded.as.mutation(api.energySources.disconnect, HOME)
    expect(await activeTyped(seeded)).toEqual(['gridImport', 'gridImport', 'gas'])
    expect((await form())?.measured).toEqual([])
  })

  test('setup while every meter is measured adds none, and keeps the readings', async () => {
    const seeded = await withMeters()
    await connect(seeded, [
      IMPORT,
      GAS,
      { kind: 'gridExport', statisticId: 'sensor.p1_export_tariff_1' },
    ])
    const before = await rows(seeded.t, 'energyChannels')
    expect(await activeTyped(seeded)).toEqual([])
    await seeded.as.mutation(api.energyReadings.setupChannels, SETUP)
    expect(await rows(seeded.t, 'energyChannels')).toEqual(before)
  })

  test('a day Home Assistant missed takes nothing from typed readings', async () => {
    const seeded = await withMeters()
    await connect(seeded, [IMPORT])
    await seeded.t.run(async (ctx) => {
      const channel = (await ctx.db.query('energyChannels').collect()).find(
        (each) => each.externalRef === IMPORT.statisticId,
      )
      if (!channel) throw new Error('expected a channel')
      // Off from Saturday the 14th to Monday the 16th, 10:00.
      for (const [day, amount] of [
        [14, 1],
        [16, 48],
      ] as const) {
        await ctx.db.insert('energyIntervals', {
          groupId: seeded.homeId,
          channelId: channel._id,
          hourStart: Date.UTC(2026, 10, day, 9),
          amount,
          estimated: false,
        })
      }
    })
    const days = (await month(seeded.as))?.days ?? []
    const day = (name: string) => days.find((each) => each.day === name)
    expect(day('2026-11-13')?.importKwh).toBeCloseTo(20)
    expect(day('2026-11-15')?.hasData).toBe(false)
    // The 14th before 10:00 and the 16th after 11:00 are still typed.
    expect(day('2026-11-14')?.importKwh).toBeCloseTo(1 + (20 * 10) / 24)
    expect(day('2026-11-16')?.importKwh).toBeCloseTo(48 + (20 * 13) / 24)
    expect(day('2026-11-17')?.importKwh).toBeCloseTo(20)
  })

  test('one hour measured leaves the rest of its day typed', async () => {
    const seeded = await withMeters()
    await connect(seeded, [IMPORT])
    const [channel] = (await rows(seeded.t, 'energyChannels')).filter(
      (each) => each.externalRef === IMPORT.statisticId,
    )
    await seeded.t.run(async (ctx) => {
      await ctx.db.insert('energyIntervals', {
        groupId: seeded.homeId,
        channelId: channel?._id as Id<'energyChannels'>,
        hourStart: Date.UTC(2026, 10, 15, 9),
        amount: 2,
        estimated: false,
      })
    })
    const day = (await month(seeded.as))?.days.find(
      (each) => each.day === '2026-11-15',
    )
    expect(day?.importKwh).toBeCloseTo(2 + (20 * 23) / 24)
    expect(day?.estimated).toBe(true)
  })

  test('a reading pair from noon to noon counts once beside half a day measured', async () => {
    const seeded = await seed()
    await seeded.as.mutation(api.energyReadings.setupChannels, {
      ...SETUP,
      split: false,
      gas: false,
    })
    const [typed] = await rows(seeded.t, 'energyChannels')
    const typedId = typed?._id as Id<'energyChannels'>
    await connect(seeded, [IMPORT])
    const [channel] = (await rows(seeded.t, 'energyChannels')).filter(
      (each) => each.externalRef === IMPORT.statisticId,
    )
    // Monday 16 November: noon to midnight in Amsterdam, 1 kWh an hour.
    const noon = Date.UTC(2026, 10, 16, 11)
    await seeded.t.run(async (ctx) => {
      await insertReading(ctx, seeded.homeId, typedId, '2026-11-16', 1000)
      await insertReading(ctx, seeded.homeId, typedId, '2026-11-17', 1024)
      for (const each of await ctx.db.query('energyReadings').collect()) {
        await ctx.db.patch(each._id, {
          at: each.value === 1000 ? noon : noon + 24 * HOUR,
        })
      }
      for (let hour = 0; hour < 12; hour++) {
        await ctx.db.insert('energyIntervals', {
          groupId: seeded.homeId,
          channelId: channel?._id as Id<'energyChannels'>,
          hourStart: noon + hour * HOUR,
          amount: 1,
          estimated: false,
        })
      }
    })
    const days = (await month(seeded.as))?.days ?? []
    const kwh = (of: string) => days.find((each) => each.day === of)?.importKwh
    expect(kwh('2026-11-16')).toBeCloseTo(12)
    expect(kwh('2026-11-17')).toBeCloseTo(12)
  })

  test('a T1 counter leaves a typed meter of every tariff, which counts the rest', async () => {
    const seeded = await seed()
    await seeded.as.mutation(api.energyReadings.setupChannels, {
      ...SETUP,
      split: false,
      gas: false,
    })
    const [typed] = await rows(seeded.t, 'energyChannels')
    const typedId = typed?._id as Id<'energyChannels'>
    await seeded.t.run(async (ctx) => {
      await insertReading(ctx, seeded.homeId, typedId, '2026-11-10', 1000)
      await insertReading(ctx, seeded.homeId, typedId, '2026-11-20', 1200)
    })
    const t1 = {
      kind: 'gridImport',
      tariff: 't1',
      statisticId: 'sensor.p1_import_tariff_1',
    } as const
    // From the 12th on T1 at 0.125 an hour, and 30 in a day on the 15th.
    const from = Date.UTC(2026, 10, 11, 23)
    const saved = counter(from, (THIS_HOUR - from) / HOUR, 0.125)
    for (const [at, value] of saved) {
      saved.set(
        at,
        value +
          1.125 *
            Math.min(24, Math.max(0, (at - Date.UTC(2026, 10, 14, 22)) / HOUR)),
      )
    }
    fake.sums[t1.statisticId] = saved
    await connect(seeded, [t1], true)
    expect(await activeTyped(seeded)).toEqual(['gridImport'])
    // The typed 200, however T1 was spread over its days.
    const days = (await month(seeded.as))?.days ?? []
    const typedDays = days.filter(
      (each) => each.day >= '2026-11-10' && each.day <= '2026-11-19',
    )
    expect(
      typedDays.find((each) => each.day === '2026-11-15')?.importKwh,
    ).toBeCloseTo(20)
    expect(
      typedDays.reduce((total, each) => total + each.importKwh, 0),
    ).toBeCloseTo(190)
    // And the lone T1 hours stay out of the hour view while the typed meter
    // covers the day, rather than disagreeing with the day's total.
    const dayView = await seeded.as.query(api.energyUsage.day, {
      ...HOME,
      day: '2026-11-15',
      today: '2026-11-20',
    })
    expect(dayView?.days[0]?.importKwh).toBeCloseTo(20)
    expect(dayView?.hours.every((hour) => !hour.hasData && hour.importKwh === 0)).toBe(
      true,
    )
  })

  test('a typed reading that goes down adds nothing on a partly measured day', async () => {
    const seeded = await seed()
    await seeded.as.mutation(api.energyReadings.setupChannels, {
      ...SETUP,
      split: false,
      gas: false,
    })
    const [typed] = await rows(seeded.t, 'energyChannels')
    const typedId = typed?._id as Id<'energyChannels'>
    await seeded.t.run(async (ctx) => {
      // Meter replaced between 10 and 20 November: reading dropped from 1000 to 50.
      await insertReading(ctx, seeded.homeId, typedId, '2026-11-10', 1000)
      await insertReading(ctx, seeded.homeId, typedId, '2026-11-20', 50)
    })
    await connect(seeded, [IMPORT])
    const [channel] = (await rows(seeded.t, 'energyChannels')).filter(
      (each) => each.externalRef === IMPORT.statisticId,
    )
    await seeded.t.run(async (ctx) => {
      await ctx.db.insert('energyIntervals', {
        groupId: seeded.homeId,
        channelId: channel?._id as Id<'energyChannels'>,
        hourStart: Date.UTC(2026, 10, 15, 9),
        amount: 2,
        estimated: false,
      })
    })
    const days = (await month(seeded.as))?.days ?? []
    expect(days.find((each) => each.day === '2026-11-15')).toMatchObject({
      hasData: true,
      estimated: false,
      importKwh: 2,
    })
    expect(days.find((each) => each.day === '2026-11-14')).toMatchObject({
      hasData: false,
      importKwh: 0,
    })
  })

  test('a lone tariff after a total leaves the total’s hours', async () => {
    const seeded = await seed()
    await connect(seeded, [IMPORT])
    const [total] = (await rows(seeded.t, 'energyChannels')).filter(
      (each) => each.externalRef === IMPORT.statisticId,
    )
    const at = Date.UTC(2026, 10, 15, 9)
    await seeded.t.run(async (ctx) => {
      const { _id, _creationTime, ...copy } = total as Doc<'energyChannels'>
      const t1 = await ctx.db.insert('energyChannels', {
        ...copy,
        tariff: 't1',
        externalRef: 'sensor.p1_import_tariff_1',
      })
      await ctx.db.patch(_id, { retiredAt: THIS_HOUR })
      for (const [channelId, amount] of [
        [_id, 3],
        [t1, 1],
      ] as const) {
        await ctx.db.insert('energyIntervals', {
          groupId: seeded.homeId,
          channelId,
          hourStart: at,
          amount,
          estimated: false,
        })
      }
    })
    const day = (await month(seeded.as))?.days.find(
      (each) => each.day === '2026-11-15',
    )
    expect(day?.importKwh).toBeCloseTo(3)
  })

  test('a total next to split counters counts once', async () => {
    const seeded = await seed()
    await connect(seeded, [IMPORT])
    const from = THIS_HOUR - 10 * HOUR
    await seeded.t.run(async (ctx) => {
      const [total] = await ctx.db.query('energyChannels').collect()
      if (!total) throw new Error('expected a channel')
      const { _id, _creationTime, ...fields } = total
      for (const tariff of ['t1', 't2'] as const) {
        const channelId = await ctx.db.insert('energyChannels', { ...fields, tariff })
        await ctx.db.insert('energyIntervals', {
          groupId: seeded.homeId,
          channelId,
          hourStart: from,
          amount: tariff === 't1' ? 2 : 0,
          estimated: false,
        })
      }
      await ctx.db.insert('energyIntervals', {
        groupId: seeded.homeId,
        channelId: _id,
        hourStart: from,
        amount: 2,
        estimated: false,
      })
    })
    expect((await month(seeded.as))?.totals.importKwh).toBeCloseTo(2)
  })
})

describe('an import and the connection it belongs to', () => {
  const imports = (t: Seeded['t']) =>
    t.run(async (ctx) =>
      (await ctx.db.system.query('_scheduled_functions').collect()).filter(
        (each) =>
          each.state.kind === 'pending' &&
          each.name.includes('syncSource') &&
          (each.args[0] as { historyFrom?: number }).historyFrom !== undefined,
      ),
    )

  test('an edit that kept the token cannot undo a disconnect', async () => {
    const seeded = await seed()
    await connect(seeded)
    await seeded.as.mutation(api.energySources.disconnect, HOME)
    // What an action that read the token before the disconnect still sends.
    const late = seeded.as.mutation(internal.energySources.saveConnection, {
      ...HOME,
      baseUrl: ADDRESS,
      secret: TOKEN,
      storedToken: true,
      channels: [IMPORT],
    })
    expect((await refusalOf(late)).code).toBe('tokenNeeded')
    expect((await rows(seeded.t, 'energySources'))[0]?.secret).toBeUndefined()
  })

  test('a missing statistic keeps the import, without rereading a full year for present channels', async () => {
    const seeded = await seed()
    const from = THIS_HOUR - 100 * HOUR
    fake.sums[IMPORT.statisticId] = counter(from, 100, 1)
    fake.sums[GAS.statisticId] = counter(from, 100, 1)
    await seeded.as.action(api.energyHomeAssistant.connect, {
      ...CONNECTION,
      channels: [IMPORT, GAS],
      history: true,
    })
    const all = fake.statistics
    fake.statistics = all.filter((each) => each.statistic_id !== GAS.statisticId)
    await settle(seeded.t)
    const [retry, ...more] = await imports(seeded.t)
    expect(more).toEqual([])
    expect(retry?.args[0]).toMatchObject({
      historyFor: [GAS.statisticId],
    })
    expect((await rows(seeded.t, 'energySources'))[0]?.status).toBe('error')
    const before = (await rows(seeded.t, 'energyIntervals')).length

    // While GAS is still missing, the retry asks IMPORT only from its last stored hour.
    fake.received.length = 0
    vi.setSystemTime(NOW + HOUR)
    fake.sums[IMPORT.statisticId]?.set(THIS_HOUR, 101)
    await seeded.t.action(
      internal.energyHomeAssistant.syncSource,
      retry?.args[0] as { sourceId: Id<'energySources'> },
    )
    const askedWhileMissing = fake.received.filter(
      (each) => each.type === 'recorder/statistics_during_period',
    )
    expect(askedWhileMissing).toHaveLength(1)
    expect(askedWhileMissing[0]).toMatchObject({
      statistic_ids: [IMPORT.statisticId],
      start_time: new Date(THIS_HOUR - HOUR).toISOString(),
    })

    // Once GAS comes back, GAS reads its full history while IMPORT keeps only its new hour.
    const secondRetry = (await imports(seeded.t)).find(
      (each) => (each.args[0] as { attempt?: number }).attempt === 2,
    )
    expect(secondRetry?.args[0]).toMatchObject({
      historyFor: [GAS.statisticId],
    })
    fake.statistics = all
    fake.received.length = 0
    await seeded.t.action(
      internal.energyHomeAssistant.syncSource,
      secondRetry?.args[0] as { sourceId: Id<'energySources'> },
    )
    const askedWhenBack = fake.received.filter(
      (each) => each.type === 'recorder/statistics_during_period',
    )
    // Early windows ask only for GAS, never rereading IMPORT's full year.
    expect(askedWhenBack[0]?.statistic_ids).toEqual([GAS.statisticId])
    expect(
      askedWhenBack.filter((each) =>
        (each.statistic_ids as string[]).includes(IMPORT.statisticId),
      ),
    ).toHaveLength(1)
    expect((await rows(seeded.t, 'energyIntervals')).length).toBe(before * 2 + 1)
    expect((await rows(seeded.t, 'energySources'))[0]?.status).toBe('ok')
  })

  test('an incomplete last attempt cancels its pending endImport job', async () => {
    const seeded = await seed()
    await connect(seeded, [IMPORT])
    const [source] = await rows(seeded.t, 'energySources')
    const sourceId = source?._id as Id<'energySources'>
    const importId = await seeded.t.run((ctx) =>
      ctx.scheduler.runAfter(15 * DAY, internal.energySources.endImport, {}),
    )
    fake.statistics = []
    await seeded.t.action(internal.energyHomeAssistant.syncSource, {
      sourceId,
      historyFrom: THIS_HOUR - 10 * HOUR,
      attempt: 60,
      importId,
    })
    const pendingEnd = () =>
      seeded.t.run(async (ctx) =>
        (await ctx.db.system.query('_scheduled_functions').collect()).filter(
          (each) => each.state.kind === 'pending' && each.name.includes('endImport'),
        ),
      )
    expect(await pendingEnd()).toEqual([])
    expect(await imports(seeded.t)).toEqual([])

    // Also when the final attempt exits early in `beginSync` for `needsReconnect`.
    const reconnectImportId = await seeded.t.run(async (ctx) => {
      await ctx.db.patch(sourceId, { status: 'needsReconnect' })
      return ctx.scheduler.runAfter(15 * DAY, internal.energySources.endImport, {})
    })
    await seeded.t.action(internal.energyHomeAssistant.syncSource, {
      sourceId,
      historyFrom: THIS_HOUR - 10 * HOUR,
      attempt: 60,
      importId: reconnectImportId,
    })
    expect(await pendingEnd()).toEqual([])
  })

  test('a continued import with a missing statistic still narrows its retry', async () => {
    const seeded = await seed()
    const from = THIS_HOUR - 20 * HOUR
    fake.sums[IMPORT.statisticId] = counter(from, 20, 1)
    fake.sums[GAS.statisticId] = counter(from, 20, 1)
    await connect(seeded, [IMPORT, GAS])
    const [source] = await rows(seeded.t, 'energySources')
    const sourceId = source?._id as Id<'energySources'>
    const importId = await seeded.t.run((ctx) =>
      ctx.scheduler.runAfter(15 * DAY, internal.energySources.endImport, {}),
    )
    // Continuation of a run where GAS was missing in the first slice and came
    // back before the second slice finished: IMPORT is complete, GAS still needs history.
    await seeded.t.action(internal.energyHomeAssistant.syncSource, {
      sourceId,
      historyFrom: from,
      attempt: 0,
      importId,
      readFrom: THIS_HOUR - 5 * HOUR,
      sums: [{ statisticId: IMPORT.statisticId, sum: 15 }],
      incomplete: false,
      missed: [GAS.statisticId],
    })
    const [retry] = await imports(seeded.t)
    expect(retry?.args[0]).toMatchObject({
      attempt: 1,
      historyFor: [GAS.statisticId],
    })
  })

  test('a long import goes on in a new run, unless it was dropped', async () => {
    const seeded = await seed()
    await connect(seeded)
    const [source] = await rows(seeded.t, 'energySources')
    const sourceId = source?._id as Id<'energySources'>
    const historyFrom = THIS_HOUR - 100 * HOUR
    const importId = await seeded.t.run((ctx) =>
      ctx.scheduler.runAfter(HOUR, internal.energySources.endImport, {}),
    )
    const plan = await seeded.t.mutation(internal.energySources.beginSync, {
      sourceId,
      history: { from: historyFrom, attempt: 2, importId },
    })
    const next = {
      sourceId,
      historyFrom,
      attempt: 2,
      importId,
      readFrom: THIS_HOUR - 50 * HOUR,
      sums: [{ statisticId: IMPORT.statisticId, sum: 100 }],
      incomplete: true,
    }
    const goOn = {
      ...next,
      retryId: plan?.retryId as Id<'_scheduled_functions'>,
    }
    await seeded.t.mutation(internal.energySources.continueImport, goOn)
    const pending = await imports(seeded.t)
    expect(pending.map((each) => each.args[0])).toEqual([next])
    await seeded.as.mutation(api.energySources.disconnect, HOME)
    await seeded.t.mutation(internal.energySources.continueImport, goOn)
    expect(await imports(seeded.t)).toEqual([])
  })

  test('a run that carries on counts a gap across its start', async () => {
    const seeded = await seed()
    const at = THIS_HOUR - 3 * HOUR
    fake.sums[IMPORT.statisticId] = new Map([
      [at - 3 * HOUR, 100],
      [at, 103],
    ])
    await seeded.as.action(api.energyHomeAssistant.connect, {
      ...CONNECTION,
      channels: [IMPORT],
      history: true,
    })
    const [job] = await imports(seeded.t)
    await seeded.t.action(internal.energyHomeAssistant.syncSource, {
      ...(job?.args[0] as {
        sourceId: Id<'energySources'>
        historyFrom: number
        importId: Id<'_scheduled_functions'>
      }),
      readFrom: at,
      sums: [{ statisticId: IMPORT.statisticId, sum: 100 }],
    })
    expect(
      (await rows(seeded.t, 'energyIntervals')).map((each) => [
        each.hourStart,
        each.amount,
      ]),
    ).toEqual([[at, 3]])
  })

  test('a finished import leaves no retry', async () => {
    const seeded = await seed()
    await connect(seeded, [IMPORT], true)
    expect(await imports(seeded.t)).toEqual([])
  })

  test('disconnecting drops the import; the same connection again has none', async () => {
    const seeded = await seed()
    const all = fake.statistics
    await connect(seeded, [IMPORT], true)
    fake.statistics = []
    await seeded.as
      .mutation(internal.energySources.saveConnection, {
        ...HOME,
        baseUrl: ADDRESS,
        secret: TOKEN,
        storedToken: true,
        channels: [IMPORT],
        historyFrom: THIS_HOUR - 10 * HOUR,
      })
    await settle(seeded.t)
    expect(await imports(seeded.t)).toHaveLength(1)
    const [pending] = await imports(seeded.t)
    // An edit of the same connection leaves it be.
    fake.statistics = all
    await connect(seeded, [IMPORT])
    expect(await imports(seeded.t)).toHaveLength(1)
    await seeded.as.mutation(api.energySources.disconnect, HOME)
    expect(await imports(seeded.t)).toEqual([])
    // One still running when it was dropped writes nothing.
    await connect(seeded, [IMPORT])
    const [source] = await rows(seeded.t, 'energySources')
    expect(
      await seeded.t.mutation(internal.energySources.storeIntervals, {
        sourceId: source?._id as Id<'energySources'>,
        baseUrl: ADDRESS,
        importId: (pending?.args[0] as { importId: Id<'_scheduled_functions'> })
          .importId,
        batches: [],
      }),
    ).toBe('stop')
    // Nor does a try that was just being started.
    await seeded.t.action(
      internal.energyHomeAssistant.syncSource,
      pending?.args[0] as { sourceId: Id<'energySources'> },
    )
    expect(await rows(seeded.t, 'energyIntervals')).toEqual([])
    expect(await imports(seeded.t)).toEqual([])
  })

  /** Connect twenty channels of one kind, and no others. */
  const saveTwenty = (
    seeded: Seeded,
    kind: 'solar' | 'gridImport',
    historyFrom?: number,
  ) =>
    seeded.as.mutation(internal.energySources.saveConnection, {
      ...HOME,
      baseUrl: ADDRESS,
      secret: TOKEN,
      storedToken: false,
      historyFrom,
      channels: Array.from({ length: 20 }, (_, index) => ({
        kind,
        statisticId: `sensor.${kind}_${index}`,
      })),
    })
  /** An hour for every channel of a kind. */
  const storeHour = (
    seeded: Seeded,
    kind: 'solar' | 'gridImport',
    hourStart: number,
  ) =>
    seeded.t.run(async (ctx) => {
      for (const channel of await ctx.db.query('energyChannels').collect()) {
        if (channel.kind !== kind) continue
        await ctx.db.insert('energyIntervals', {
          groupId: seeded.homeId,
          channelId: channel._id,
          hourStart,
          amount: 1,
          estimated: false,
        })
      }
    })

  test('retired channels with hours in the same month count toward the limit', async () => {
    const seeded = await seed()
    await saveTwenty(seeded, 'solar')
    await storeHour(seeded, 'solar', THIS_HOUR)
    expect((await refusalOf(saveTwenty(seeded, 'gridImport'))).code).toBe(
      'tooManyChannels',
    )
    // Refused as a whole: nothing was retired.
    expect(
      (await rows(seeded.t, 'energyChannels')).every(
        (each) => each.kind === 'solar' && each.retiredAt === undefined,
      ),
    ).toBe(true)
  })

  test('retired channels without hours do not count', async () => {
    const seeded = await seed()
    await saveTwenty(seeded, 'solar')
    await saveTwenty(seeded, 'gridImport')
    expect(await rows(seeded.t, 'energyChannels')).toHaveLength(40)
  })

  test('retired channels whose hours no channel in use can reach do not count', async () => {
    const seeded = await seed()
    await saveTwenty(seeded, 'solar')
    await storeHour(seeded, 'solar', THIS_HOUR)
    // An import reaches 365 + 15 + 1 days back, and 31 more are one month.
    vi.setSystemTime(THIS_HOUR + 412 * DAY)
    expect((await refusalOf(saveTwenty(seeded, 'gridImport'))).code).toBe(
      'tooManyChannels',
    )
    vi.setSystemTime(THIS_HOUR + 413 * DAY)
    await saveTwenty(seeded, 'gridImport')
    // Not again in reverse: solar would fill the hours since its last one.
    await storeHour(seeded, 'gridImport', THIS_HOUR + 412 * DAY)
    expect((await refusalOf(saveTwenty(seeded, 'solar'))).code).toBe(
      'tooManyChannels',
    )
  })

  test('retired channels of months that differ count once between them', async () => {
    const seeded = await seed()
    await saveTwenty(seeded, 'solar')
    await saveTwenty(seeded, 'gridImport')
    await storeHour(seeded, 'solar', THIS_HOUR - 3000 * DAY)
    await storeHour(seeded, 'gridImport', THIS_HOUR - 2960 * DAY)
    const saveGas = () =>
      seeded.as.mutation(internal.energySources.saveConnection, {
        ...HOME,
        baseUrl: ADDRESS,
        secret: TOKEN,
        storedToken: false,
        channels: [GAS],
      })
    await saveGas()
    // Within a month of each other, long ago: that month is too much.
    await storeHour(seeded, 'solar', THIS_HOUR - 2990 * DAY)
    expect((await refusalOf(saveGas())).code).toBe('tooManyChannels')
  })

  test('hours a pending import wrote count while it may still run, and for a month after', async () => {
    const seeded = await seed()
    const asked = THIS_HOUR
    // Asked now, the import reads a year back; its oldest hour is stored.
    await saveTwenty(seeded, 'solar', asked - 365 * DAY)
    await storeHour(seeded, 'solar', asked - 365 * DAY)
    expect(await imports(seeded.t)).toHaveLength(1)

    // 14 days on it is still inside `IMPORT_MS` (15 days) and still pending.
    vi.setSystemTime(asked + 14 * DAY)
    expect(await imports(seeded.t)).toHaveLength(1)
    expect((await refusalOf(saveTwenty(seeded, 'gridImport'))).code).toBe(
      'tooManyChannels',
    )
    // Refused as a whole: the import's channels were not retired.
    expect(
      (await rows(seeded.t, 'energyChannels')).every(
        (each) => each.kind === 'solar' && each.retiredAt === undefined,
      ),
    ).toBe(true)

    // A channel in use may be given hours from a year and 16 days back, and the
    // hour stored spans one more: a month later neither reaches the other.
    vi.setSystemTime(asked + 47 * DAY + HOUR)
    expect((await refusalOf(saveTwenty(seeded, 'gridImport'))).code).toBe(
      'tooManyChannels',
    )
    vi.setSystemTime(asked + 47 * DAY + 2 * HOUR)
    await saveTwenty(seeded, 'gridImport')
    expect(await rows(seeded.t, 'energyChannels')).toHaveLength(40)
  })
})
