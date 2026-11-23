import { amsterdamDayHours, amsterdamDayStart } from '@gather/core/energy'
import { describe, expect, test } from 'vitest'
import { alice, bob, carol } from '../test/convexHarness'
import {
  DYNAMIC_TERMS,
  FIXED_TERMS,
  HOME,
  insertContract,
  insertManualMeters,
  insertReading,
  insertSite,
  seedEnergyGroups,
} from '../test/energyUsageFixture'
import { api } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'

/**
 * Usage and costs (APP-494), computed from typed readings and hourly
 * intervals when they are read.
 */

type Contract = Omit<
  Doc<'energyContracts'>,
  '_id' | '_creationTime' | 'groupId' | 'siteId'
>

/**
 * Readings at noon on 1 and 11 November 2026. Per whole day in between:
 * 4 kWh T1, 6 kWh T2, 3 kWh exported and 2 m³ gas; half that on the 1st and
 * the 11th. With the fixed contract that is the day worked out by hand in
 * `packages/core/src/energyUsage.test.ts`.
 */
async function seedReadSite(options: { contract?: Contract | null } = {}) {
  const seeded = await seedEnergyGroups()
  const { t, homeId, aliceId } = seeded
  const meters = await t.run(async (ctx) => {
    const siteId = await insertSite(ctx, homeId, aliceId)
    const meters = await insertManualMeters(ctx, homeId, siteId, aliceId)
    const read = (day: string, values: [number, number, number, number]) =>
      Promise.all(
        [meters.importT1, meters.importT2, meters.exportId, meters.gas].map(
          (channelId, index) =>
            insertReading(ctx, homeId, channelId, day, values[index] as number),
        ),
      )
    await read('2026-11-01', [1000, 2000, 500, 300])
    await read('2026-11-11', [1040, 2060, 530, 320])
    const contract =
      options.contract === undefined ? FIXED_TERMS : options.contract
    if (contract) await insertContract(ctx, homeId, siteId, contract)
    return { siteId, ...meters }
  })
  return { ...seeded, ...meters }
}

const NOVEMBER = { ...HOME, month: '2026-11', today: '2026-11-20' }

describe('a month from typed readings', () => {
  test('totals the days between the readings, all estimated', async () => {
    const { t } = await seedReadSite()
    const month = await t.withIdentity(bob).query(api.energyUsage.month, NOVEMBER)
    expect(month).not.toBeNull()
    if (!month) return
    expect(month.siteName).toBe('Thuis')
    expect(month.hasHourly).toBe(false)
    expect(month.days).toHaveLength(30)
    expect(month.totals.importKwh).toBeCloseTo(100)
    expect(month.totals.exportKwh).toBeCloseTo(30)
    expect(month.totals.gasM3).toBeCloseTo(20)
    expect(month.totals.daysWithData).toBe(11)
    expect(month.totals.firstDay).toBe('2026-11-01')
    expect(month.totals.lastDay).toBe('2026-11-11')
    expect(month.totals.estimated).toBe(true)
    expect(month.contract).toMatchObject({ kind: 'fixed', supplierName: 'Eneco' })
    expect(month.netMeteringChoice).toBe(true)
  })

  test('costs a whole day to the cent, with and without net metering', async () => {
    const { t } = await seedReadSite()
    const month = await t.withIdentity(bob).query(api.energyUsage.month, NOVEMBER)
    const tenth = month?.days.find((day) => day.day === '2026-11-10')
    expect(tenth).toMatchObject({ hasData: true, estimated: true, costStatus: 'ok' })
    expect(tenth?.costWithoutNet).toEqual({
      importCents: 473,
      exportCents: -18,
      gasCents: 411,
      fixedCents: 113,
      creditCents: -174,
      totalCents: 805,
    })
    expect(tenth?.cost).toEqual({
      importCents: 473,
      exportCents: -142,
      gasCents: 411,
      fixedCents: 113,
      creditCents: -174,
      totalCents: 681,
    })
  })

  test('the month’s cost is the sum of its days', async () => {
    const { t } = await seedReadSite()
    const month = await t.withIdentity(bob).query(api.energyUsage.month, NOVEMBER)
    if (!month?.totals.cost || !month.totals.costWithoutNet) {
      throw new Error('expected costs')
    }
    const { days } = month
    const sum = (pick: (day: (typeof days)[number]) => number) =>
      days.reduce((total, day) => total + pick(day), 0)
    expect(month.totals.cost.totalCents).toBe(
      sum((day) => day.cost?.totalCents ?? 0),
    )
    expect(month.totals.costWithoutNet.totalCents).toBe(
      sum((day) => day.costWithoutNet?.totalCents ?? 0),
    )
    // Net metering earns more for the same export; import is the same.
    expect(month.totals.cost.importCents).toBe(
      month.totals.costWithoutNet.importCents,
    )
    expect(month.totals.cost.exportCents).toBeLessThan(
      month.totals.costWithoutNet.exportCents,
    )
    expect(month.totals.costStatus).toBe('ok')
    expect(month.totals.costMissingDays).toBe(0)
  })

  test('days after today have no data, even with a later reading', async () => {
    const { t } = await seedReadSite()
    const month = await t
      .withIdentity(bob)
      .query(api.energyUsage.month, { ...NOVEMBER, today: '2026-11-05' })
    expect(month?.totals.daysWithData).toBe(5)
    expect(month?.totals.importKwh).toBeCloseTo(45) // 5 + 4 × 10
    for (const day of month?.days.filter((each) => each.day > '2026-11-05') ??
      []) {
      expect(day).toMatchObject({
        hasData: false,
        cost: null,
        costWithoutNet: null,
        costStatus: 'noData',
      })
    }
    // Days after the last reading have nothing either, never a zero.
    const later = await t.withIdentity(bob).query(api.energyUsage.month, NOVEMBER)
    expect(later?.days.find((day) => day.day === '2026-11-15')).toMatchObject({
      hasData: false,
      costStatus: 'noData',
    })
  })

  test('without a contract the usage shows and the costs say why they are missing', async () => {
    const { t } = await seedReadSite({ contract: null })
    const month = await t.withIdentity(bob).query(api.energyUsage.month, NOVEMBER)
    expect(month?.totals.importKwh).toBeCloseTo(100)
    expect(month?.totals.cost).toBeNull()
    expect(month?.totals.costWithoutNet).toBeNull()
    expect(month?.totals.costStatus).toBe('noContract')
    expect(month?.totals.costMissingDays).toBe(11)
    expect(month?.contract).toBeNull()
    expect(month?.netMeteringChoice).toBe(false)
  })

  test('from 2027 there is no net metering choice and costs are without', async () => {
    const { t, homeId, importT1, importT2, exportId, gas } = await seedReadSite()
    await t.run(async (ctx) => {
      const readings: [Id<'energyChannels'>, number][] = [
        [importT1, 1300],
        [importT2, 2400],
        [exportId, 600],
        [gas, 500],
      ]
      for (const [channelId, value] of readings) {
        await insertReading(ctx, homeId, channelId, '2027-01-20', value)
      }
    })
    const january = await t.withIdentity(bob).query(api.energyUsage.month, {
      ...HOME,
      month: '2027-01',
      today: '2027-01-31',
    })
    expect(january?.netMeteringChoice).toBe(false)
    expect(january?.contract?.netMetering).toBe(true)
    expect(january?.totals.daysWithData).toBe(20)
    expect(january?.totals.cost).not.toBeNull()
    expect(january?.totals.cost).toEqual(january?.totals.costWithoutNet)
    for (const day of january?.days ?? []) {
      expect(day.cost).toEqual(day.costWithoutNet)
    }
    // The same stretch in December 2026 still nets.
    const december = await t.withIdentity(bob).query(api.energyUsage.month, {
      ...HOME,
      month: '2026-12',
      today: '2026-12-31',
    })
    expect(december?.netMeteringChoice).toBe(true)
    expect(december?.totals.cost?.exportCents).toBeLessThan(
      december?.totals.costWithoutNet?.exportCents ?? 0,
    )
  })
})

describe('a dynamic contract', () => {
  test('without prices has no costs, never a number', async () => {
    const { t } = await seedReadSite({ contract: DYNAMIC_TERMS })
    const month = await t.withIdentity(bob).query(api.energyUsage.month, NOVEMBER)
    expect(month?.totals.importKwh).toBeCloseTo(100)
    expect(month?.totals.cost).toBeNull()
    expect(month?.totals.costWithoutNet).toBeNull()
    expect(month?.totals.costStatus).toBe('noPrices')
    for (const day of month?.days ?? []) {
      expect(day.cost).toBeNull()
      expect(day.costWithoutNet).toBeNull()
    }
  })

  test('with market prices costs each day at its average price', async () => {
    const { t } = await seedReadSite({ contract: DYNAMIC_TERMS })
    await t.run(async (ctx) => {
      for (let date = 1; date <= 11; date++) {
        const day = `2026-11-${String(date).padStart(2, '0')}`
        const start = amsterdamDayStart(day)
        // 96 quarter hours alternating 0.08 and 0.12: an average of 0.10.
        for (let quarter = 0; quarter < 96; quarter++) {
          await ctx.db.insert('energyPrices', {
            provider: 'energyzero',
            carrier: 'electricity',
            start: start + quarter * 15 * 60_000,
            minutes: 15,
            eurPerUnit: quarter % 2 === 0 ? 0.08 : 0.12,
          })
        }
        await ctx.db.insert('energyPrices', {
          provider: 'energyzero',
          carrier: 'gas',
          start: start + 6 * 3_600_000,
          minutes: 1440,
          eurPerUnit: 0.5,
        })
      }
    })
    const month = await t.withIdentity(bob).query(api.energyUsage.month, NOVEMBER)
    expect(month?.totals.costStatus).toBe('ok')
    /*
     * A whole day: 10 kWh × (0.10 + 0.02 + 0.10) × 1.21 = 2.662 → 266 ct;
     * export 3 kWh × (0.10 − 0.01) = 0.27 → −27 ct; gas 2 m³ × (0.50 + 0.05
     * + 0.60) × 1.21 = 2.783 → 278 ct. No fixed costs, no credit.
     */
    expect(month?.days.find((day) => day.day === '2026-11-10')?.cost).toEqual({
      importCents: 266,
      exportCents: -27,
      gasCents: 278,
      fixedCents: 0,
      creditCents: 0,
      totalCents: 517,
    })
    expect(month?.totals.cost?.totalCents).toBeGreaterThan(0)
  })

  /** One price all day, of a provider or of a feed. */
  async function priceDay(
    ctx: MutationCtx,
    day: string,
    provider: 'energyzero' | 'entsoe' | 'tibber',
    eurPerUnit: number,
    feedId?: Id<'energyPriceFeeds'>,
  ) {
    await ctx.db.insert('energyPrices', {
      provider,
      feedId,
      carrier: 'electricity',
      start: amsterdamDayStart(day),
      minutes: 1440,
      eurPerUnit,
    })
    if (provider === 'energyzero') {
      await ctx.db.insert('energyPrices', {
        provider,
        carrier: 'gas',
        start: amsterdamDayStart(day) + 6 * 3_600_000,
        minutes: 1440,
        eurPerUnit: 0.5,
      })
    }
  }
  const feedRow = (
    homeId: Id<'groups'>,
    siteId: Id<'energySites'>,
    provider: 'entsoe' | 'tibber',
  ) => ({
    groupId: homeId,
    siteId,
    provider,
    scope: provider === 'tibber' ? ('account' as const) : ('market' as const),
    secret: 'key',
    includesTaxes: provider === 'tibber',
    status: 'ok' as const,
  })
  const costOn = async (
    t: Awaited<ReturnType<typeof seedReadSite>>['t'],
    day: string,
  ) => {
    const month = await t.withIdentity(bob).query(api.energyUsage.month, NOVEMBER)
    return month?.days.find((each) => each.day === day)
  }

  test("another Group's account prices never price this one (APP-493)", async () => {
    const { t, otherId, carolId } = await seedReadSite({ contract: DYNAMIC_TERMS })
    await t.run(async (ctx) => {
      const otherSite = await insertSite(ctx, otherId, carolId)
      const feedId = await ctx.db.insert(
        'energyPriceFeeds',
        feedRow(otherId, otherSite, 'tibber'),
      )
      await priceDay(ctx, '2026-11-10', 'energyzero', 0.1)
      await priceDay(ctx, '2026-11-10', 'tibber', 9, feedId)
    })
    expect((await costOn(t, '2026-11-10'))?.cost?.importCents).toBe(266)
  })

  test('account prices are the import price; gas and export keep the contract (APP-493)', async () => {
    const { t, homeId, siteId } = await seedReadSite({ contract: DYNAMIC_TERMS })
    await t.run(async (ctx) => {
      const feedId = await ctx.db.insert(
        'energyPriceFeeds',
        feedRow(homeId, siteId, 'tibber'),
      )
      await priceDay(ctx, '2026-11-10', 'energyzero', 0.1)
      await priceDay(ctx, '2026-11-10', 'tibber', 0.3, feedId)
    })
    // 10 kWh × 0.30, with no markup, tax or VAT on top; the rest as above.
    expect((await costOn(t, '2026-11-10'))?.cost).toEqual({
      importCents: 300,
      exportCents: -27,
      gasCents: 278,
      fixedCents: 0,
      creditCents: 0,
      totalCents: 551,
    })
  })

  test('another source later rewrites no account day (APP-493)', async () => {
    const { t, homeId, siteId } = await seedReadSite({ contract: DYNAMIC_TERMS })
    await t.run(async (ctx) => {
      const feedId = await ctx.db.insert('energyPriceFeeds', {
        ...feedRow(homeId, siteId, 'tibber'),
        provider: 'energyzero',
        scope: 'market',
        includesTaxes: false,
        secret: undefined,
      })
      for (const day of ['2026-11-09', '2026-11-10']) {
        await priceDay(ctx, day, 'energyzero', 0.1)
      }
      await priceDay(ctx, '2026-11-09', 'tibber', 0.3, feedId)
    })
    expect((await costOn(t, '2026-11-09'))?.cost?.importCents).toBe(300)
    expect((await costOn(t, '2026-11-10'))?.cost?.importCents).toBe(266)
  })

  test('a day an account feed missed has no price, never the market one (APP-493)', async () => {
    const { t, homeId, siteId } = await seedReadSite({ contract: DYNAMIC_TERMS })
    await t.run(async (ctx) => {
      const feedId = await ctx.db.insert(
        'energyPriceFeeds',
        feedRow(homeId, siteId, 'tibber'),
      )
      for (const day of ['2026-11-08', '2026-11-09', '2026-11-10']) {
        await priceDay(ctx, day, 'energyzero', 0.1)
      }
      await priceDay(ctx, '2026-11-09', 'tibber', 0.3, feedId)
    })
    // Before the feed's first day it was not the source yet.
    expect((await costOn(t, '2026-11-08'))?.cost?.importCents).toBe(266)
    expect(await costOn(t, '2026-11-10')).toMatchObject({
      cost: null,
      costStatus: 'noPrices',
    })
  })

  test('ENTSO-E prices a day it has, EnergyZero the others (APP-493)', async () => {
    const { t, homeId, siteId } = await seedReadSite({ contract: DYNAMIC_TERMS })
    await t.run(async (ctx) => {
      await ctx.db.insert('energyPriceFeeds', feedRow(homeId, siteId, 'entsoe'))
      for (const day of ['2026-11-09', '2026-11-10']) {
        await priceDay(ctx, day, 'energyzero', 0.1)
      }
      await priceDay(ctx, '2026-11-10', 'entsoe', 0.2)
    })
    expect((await costOn(t, '2026-11-09'))?.cost?.importCents).toBe(266)
    // 10 × (0.20 + 0.02 + 0.10) × 1.21
    expect((await costOn(t, '2026-11-10'))?.cost?.importCents).toBe(387)
  })
})

describe('net metering', () => {
  /** A grey 9 November (10 kWh bought) and a sunny 10th (10 kWh sold). */
  async function seedGreyAndSunny() {
    const seeded = await seedEnergyGroups()
    const { t, homeId, aliceId } = seeded
    await t.run(async (ctx) => {
      const siteId = await insertSite(ctx, homeId, aliceId)
      const sourceId = await ctx.db.insert('energySources', {
        groupId: homeId,
        siteId,
        kind: 'homeAssistant',
        label: 'Home Assistant',
        status: 'ok',
        connectedByUserId: aliceId,
      })
      const channel = (kind: 'gridImport' | 'gridExport') =>
        ctx.db.insert('energyChannels', {
          groupId: homeId,
          siteId,
          sourceId,
          kind,
          unit: 'kWh',
        })
      const importId = await channel('gridImport')
      const exportId = await channel('gridExport')
      const at = (day: string) => amsterdamDayHours(day)[12] as number
      for (const [channelId, day] of [
        [importId, '2026-11-09'],
        [exportId, '2026-11-10'],
      ] as const) {
        await ctx.db.insert('energyIntervals', {
          groupId: homeId,
          channelId,
          hourStart: at(day),
          amount: 10,
          estimated: false,
        })
      }
      await insertContract(ctx, homeId, siteId, FIXED_TERMS)
    })
    return seeded
  }

  test('nets the month, so a sunny day offsets a grey one', async () => {
    const { t } = await seedGreyAndSunny()
    const month = await t.withIdentity(bob).query(api.energyUsage.month, NOVEMBER)
    const sunny = month?.days.find((day) => day.day === '2026-11-10')
    // Without: 10 kWh × 0.06 = −60 ct. With: all 10 netted at the 9th's
    // import price, so the month's electricity comes to nothing.
    expect(sunny?.costWithoutNet?.exportCents).toBe(-60)
    expect(sunny?.cost?.exportCents).toBe(-(month?.totals.cost?.importCents ?? 0))
    expect(
      (month?.totals.cost?.importCents ?? 0) + (month?.totals.cost?.exportCents ?? 0),
    ).toBe(0)
  })

  test('a supplier switch mid-month nets each contract on its own', async () => {
    const { t, homeId } = await seedGreyAndSunny()
    await t.run(async (ctx) => {
      const site = await ctx.db
        .query('energySites')
        .withIndex('by_group', (q) => q.eq('groupId', homeId))
        .first()
      if (site) {
        await insertContract(ctx, homeId, site._id, {
          ...FIXED_TERMS,
          validFrom: '2026-11-10',
        })
      }
    })
    const month = await t.withIdentity(bob).query(api.energyUsage.month, NOVEMBER)
    const sunny = month?.days.find((day) => day.day === '2026-11-10')
    // The 10th's contract had no import to net against.
    expect(sunny?.cost?.exportCents).toBe(-60)
  })

  test('a day shows its share of the month, as the month does', async () => {
    const { t } = await seedGreyAndSunny()
    const month = await t.withIdentity(bob).query(api.energyUsage.month, NOVEMBER)
    const day = await t
      .withIdentity(bob)
      .query(api.energyUsage.day, { ...HOME, day: '2026-11-10', today: '2026-11-20' })
    expect(day?.days[0]?.cost).toEqual(
      month?.days.find((each) => each.day === '2026-11-10')?.cost,
    )
    expect(day?.totals.cost?.exportCents).toBeLessThan(-60)
  })
})

describe('a year', () => {
  test('is twelve months summed, without a rollup', async () => {
    const { t, homeId, aliceId } = await seedEnergyGroups()
    await t.run(async (ctx) => {
      const siteId = await insertSite(ctx, homeId, aliceId)
      const meters = await insertManualMeters(ctx, homeId, siteId, aliceId)
      for (let month = 1; month <= 12; month++) {
        const day = `2026-${String(month).padStart(2, '0')}-01`
        await insertReading(ctx, homeId, meters.importT1, day, month * 100)
      }
      await insertContract(ctx, homeId, siteId, FIXED_TERMS)
    })
    const months = await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        t.withIdentity(bob).query(api.energyUsage.month, {
          ...HOME,
          month: `2026-${String(index + 1).padStart(2, '0')}`,
          today: '2026-12-31',
        }),
      ),
    )
    const year = months.reduce(
      (total, month) => total + (month?.totals.importKwh ?? 0),
      0,
    )
    // From the first reading (1 January, 100) to the last (1 December, 1200).
    expect(year).toBeCloseTo(1100)
    expect(months[0]?.totals.importKwh).toBeCloseTo(100 * (30.5 / 31))
    expect(months[11]?.totals.daysWithData).toBe(1)
  })
})

/** A Home Assistant source with hourly import, export, solar and two batteries. */
async function seedHourlySite(day: string, terms: Contract = FIXED_TERMS) {
  const seeded = await seedEnergyGroups()
  const { t, homeId, aliceId } = seeded
  await t.run(async (ctx) => {
    const siteId = await insertSite(ctx, homeId, aliceId)
    const sourceId = await ctx.db.insert('energySources', {
      groupId: homeId,
      siteId,
      kind: 'homeAssistant',
      label: 'Home Assistant',
      status: 'ok',
      connectedByUserId: aliceId,
    })
    const channel = (
      kind: Doc<'energyChannels'>['kind'],
      unit: Doc<'energyChannels'>['unit'],
    ) =>
      ctx.db.insert('energyChannels', {
        groupId: homeId,
        siteId,
        sourceId,
        kind,
        unit,
      })
    const importId = await channel('gridImport', 'kWh')
    const exportId = await channel('gridExport', 'kWh')
    const solarId = await channel('solar', 'kWh')
    const socA = await channel('batterySoc', 'percent')
    const socB = await channel('batterySoc', 'percent')
    const hours = amsterdamDayHours(day)
    const interval = (
      channelId: Id<'energyChannels'>,
      hourStart: number,
      amount: number,
    ) =>
      ctx.db.insert('energyIntervals', {
        groupId: homeId,
        channelId,
        hourStart,
        amount,
        estimated: false,
      })
    for (const hourStart of hours) await interval(importId, hourStart, 0.5)
    const noon = hours[12] as number
    await interval(exportId, noon, 1)
    await interval(solarId, noon, 2)
    await interval(socA, hours[0] as number, 40)
    await interval(socB, hours[0] as number, 60)
    await insertContract(ctx, homeId, siteId, terms)
  })
  return seeded
}

describe('a day', () => {
  test('from an hourly source has its hours, with the average state of charge', async () => {
    const { t } = await seedHourlySite('2026-11-10')
    const day = await t
      .withIdentity(bob)
      .query(api.energyUsage.day, { ...HOME, day: '2026-11-10', today: '2026-11-20' })
    expect(day?.hasHourly).toBe(true)
    expect(day?.channels).toMatchObject({ solar: true, batterySoc: true })
    expect(day?.hours).toHaveLength(24)
    expect(day?.hours[0]).toMatchObject({
      hourStart: amsterdamDayStart('2026-11-10'),
      hasData: true,
      importKwh: 0.5,
      socPercent: 50,
    })
    expect(day?.hours[1]?.socPercent).toBeNull()
    expect(day?.hours[12]).toMatchObject({ exportKwh: 1, solarKwh: 2 })
    expect(day?.days).toHaveLength(1)
    expect(day?.days[0]).toMatchObject({
      hasData: true,
      estimated: false,
      importKwh: 12,
      exportKwh: 1,
      solarKwh: 2,
      // Used = from the grid − exported + produced.
      consumptionKwh: 13,
      costStatus: 'ok',
    })
  })

  test('a dynamic contract prices each hour, even when solar is only an estimate', async () => {
    const { t } = await seedHourlySite('2026-11-10', DYNAMIC_TERMS)
    await t.run(async (ctx) => {
      // 0.10 a kWh in the night and morning, 0.30 from noon.
      for (const [index, start] of amsterdamDayHours('2026-11-10').entries()) {
        await ctx.db.insert('energyPrices', {
          provider: 'energyzero',
          carrier: 'electricity',
          start,
          minutes: 60,
          eurPerUnit: index < 12 ? 0.1 : 0.3,
        })
      }
      // More from the grid in the dear hours, so hour and day prices differ.
      const noon = amsterdamDayHours('2026-11-10')[12] as number
      for (const interval of await ctx.db.query('energyIntervals').collect()) {
        if (interval.amount === 0.5 && interval.hourStart >= noon) {
          await ctx.db.patch(interval._id, { amount: 1.5 })
        }
      }
    })
    const importCents = async () => {
      const day = await t
        .withIdentity(bob)
        .query(api.energyUsage.day, { ...HOME, day: '2026-11-10', today: '2026-11-20' })
      return day?.days[0]?.cost?.importCents
    }
    const hourly = await importCents()
    await t.run(async (ctx) => {
      // An estimate on a channel that is not grid import or export.
      for (const interval of await ctx.db.query('energyIntervals').collect()) {
        if (interval.amount === 2) await ctx.db.patch(interval._id, { estimated: true })
      }
    })
    expect(hourly).toBeDefined()
    expect(await importCents()).toBe(hourly)
  })

  test('on the day the clocks go back has 25 hours', async () => {
    const { t } = await seedHourlySite('2026-10-25')
    const day = await t
      .withIdentity(bob)
      .query(api.energyUsage.day, { ...HOME, day: '2026-10-25', today: '2026-11-20' })
    expect(day?.hours).toHaveLength(25)
    expect(day?.days[0]?.importKwh).toBeCloseTo(12.5)
  })

  test('from typed readings is an estimate without hours', async () => {
    const { t } = await seedReadSite()
    const day = await t
      .withIdentity(bob)
      .query(api.energyUsage.day, { ...HOME, day: '2026-11-10', today: '2026-11-20' })
    expect(day?.hasHourly).toBe(false)
    expect(day?.hours).toEqual([])
    expect(day?.days[0]).toMatchObject({ estimated: true, costStatus: 'ok' })
    expect(day?.days[0]?.importKwh).toBeCloseTo(10)
    expect(day?.netMeteringChoice).toBe(true)
  })
})

describe('who may read usage', () => {
  test('nothing while the Group has no address', async () => {
    const { t } = await seedEnergyGroups()
    expect(
      await t.withIdentity(alice).query(api.energyUsage.month, NOVEMBER),
    ).toBeNull()
    expect(
      await t
        .withIdentity(alice)
        .query(api.energyUsage.day, { ...HOME, day: '2026-11-10', today: '2026-11-20' }),
    ).toBeNull()
  })

  test('a Member of another Group, or nobody, cannot', async () => {
    const { t } = await seedReadSite()
    await expect(
      t.withIdentity(carol).query(api.energyUsage.month, NOVEMBER),
    ).rejects.toThrow()
    await expect(
      t.withIdentity(carol).query(api.energyUsage.day, { ...HOME, day: '2026-11-10', today: '2026-11-20' }),
    ).rejects.toThrow()
    await expect(t.query(api.energyUsage.month, NOVEMBER)).rejects.toThrow()
    await expect(
      t.query(api.energyUsage.day, { ...HOME, day: '2026-11-10', today: '2026-11-20' }),
    ).rejects.toThrow()
  })

  test('refuses a month or day that is not one', async () => {
    const { t } = await seedReadSite()
    await expect(
      t
        .withIdentity(bob)
        .query(api.energyUsage.month, { ...NOVEMBER, month: '2026-13' }),
    ).rejects.toThrow('energy:notFound')
    await expect(
      t.withIdentity(bob).query(api.energyUsage.day, { ...HOME, day: 'nope', today: '2026-11-20' }),
    ).rejects.toThrow('energy:notFound')
  })
})
