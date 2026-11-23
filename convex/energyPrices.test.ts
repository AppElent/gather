import {
  amsterdamDayStart,
  type EnergyPriceSlot,
  energyDayQuarters,
  gasDayStart,
} from '@gather/core/energy'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import electricityAnswer from '../packages/core/src/__fixtures__/energyPrices/energyzero-electricity.json'
import gasAnswer from '../packages/core/src/__fixtures__/energyPrices/energyzero-gas.json'
import { alice, bob, carol } from '../test/convexHarness'
import {
  DYNAMIC_TERMS,
  FIXED_TERMS,
  HOME,
  insertContract,
  insertSite,
  OTHER,
  seedEnergyGroups,
} from '../test/energyUsageFixture'
import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'

/**
 * Day-ahead prices (APP-493): the daily fetch, what it may store, whose key
 * it uses, and what a Member reads. The network is a stub; the EnergyZero
 * answers are recorded ones of 23 November 2026.
 */

const TODAY = '2026-11-23'
const TOMORROW = '2026-11-24'
/** 16:00 in Amsterdam: both days are out. */
const NOW = Date.parse('2026-11-23T15:00:00Z')
const QUARTER = 900_000
const KEY = 'tibber-key-of-alice-0123456789'
const TOKEN = 'entsoe-token-of-alice-0123456789'

type Reply = { status?: number; body: unknown }
type Handler = (url: string, init: RequestInit) => Reply | Promise<Reply>

const requests: { url: string; init: RequestInit }[] = []
let handler: Handler

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  requests.length = 0
  handler = energyZeroOnly
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    requests.push({ url: String(url), init })
    const { status = 200, body } = await handler(String(url), init)
    return {
      status,
      text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    }
  })
  for (const method of ['log', 'warn', 'error', 'info'] as const) {
    vi.spyOn(console, method).mockImplementation(() => {})
  }
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

const energyZeroOnly: Handler = (url) => {
  if (!url.startsWith('https://public.api.energyzero.nl/')) {
    throw new Error('unexpected request')
  }
  return { body: url.includes('ENERGY_TYPE_GAS') ? gasAnswer : electricityAnswer }
}

/** One of the recorded days only, as before tomorrow is published. */
const todayOnly: Handler = (url, init) => {
  const { body } = energyZeroOnly(url, init) as { body: typeof electricityAnswer }
  return {
    body: {
      ...body,
      base: body.base.filter(
        (row) => Date.parse(row.start) < amsterdamDayStart(TOMORROW),
      ),
    },
  }
}

function slots(day: string, price: (index: number) => number = () => 0.1) {
  return Array.from(
    { length: energyDayQuarters(day) },
    (_, index): EnergyPriceSlot => ({
      start: amsterdamDayStart(day) + index * QUARTER,
      minutes: 15,
      eurPerUnit: price(index),
    }),
  )
}

const tibberDay = (day: string, total = 0.3) =>
  slots(day).map((slot) => ({
    total,
    startsAt: new Date(slot.start).toISOString(),
    currency: 'EUR',
  }))
const tibberAnswer = (total = 0.3) => ({
  data: {
    viewer: {
      homes: [
        {
          currentSubscription: {
            priceInfo: {
              today: tibberDay(TODAY, total),
              tomorrow: tibberDay(TOMORROW, total),
            },
          },
        },
      ],
    },
  },
})
const entsoeAnswer = `<Publication_MarketDocument><TimeSeries>
  <currency_Unit.name>EUR</currency_Unit.name><price_Measure_Unit.name>MWH</price_Measure_Unit.name>
  <curveType>A03</curveType><Period><timeInterval><start>2026-11-22T23:00Z</start><end>2026-11-24T23:00Z</end></timeInterval>
  <resolution>PT15M</resolution><Point><position>1</position><price.amount>50</price.amount></Point></Period>
</TimeSeries></Publication_MarketDocument>`

async function seedSite(terms?: typeof DYNAMIC_TERMS | typeof FIXED_TERMS) {
  const seeded = await seedEnergyGroups()
  const siteId = await seeded.t.run(async (ctx) => {
    const id = await insertSite(ctx, seeded.homeId, seeded.aliceId)
    if (terms) await insertContract(ctx, seeded.homeId, id, terms)
    return id
  })
  return { ...seeded, siteId }
}
type Harness = Awaited<ReturnType<typeof seedSite>>['t']

const drain = (t: Harness) => t.finishAllScheduledFunctions(vi.runAllTimers)
/** Runs what is due now, and leaves the retries waiting. */
async function runDue(t: Harness) {
  for (let step = 0; step < 10; step += 1) {
    vi.advanceTimersByTime(1000)
    await t.finishInProgressScheduledFunctions()
  }
}
const prices = (t: Harness) =>
  t.run((ctx) => ctx.db.query('energyPrices').collect())
const feeds = (t: Harness) =>
  t.run((ctx) => ctx.db.query('energyPriceFeeds').collect())
const scheduled = (t: Harness, name: string) =>
  t.run(async (ctx) =>
    (await ctx.db.system.query('_scheduled_functions').collect()).filter((each) =>
      each.name.includes(name),
    ),
  )
const save = (
  t: Harness,
  provider: 'energyzero' | 'entsoe' | 'tibber',
  key?: string,
  as: { subject: string } = alice,
) =>
  t
    .withIdentity(as)
    .mutation(api.energyPrices.saveFeed, { ...HOME, provider, key })
const view = (t: Harness, day = TODAY) =>
  t.withIdentity(bob).query(api.energyPrices.view, { ...HOME, day })

describe('the daily fetch', () => {
  test('stores today and tomorrow once for all Groups, electricity and gas', async () => {
    const { t } = await seedSite()
    await t.mutation(internal.energyPrices.startFetches, {})
    await drain(t)
    const rows = await prices(t)
    expect(rows.filter((row) => row.carrier === 'electricity')).toHaveLength(192)
    expect(rows.filter((row) => row.carrier === 'gas')).toHaveLength(2)
    expect(rows.every((row) => row.provider === 'energyzero' && !row.feedId)).toBe(true)
    expect(rows[0]).toMatchObject({
      start: Date.parse('2026-11-22T23:00:00Z'),
      minutes: 15,
      eurPerUnit: 0.195,
    })
    expect(requests).toHaveLength(2)
    expect(requests.every(({ init }) => init.redirect === 'manual')).toBe(true)
  })

  test('running again asks and changes nothing', async () => {
    const { t } = await seedSite()
    await t.mutation(internal.energyPrices.startFetches, {})
    await drain(t)
    const before = await prices(t)
    await t.mutation(internal.energyPrices.startFetches, {})
    await drain(t)
    expect(await prices(t)).toEqual(before)
    expect(requests).toHaveLength(2)
  })

  test('tomorrow not out yet: today is stored, and it is tried again', async () => {
    const { t } = await seedSite()
    handler = todayOnly
    await t.action(internal.energyPriceFetch.fetchEnergyZero, {})
    expect(
      (await prices(t)).filter((row) => row.carrier === 'electricity'),
    ).toHaveLength(96)
    const [retry] = await scheduled(t, 'fetchEnergyZero')
    expect(retry?.scheduledTime).toBe(NOW + 30 * 60_000)
    handler = energyZeroOnly
    await drain(t)
    expect(
      (await prices(t)).filter((row) => row.carrier === 'electricity'),
    ).toHaveLength(192)
    expect(await scheduled(t, 'fetchEnergyZero')).toHaveLength(1)
  })

  test('half a day is not stored', async () => {
    const { t } = await seedSite()
    handler = (url, init) => {
      const { body } = energyZeroOnly(url, init) as { body: typeof electricityAnswer }
      return url.includes('GAS') ? { body } : { body: { ...body, base: body.base.slice(0, 140) } }
    }
    await t.action(internal.energyPriceFetch.fetchEnergyZero, {})
    const rows = (await prices(t)).filter((row) => row.carrier === 'electricity')
    expect(rows).toHaveLength(96)
    expect(rows.every((row) => row.start < amsterdamDayStart(TOMORROW))).toBe(true)
  })

  test.each([
    ['no connection', () => { throw new TypeError('fetch failed') }],
    ['a server error', () => ({ status: 503, body: 'no' })],
    ['a redirect', () => ({ status: 302, body: '' })],
    ['another page', () => ({ body: '<html></html>' })],
    ['a huge answer', () => ({ body: 'x'.repeat(4_000_001) })],
  ] as [string, Handler][])('%s stores nothing and stops after eight retries', async (_, reply) => {
    const { t } = await seedSite()
    handler = reply
    await t.action(internal.energyPriceFetch.fetchEnergyZero, {})
    await drain(t)
    expect(await prices(t)).toEqual([])
    const retries = await scheduled(t, 'fetchEnergyZero')
    expect(retries).toHaveLength(8)
    expect(retries.every((each) => each.state.kind === 'success')).toBe(true)
  })

  test('a failure leaves the prices that are there', async () => {
    const { t } = await seedSite()
    handler = todayOnly
    await t.action(internal.energyPriceFetch.fetchEnergyZero, {})
    const before = await prices(t)
    handler = () => ({ status: 500, body: '' })
    await drain(t)
    expect(await prices(t)).toEqual(before)
    expect((await view(t))?.today?.hours).toHaveLength(24)
  })
})

describe('storing a day', () => {
  const store = (
    t: Harness,
    args: Partial<{
      provider: 'energyzero' | 'entsoe' | 'tibber'
      account: { feedId: Id<'energyPriceFeeds'>; secret: string }
      carrier: 'electricity' | 'gas'
      day: string
      slots: EnergyPriceSlot[]
    }> = {},
  ) =>
    t.mutation(internal.energyPrices.storeDay, {
      provider: 'energyzero',
      carrier: 'electricity',
      day: TODAY,
      slots: slots(TODAY),
      ...args,
    })

  test('the same start is updated, never added', async () => {
    const { t } = await seedSite()
    expect(await store(t)).toBe('stored')
    expect(
      await store(t, { slots: slots(TODAY, (index) => (index === 4 ? 0.2 : 0.1)) }),
    ).toBe('stored')
    const rows = await prices(t)
    expect(rows).toHaveLength(96)
    expect(rows[4]?.eurPerUnit).toBe(0.2)
  })

  test.each(['2026-03-29', '2026-10-25'])('a whole %s is one', async (day) => {
    const { t } = await seedSite()
    expect(await store(t, { day, slots: slots(day) })).toBe('stored')
    expect(await store(t, { day, slots: slots(day).slice(4) })).toBe('incomplete')
    expect(await prices(t)).toHaveLength(energyDayQuarters(day))
  })

  test('an incomplete day writes nothing, for gas neither', async () => {
    const { t } = await seedSite()
    expect(await store(t, { slots: slots(TODAY).slice(1) })).toBe('incomplete')
    expect(
      await store(t, {
        carrier: 'gas',
        slots: [{ start: gasDayStart(TODAY), minutes: 60, eurPerUnit: 1 }],
      }),
    ).toBe('incomplete')
    expect(await prices(t)).toEqual([])
  })

  test('only account prices have a feed, and only EnergyZero has gas', async () => {
    const { t } = await seedSite()
    await save(t, 'tibber', KEY)
    const feedId = (await feeds(t))[0]?._id as Id<'energyPriceFeeds'>
    expect(await store(t, { provider: 'tibber' })).toBe('refused')
    expect(await store(t, { account: { feedId, secret: KEY } })).toBe('refused')
    expect(
      await store(t, {
        provider: 'entsoe',
        carrier: 'gas',
        slots: [{ start: gasDayStart(TODAY), minutes: 1440, eurPerUnit: 1 }],
      }),
    ).toBe('refused')
    expect(
      await store(t, { provider: 'tibber', account: { feedId, secret: 'old' } }),
    ).toBe('refused')
    expect(await prices(t)).toEqual([])
    expect(
      await store(t, { provider: 'tibber', account: { feedId, secret: KEY } }),
    ).toBe('stored')
  })
})

describe('choosing a price source', () => {
  test('a Member who is not an admin cannot, and neither can another Group', async () => {
    const { t } = await seedSite()
    await expect(save(t, 'tibber', KEY, bob)).rejects.toMatchObject({
      data: { kind: 'energy:adminOnly' },
    })
    await expect(save(t, 'tibber', KEY, carol)).rejects.toThrow()
    await expect(
      t.mutation(api.energyPrices.saveFeed, { ...HOME, provider: 'tibber', key: KEY }),
    ).rejects.toThrow()
    expect(await feeds(t)).toEqual([])
  })

  test('a key is needed, and must look like one', async () => {
    const { t } = await seedSite()
    await expect(save(t, 'tibber')).rejects.toMatchObject({
      data: { kind: 'energy:priceKeyNeeded' },
    })
    await expect(save(t, 'entsoe', '  ')).rejects.toMatchObject({
      data: { kind: 'energy:priceKeyNeeded' },
    })
    await expect(save(t, 'tibber', 'a b')).rejects.toMatchObject({
      data: { kind: 'energy:priceKeyInvalid' },
    })
    expect(await feeds(t)).toEqual([])
  })

  test('a Group without an address has nothing to set', async () => {
    const { t } = await seedSite()
    await expect(
      t
        .withIdentity(carol)
        .mutation(api.energyPrices.saveFeed, { ...OTHER, provider: 'tibber', key: KEY }),
    ).rejects.toMatchObject({ data: { kind: 'energy:notFound' } })
  })

  test("another provider never gets this one's key", async () => {
    const { t } = await seedSite()
    await save(t, 'tibber', KEY)
    await expect(save(t, 'entsoe')).rejects.toMatchObject({
      data: { kind: 'energy:priceKeyNeeded' },
    })
    expect(await feeds(t)).toMatchObject([
      {
        provider: 'tibber',
        scope: 'account',
        includesTaxes: true,
        secret: KEY,
        status: 'ok',
      },
    ])
    await save(t, 'energyzero')
    const [feed] = await feeds(t)
    expect(feed).toMatchObject({ provider: 'energyzero', scope: 'market' })
    expect(feed?.secret).toBeUndefined()
  })

  test('leaving Tibber keeps the days before today at what they cost', async () => {
    const { t } = await seedSite(DYNAMIC_TERMS)
    await save(t, 'tibber', KEY)
    const feedId = (await feeds(t))[0]?._id as Id<'energyPriceFeeds'>
    for (const day of ['2026-11-22', TODAY, TOMORROW]) {
      await t.mutation(internal.energyPrices.storeDay, {
        provider: 'tibber',
        account: { feedId, secret: KEY },
        carrier: 'electricity',
        day,
        slots: slots(day),
      })
    }
    await save(t, 'energyzero')
    const rows = await prices(t)
    expect(rows).toHaveLength(96)
    expect(rows.every((row) => row.start < amsterdamDayStart(TODAY))).toBe(true)
  })
})

describe('Tibber', () => {
  const tibber =
    (reply: Reply): Handler =>
    (url, init) =>
      url.startsWith('https://api.tibber.com/') ? reply : energyZeroOnly(url, init)

  test("stores the account's prices with its feed", async () => {
    const { t } = await seedSite(DYNAMIC_TERMS)
    handler = tibber({ body: tibberAnswer() })
    await save(t, 'tibber', KEY)
    await runDue(t)
    const [feed] = await feeds(t)
    expect(feed).toMatchObject({ status: 'ok' })
    expect(feed?.lastFetchedAt).toBeGreaterThanOrEqual(NOW)
    const rows = await prices(t)
    expect(rows).toHaveLength(192)
    expect(rows.every((row) => row.feedId === feed?._id && row.provider === 'tibber')).toBe(true)
    expect(requests).toHaveLength(1)
    expect(requests[0]?.init).toMatchObject({
      method: 'POST',
      redirect: 'manual',
      headers: { Authorization: `Bearer ${KEY}` },
    })
    expect(await scheduled(t, 'fetchFeed')).toHaveLength(1)
  })

  test("is the price itself: the contract's markup and taxes are skipped", async () => {
    const { t } = await seedSite(DYNAMIC_TERMS)
    handler = tibber({ body: tibberAnswer(0.3) })
    await save(t, 'tibber', KEY)
    await runDue(t)
    const seen = await view(t)
    expect(seen?.today).toMatchObject({ provider: 'tibber', basis: 'allIn', terms: null })
    expect(seen?.today?.hours[0]?.price).toBeCloseTo(0.3)
  })

  test('a refused key needs a new one and is left alone until then', async () => {
    const { t } = await seedSite()
    handler = tibber({
      status: 400,
      body: { errors: [{ extensions: { code: 'UNAUTHENTICATED' } }], data: null },
    })
    await save(t, 'tibber', KEY)
    await drain(t)
    expect(await feeds(t)).toMatchObject([{ status: 'needsKey', lastError: 'keyRejected' }])
    expect(requests).toHaveLength(1)

    await t.mutation(internal.energyPrices.startAccountFetches, {})
    await drain(t)
    expect(requests).toHaveLength(1)

    handler = tibber({ body: tibberAnswer() })
    await save(t, 'tibber', `${KEY}-new`)
    await drain(t)
    const [feed] = await feeds(t)
    expect(feed).toMatchObject({ status: 'ok' })
    expect(feed?.lastError).toBeUndefined()
    expect(await prices(t)).toHaveLength(192)
  })

  test('a failed fetch keeps the last good time and retries, bounded', async () => {
    const { t } = await seedSite()
    handler = tibber({ body: tibberAnswer() })
    await save(t, 'tibber', KEY)
    await drain(t)
    const good = (await feeds(t))[0]?.lastFetchedAt
    handler = tibber({ status: 502, body: '' })
    await t.mutation(internal.energyPrices.startAccountFetches, {})
    await drain(t)
    expect(await feeds(t)).toMatchObject([
      { status: 'error', lastError: 'unreachable', lastFetchedAt: good },
    ])
    // Saving once, the day's first try, and eight more.
    expect(await scheduled(t, 'fetchFeed')).toHaveLength(10)
  })

  test('an answer for a key that was replaced meanwhile is dropped', async () => {
    const { t } = await seedSite()
    await save(t, 'tibber', KEY)
    const feedId = (await feeds(t))[0]?._id as Id<'energyPriceFeeds'>
    handler = async () => {
      // Replaced while Tibber was answering.
      await t.run((ctx) => ctx.db.patch(feedId, { secret: 'newer-key', status: 'ok' }))
      return { status: 401, body: '' }
    }
    await t.action(internal.energyPriceFetch.fetchFeed, { feedId, triesLeft: 0 })
    expect(await feeds(t)).toMatchObject([{ status: 'ok', secret: 'newer-key' }])
  })

  test('gas still comes from EnergyZero', async () => {
    const { t } = await seedSite()
    handler = tibber({ body: tibberAnswer() })
    await save(t, 'tibber', KEY)
    await t.mutation(internal.energyPrices.startFetches, {})
    await drain(t)
    const gas = (await prices(t)).filter((row) => row.carrier === 'gas')
    expect(gas).toHaveLength(2)
    expect(gas.every((row) => row.provider === 'energyzero')).toBe(true)
  })
})

describe('ENTSO-E', () => {
  test('is read once for everyone, with the first token that works', async () => {
    const { t, otherId, carolId } = await seedSite()
    await t.run(async (ctx) => {
      const siteId = await insertSite(ctx, otherId, carolId)
      for (const [groupId, secret] of [
        [otherId, 'refused-token'],
        [otherId, TOKEN],
      ] as const) {
        await ctx.db.insert('energyPriceFeeds', {
          groupId,
          siteId,
          provider: 'entsoe',
          scope: 'market',
          secret,
          includesTaxes: false,
          status: 'ok',
        })
      }
    })
    handler = (url, init) => {
      if (!url.startsWith('https://web-api.tp.entsoe.eu/')) return energyZeroOnly(url, init)
      return url.includes(TOKEN) ? { body: entsoeAnswer } : { status: 401, body: 'no' }
    }
    await t.mutation(internal.energyPrices.startFetches, {})
    await drain(t)
    const [refused, accepted] = await feeds(t)
    expect(refused).toMatchObject({ status: 'needsKey', lastError: 'keyRejected' })
    expect(accepted).toMatchObject({ status: 'ok' })
    const rows = (await prices(t)).filter((row) => row.provider === 'entsoe')
    expect(rows).toHaveLength(192)
    expect(rows.every((row) => !row.feedId && row.eurPerUnit === 0.05)).toBe(true)
    const asked = requests.filter(({ url }) => url.includes('entsoe'))
    expect(asked).toHaveLength(2)
    expect(asked[1]?.url).toContain('periodStart=202611222300')
    expect(asked[1]?.url).toContain('periodEnd=202611242300')
  })

  test.each([400, 429])('a token answered with %i does not stop the next', async (status) => {
    const { t, otherId, carolId } = await seedSite()
    await t.run(async (ctx) => {
      const siteId = await insertSite(ctx, otherId, carolId)
      for (const secret of ['odd-token', TOKEN]) {
        await ctx.db.insert('energyPriceFeeds', {
          groupId: otherId,
          siteId,
          provider: 'entsoe',
          scope: 'market',
          secret,
          includesTaxes: false,
          status: 'ok',
        })
      }
    })
    handler = (url, init) => {
      if (!url.includes('entsoe')) return energyZeroOnly(url, init)
      return url.includes(TOKEN) ? { body: entsoeAnswer } : { status, body: 'no' }
    }
    await t.action(internal.energyPriceFetch.fetchEntsoe, {})
    await drain(t)
    expect((await feeds(t)).map((feed) => feed.status)).toEqual(['ok', 'ok'])
    expect((await prices(t)).filter((row) => row.provider === 'entsoe')).toHaveLength(192)
  })

  test('without a token it is never asked', async () => {
    const { t } = await seedSite()
    await t.mutation(internal.energyPrices.startFetches, {})
    await drain(t)
    expect(requests.some(({ url }) => url.includes('entsoe'))).toBe(false)
  })

  test('a day it does not have is shown with the same auction from EnergyZero', async () => {
    const { t } = await seedSite(DYNAMIC_TERMS)
    handler = (url, init) =>
      url.includes('entsoe') ? { status: 503, body: '' } : energyZeroOnly(url, init)
    await save(t, 'entsoe', TOKEN)
    await t.action(internal.energyPriceFetch.fetchEnergyZero, {})
    await drain(t)
    const seen = await view(t)
    expect(seen).toMatchObject({
      provider: 'entsoe',
      status: 'error',
      lastError: 'unreachable',
      today: { provider: 'energyzero' },
    })
  })
})

describe('a key stays on the server', () => {
  test('no query returns it, no log line or scheduled call holds it', async () => {
    const { t } = await seedSite(DYNAMIC_TERMS)
    handler = (url) => {
      if (url.includes('tibber')) throw new TypeError(`failed with ${KEY}`)
      if (url.includes('entsoe')) throw new TypeError(`failed at ${url}`)
      return { status: 500, body: '' }
    }
    await save(t, 'tibber', KEY)
    await drain(t)
    const asAdmin = await t
      .withIdentity(alice)
      .query(api.energyPrices.view, { ...HOME, day: TODAY })
    expect(asAdmin).toMatchObject({ hasKey: true, canManage: true })
    expect(await view(t)).toMatchObject({ hasKey: true, canManage: false })
    for (const answer of [
      asAdmin,
      await view(t),
      await t.withIdentity(alice).query(api.energy.overview, HOME),
      await t.withIdentity(alice).query(api.energySources.list, HOME),
    ]) {
      expect(JSON.stringify(answer)).not.toContain(KEY)
    }
    await save(t, 'entsoe', TOKEN)
    await drain(t)
    const steps = JSON.stringify(
      await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect()),
    )
    const said = JSON.stringify(
      (['log', 'warn', 'error', 'info'] as const).flatMap(
        (method) => vi.mocked(console[method]).mock.calls,
      ),
    )
    for (const key of [KEY, TOKEN]) {
      expect(steps).not.toContain(key)
      expect(said).not.toContain(key)
    }
  })

  test('each key goes to its own provider only', async () => {
    const { t } = await seedSite()
    handler = (url, init) => (url.includes('tibber') ? { body: tibberAnswer() } : energyZeroOnly(url, init))
    await save(t, 'tibber', KEY)
    await t.mutation(internal.energyPrices.startFetches, {})
    await drain(t)
    const holding = requests.filter((each) => JSON.stringify(each).includes(KEY))
    expect(holding.length).toBeGreaterThan(0)
    expect(holding.every(({ url }) => url === 'https://api.tibber.com/v1-beta/gql')).toBe(true)
  })
})

describe('what a Member reads', () => {
  async function priced(terms?: typeof DYNAMIC_TERMS | typeof FIXED_TERMS) {
    const seeded = await seedSite(terms)
    for (const day of [TODAY, TOMORROW]) {
      await seeded.t.mutation(internal.energyPrices.storeDay, {
        provider: 'energyzero',
        carrier: 'electricity',
        day,
        slots: slots(day, (index) => [0.05, 0.1, 0.15, 0.1][index % 4] as number),
      })
    }
    return seeded
  }

  test('the all-in price per hour under the dynamic contract', async () => {
    const { t } = await priced(DYNAMIC_TERMS)
    const seen = await view(t)
    expect(seen).toMatchObject({
      provider: 'energyzero',
      hasKey: false,
      status: 'ok',
      lastError: null,
      contract: { kind: 'dynamic', supplierName: 'Frank Energie' },
      today: { basis: 'allIn', exportFeeEurPerKwh: -0.01 },
    })
    expect(seen?.today?.hours).toHaveLength(24)
    expect(seen?.today?.hours[0]?.market).toBeCloseTo(0.1)
    expect(seen?.today?.hours[0]?.price).toBeCloseTo((0.1 + 0.02 + 0.1) * 1.21)
    expect(Math.floor(seen?.lastFetchedAt ?? 0)).toBeGreaterThanOrEqual(NOW)
  })

  test('without a dynamic contract, the market price', async () => {
    for (const terms of [undefined, FIXED_TERMS]) {
      const { t } = await priced(terms)
      const seen = await view(t)
      expect(seen?.today).toMatchObject({ basis: 'market', terms: null, exportFeeEurPerKwh: null })
      expect(seen?.today?.hours[0]?.price).toBeCloseTo(0.1)
    }
  })

  test('31 December and 1 January each under their own contract', async () => {
    const { t, homeId, siteId } = await seedSite(DYNAMIC_TERMS)
    await t.run((ctx) =>
      insertContract(ctx, homeId, siteId, {
        ...DYNAMIC_TERMS,
        validFrom: '2027-01-01',
        energyTaxEurPerKwh: 0.15,
      }),
    )
    for (const day of ['2026-12-31', '2027-01-01']) {
      await t.mutation(internal.energyPrices.storeDay, {
        provider: 'energyzero',
        carrier: 'electricity',
        day,
        slots: slots(day),
      })
    }
    const seen = await view(t, '2026-12-31')
    expect(seen?.today?.hours[23]?.price).toBeCloseTo((0.1 + 0.02 + 0.1) * 1.21)
    expect(seen?.tomorrow?.hours[0]?.price).toBeCloseTo((0.1 + 0.02 + 0.15) * 1.21)
  })

  test('a day that is not whole is not shown, and no address is nothing', async () => {
    const { t } = await priced(DYNAMIC_TERMS)
    expect((await view(t, TOMORROW))?.tomorrow).toBeNull()
    expect(
      await t
        .withIdentity(carol)
        .query(api.energyPrices.view, { ...OTHER, day: TODAY }),
    ).toBeNull()
    await expect(
      t.withIdentity(carol).query(api.energyPrices.view, { ...HOME, day: TODAY }),
    ).rejects.toThrow()
  })
})
