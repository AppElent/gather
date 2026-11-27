import {
  amsterdamDayHours,
  energyMonthDays,
  energyPaybackDayOf,
} from '@gather/core/energy'
import { describe, expect, test } from 'vitest'
import { alice, bob, carol } from '../test/convexHarness'
import {
  DYNAMIC_TERMS,
  FIXED_TERMS,
  HOME,
  insertContract,
  insertManualMeters,
  insertSite,
  OTHER,
  seedEnergyGroups,
} from '../test/energyUsageFixture'
import { api } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'
import { paybackDaysOf } from './energySolar'
import { computeEnergyRange, siteChannels } from './lib/energyUsage'

/** Solar and battery (APP-496), from hourly intervals when they are read. */

type Kind = Doc<'energyChannels'>['kind']
const DAY = '2026-11-20'
const MONTH = { ...HOME, month: '2026-11', today: DAY }

/** A Home Assistant site; `hours` are amounts per hour of 20 November. */
async function seedHours(
  hours: Partial<Record<Kind, Record<number, number>>>,
  contract: Parameters<typeof insertContract>[3] | null = {
    ...FIXED_TERMS,
    netMetering: false,
  },
) {
  const seeded = await seedEnergyGroups()
  const siteId = await seeded.t.run(async (ctx) => {
    const siteId = await insertSite(ctx, seeded.homeId, seeded.aliceId)
    const sourceId = await ctx.db.insert('energySources', {
      groupId: seeded.homeId,
      siteId,
      kind: 'homeAssistant',
      label: 'Home Assistant',
      status: 'ok',
      connectedByUserId: seeded.aliceId,
    })
    const starts = amsterdamDayHours(DAY)
    for (const [kind, amounts] of Object.entries(hours)) {
      const channelId = await ctx.db.insert('energyChannels', {
        groupId: seeded.homeId,
        siteId,
        sourceId,
        kind: kind as Kind,
        unit: kind === 'batterySoc' ? 'percent' : 'kWh',
      })
      for (const [index, amount] of Object.entries(amounts)) {
        await ctx.db.insert('energyIntervals', {
          groupId: seeded.homeId,
          channelId,
          hourStart: starts[Number(index)] as number,
          amount,
          estimated: false,
        })
      }
    }
    if (contract) await insertContract(ctx, seeded.homeId, siteId, contract)
    return siteId
  })
  return { ...seeded, siteId }
}

const FULL = {
  gridImport: { 3: 4, 12: 0, 18: 1 },
  gridExport: { 3: 0, 12: 1, 18: 0 },
  solar: { 3: 0, 12: 3, 18: 0 },
  batteryCharge: { 3: 3, 12: 0, 18: 0 },
  batteryDischarge: { 3: 0, 12: 0, 18: 2 },
}

describe('a month', () => {
  test('per day: generated, self-used, self-sufficient, and what the battery earned', async () => {
    const { t } = await seedHours(FULL)
    const month = await t.withIdentity(bob).query(api.energySolar.month, MONTH)
    expect(month).toMatchObject({
      siteName: 'Thuis',
      status: 'ok',
      solar: true,
      battery: true,
      batterySoc: false,
      firstDay: DAY,
    })
    const day = month?.days.find((each) => each.day === DAY)
    // Import 5, export 1, solar 3, out of the battery 2, into it 3: used 6.
    expect(day).toMatchObject({
      producedKwh: 3,
      selfUsedKwh: 2,
      returnedKwh: 1,
      consumptionKwh: 6,
      ownKwh: 1,
    })
    // A single import meter counts on normal: (0.29 + 0.1088) × 1.21.
    const price = (0.29 + 0.1088) * 1.21
    expect(day?.battery?.chargeEur).toBeCloseTo(3 * price)
    expect(day?.battery?.dischargeEur).toBeCloseTo(2 * price)
    expect(day?.batteryEur).toBeCloseTo(-price)
    // Two kWh saved, and one sent back at the export tariff.
    expect(day?.solarEur).toBeCloseTo(2 * price + 0.06, 1)
    expect(month?.days).toHaveLength(20)
  })

  test('an hour the inverter was off made nothing; one before it was connected is unknown', async () => {
    const { t } = await seedHours({ ...FULL, solar: { 12: 3 } })
    const month = await t.withIdentity(bob).query(api.energySolar.month, MONTH)
    // Not 03:00 (before solar was measured); 18:00 counts, with its import.
    expect(month?.days.find((each) => each.day === DAY)).toMatchObject({
      producedKwh: 3,
      consumptionKwh: 5,
      ownKwh: 4,
    })
  })

  test('an hour after the solar channel retired is unknown (APP-922)', async () => {
    const { t, siteId } = await seedHours({ ...FULL, solar: { 12: 3 } })
    await t.run(async (ctx) => {
      const channels = await ctx.db
        .query('energyChannels')
        .withIndex('by_site', (q) => q.eq('siteId', siteId))
        .collect()
      const solar = channels.find((each) => each.kind === 'solar')
      if (solar) {
        await ctx.db.patch(solar._id, { retiredAt: amsterdamDayHours(DAY)[15] })
      }
    })
    const month = await t.withIdentity(bob).query(api.energySolar.month, MONTH)
    // 18:00 came after it retired, so it is left out with its import.
    expect(month?.days.find((each) => each.day === DAY)).toMatchObject({
      producedKwh: 3,
      consumptionKwh: 2,
      ownKwh: 2,
    })
  })

  test('a dynamic contract without prices has a battery without a value', async () => {
    const { t } = await seedHours(FULL, DYNAMIC_TERMS)
    const month = await t.withIdentity(bob).query(api.energySolar.month, MONTH)
    const day = month?.days.find((each) => each.day === DAY)
    expect(day?.battery).toMatchObject({
      chargeKwh: 3,
      chargeEur: null,
      dischargeEur: null,
    })
    expect(day?.batteryEur).toBeNull()
    expect(day?.solarEur).toBeNull()
    expect(day?.selfUsedKwh).toBe(2)
  })

  test('each hour of a dynamic contract counts at its own price', async () => {
    const { t } = await seedHours(FULL, DYNAMIC_TERMS)
    await t.run(async (ctx) => {
      const starts = amsterdamDayHours(DAY)
      for (const [index, price] of [
        [3, 0.05],
        [12, 0.1],
        [18, 0.25],
      ] as const) {
        for (let quarter = 0; quarter < 4; quarter++) {
          await ctx.db.insert('energyPrices', {
            provider: 'energyzero',
            carrier: 'electricity',
            start: (starts[index] as number) + quarter * 15 * 60_000,
            minutes: 15,
            eurPerUnit: price,
          })
        }
      }
    })
    const month = await t.withIdentity(bob).query(api.energySolar.month, MONTH)
    const day = month?.days.find((each) => each.day === DAY)
    const allIn = (market: number) => (market + 0.02 + 0.1) * 1.21
    expect(day?.batteryEur).toBeCloseTo(2 * allIn(0.25) - 3 * allIn(0.05))
  })

  test('a gas price still to come leaves what the roof sent back be (APP-920)', async () => {
    const { t } = await seedHours({ ...FULL, gas: { 3: 1 } }, DYNAMIC_TERMS)
    await t.run(async (ctx) => {
      const starts = amsterdamDayHours(DAY)
      for (const index of [3, 12, 18]) {
        for (let quarter = 0; quarter < 4; quarter++) {
          await ctx.db.insert('energyPrices', {
            provider: 'energyzero',
            carrier: 'electricity',
            start: (starts[index] as number) + quarter * 15 * 60_000,
            minutes: 15,
            eurPerUnit: 0.1,
          })
        }
      }
    })
    const month = await t.withIdentity(bob).query(api.energySolar.month, MONTH)
    const day = month?.days.find((each) => each.day === DAY)
    // Two kWh saved at the all-in price, one sent back at market plus fee.
    const allIn = (0.1 + 0.02 + 0.1) * 1.21
    expect(day?.solarEur).toBeCloseTo(2 * allIn + (0.1 - 0.01), 2)
    expect(day?.batteryEur).toBeCloseTo(-allIn)
    // The day's cost still waits for the gas price.
    const usage = await t
      .withIdentity(bob)
      .query(api.energyUsage.month, { ...HOME, month: '2026-11', today: DAY })
    expect(usage?.days.find((each) => each.day === DAY)?.costStatus).toBe('noPrices')
  })

  test('typed readings have no hours, so no figures and no zeros', async () => {
    const { t, homeId, aliceId } = await seedEnergyGroups()
    await t.run(async (ctx) => {
      const siteId = await insertSite(ctx, homeId, aliceId)
      await insertManualMeters(ctx, homeId, siteId, aliceId)
    })
    const month = await t.withIdentity(bob).query(api.energySolar.month, MONTH)
    expect(month).toMatchObject({ status: 'noHourly', days: [], firstDay: null })
  })

  test('hours without solar or a battery say so', async () => {
    const { t } = await seedHours({ gridImport: { 3: 1 } })
    const month = await t.withIdentity(bob).query(api.energySolar.month, MONTH)
    expect(month).toMatchObject({ status: 'noAssets', days: [] })
  })

  test('a charge level alone is a battery to show (APP-922)', async () => {
    const { t } = await seedHours({ gridImport: { 3: 1 }, batterySoc: { 3: 60 } })
    const month = await t.withIdentity(bob).query(api.energySolar.month, MONTH)
    expect(month).toMatchObject({
      status: 'ok',
      solar: false,
      battery: false,
      batterySoc: true,
      firstDay: null,
    })
    expect(month?.days).toHaveLength(20)
  })

  test('is for members of the Group', async () => {
    const { t } = await seedHours(FULL)
    await expect(t.query(api.energySolar.month, MONTH)).rejects.toThrow()
    await expect(
      t.withIdentity(carol).query(api.energySolar.month, MONTH),
    ).rejects.toThrow()
    expect(
      await t
        .withIdentity(carol)
        .query(api.energySolar.month, { ...MONTH, ...OTHER }),
    ).toBeNull()
  })
})

describe('payback', () => {
  type Range = {
    table: string
    index: string
    ops: [string, string][]
    order: 'asc' | 'desc'
  }

  /** Each index range a read asks for, with its bounds and its order. */
  function recordingReads(ctx: QueryCtx) {
    const ranges: Range[] = []
    const query = ctx.db.query.bind(ctx.db)
    const db = new Proxy(ctx.db, {
      get(target, key, receiver) {
        if (key !== 'query') return Reflect.get(target, key, receiver)
        return (table: 'energySources') => {
          const builder = query(table)
          return new Proxy(builder, {
            get(inner, name, innerReceiver) {
              if (name !== 'withIndex') {
                return Reflect.get(inner, name, innerReceiver)
              }
              return (index: string, range: (q: unknown) => unknown) => {
                const read: Range = { table, index, ops: [], order: 'asc' }
                ranges.push(read)
                // Run the range once against a recorder, then for real.
                type Bounds = { [op: string]: (field: string) => Bounds }
                const recorder: Bounds = new Proxy(
                  {},
                  {
                    get: (_, op: string) => (field: string) => {
                      read.ops.push([op, field])
                      return recorder
                    },
                  },
                )
                range(recorder)
                const ordered = Reflect.apply(builder.withIndex, builder, [
                  index,
                  range,
                ])
                return new Proxy(ordered, {
                  get(at, op, opReceiver) {
                    if (op !== 'order') return Reflect.get(at, op, opReceiver)
                    return (order: 'asc' | 'desc') => {
                      read.order = order
                      return at.order(order)
                    }
                  },
                })
              }
            },
          })
        }
      },
    })
    return { ctx: { ...ctx, db } as QueryCtx, ranges }
  }

  /** A newer row may land in this range: an hourly sync re-runs the read. */
  const reachesNewest = ({ ops, order }: Range) =>
    order === 'desc' && !ops.some(([op]) => op === 'lt' || op === 'lte')

  test('an hourly sync leaves a past month be (APP-921)', async () => {
    const { t, homeId, aliceId, siteId } = await seedHours(FULL)
    await t.run(async (ctx) => {
      await insertManualMeters(ctx, homeId, siteId, aliceId)
      const site = await ctx.db.get(siteId)
      if (!site) throw new Error('no site')
      const { ctx: recorded, ranges } = recordingReads(ctx)
      const channels = await siteChannels(recorded, siteId)
      await computeEnergyRange(
        recorded,
        site,
        channels,
        energyMonthDays('2026-11'),
        { solar: true },
      )
      // The source a sync patches is never read, nor a channel's newest hour.
      expect(ranges.filter((each) => each.table === 'energySources')).toEqual([
        {
          table: 'energySources',
          index: 'by_site_kind',
          ops: [
            ['eq', 'siteId'],
            ['eq', 'kind'],
          ],
          order: 'asc',
        },
      ])
      expect(
        ranges.filter(
          (each) => each.table === 'energyIntervals' && reachesNewest(each),
        ),
      ).toEqual([])
      // Typed meters still count as typed, and the rest as measured.
      const sources = await ctx.db
        .query('energySources')
        .withIndex('by_site', (q) => q.eq('siteId', siteId))
        .collect()
      const kindOf = new Map(sources.map((each) => [each._id, each.kind]))
      for (const { channel, manual } of channels) {
        expect(manual).toBe(kindOf.get(channel.sourceId) === 'manual')
      }
      expect(channels.filter((each) => each.manual)).toHaveLength(4)
      expect(channels.filter((each) => !each.manual)).toHaveLength(5)
    })
  })

  test('an asset edit leaves a past month be (APP-962)', async () => {
    const { t, siteId } = await seedHours(FULL)
    await t.run(async (ctx) => {
      const site = await ctx.db.get(siteId)
      if (!site) throw new Error('no site')
      const { ctx: recorded, ranges } = recordingReads(ctx)
      const days = await paybackDaysOf(recorded, site, '2026-11', DAY)
      expect(days).toHaveLength(20)
      expect(ranges.some((each) => each.table === 'energyChannels')).toBe(true)
      expect(ranges.filter((each) => each.table === 'energyAssets')).toEqual([])
    })
  })

  test("a past month counts what that month's answer counts", async () => {
    const { t } = await seedHours(FULL)
    const month = await t.withIdentity(bob).query(api.energySolar.month, MONTH)
    const payback = await t
      .withIdentity(bob)
      .query(api.energySolar.paybackMonth, MONTH)
    expect(payback).toEqual(month?.days.map(energyPaybackDayOf))
    expect(payback?.find((each) => each.day === DAY)).toMatchObject({
      solarMeasured: true,
      batteryMeasured: true,
    })
  })

  test('a past month is for members of the Group', async () => {
    const { t } = await seedHours(FULL)
    await expect(t.query(api.energySolar.paybackMonth, MONTH)).rejects.toThrow()
    await expect(
      t.withIdentity(carol).query(api.energySolar.paybackMonth, MONTH),
    ).rejects.toThrow()
    expect(
      await t
        .withIdentity(carol)
        .query(api.energySolar.paybackMonth, { ...MONTH, ...OTHER }),
    ).toBeNull()
  })
})

describe('assets', () => {
  const ROOF = {
    kind: 'solar' as const,
    name: ' Dak ',
    peakWatt: 4200,
    installedOn: '2023-03-01',
    purchaseCents: 520_000,
  }
  const save = (
    t: Awaited<ReturnType<typeof seedHours>>['t'],
    changes: { assetId?: Id<'energyAssets'>; asset?: typeof ROOF } = {},
    person = bob,
  ) =>
    t.withIdentity(person).mutation(api.energyAssets.save, {
      ...HOME,
      asset: ROOF,
      today: DAY,
      ...changes,
    })

  test('any member adds, changes and removes one', async () => {
    const { t, siteId } = await seedHours(FULL)
    const assetId = await save(t)
    await save(t, { assetId, asset: { ...ROOF, name: 'Dak en schuur' } })
    const month = await t.withIdentity(alice).query(api.energySolar.month, MONTH)
    expect(month?.assets).toEqual([
      { _id: assetId, asset: { ...ROOF, name: 'Dak en schuur' } },
    ])
    await t.run(async (ctx) => {
      const channel = await ctx.db
        .query('energyChannels')
        .withIndex('by_site', (q) => q.eq('siteId', siteId))
        .first()
      if (channel) await ctx.db.patch(channel._id, { assetId })
    })
    await t.withIdentity(bob).mutation(api.energyAssets.remove, { ...HOME, assetId })
    await t.run(async (ctx) => {
      expect(await ctx.db.query('energyAssets').collect()).toEqual([])
      const channels = await ctx.db.query('energyChannels').collect()
      expect(channels.every((each) => each.assetId === undefined)).toBe(true)
      // What was measured stays.
      expect((await ctx.db.query('energyIntervals').collect()).length).toBe(15)
    })
  })

  test('ties each channel to the one asset of its kind (APP-922)', async () => {
    const { t, siteId } = await seedHours({ ...FULL, batterySoc: { 3: 50 } })
    const links = () =>
      t.run(async (ctx) =>
        Object.fromEntries(
          (
            await ctx.db
              .query('energyChannels')
              .withIndex('by_site', (q) => q.eq('siteId', siteId))
              .collect()
          ).map((each) => [each.kind, each.assetId ?? null]),
        ),
      )
    const BATTERY = { kind: 'battery' as const, name: 'Accu', capacityKwh: 10 }
    const roof = await save(t)
    const battery = await t
      .withIdentity(bob)
      .mutation(api.energyAssets.save, { ...HOME, asset: BATTERY, today: DAY })
    expect(await links()).toEqual({
      gridImport: null,
      gridExport: null,
      solar: roof,
      batteryCharge: battery,
      batteryDischarge: battery,
      batterySoc: battery,
    })
    // A second roof: nobody said which panels the channel measures, so it
    // keeps the first. Without that one, it is the second's.
    const shed = await save(t, { asset: { ...ROOF, name: 'Schuur' } })
    expect((await links()).solar).toBe(roof)
    await t.withIdentity(bob).mutation(api.energyAssets.remove, {
      ...HOME,
      assetId: roof,
    })
    expect((await links()).solar).toBe(shed)
    // A battery that turns out to be panels no longer holds the battery.
    await t.withIdentity(bob).mutation(api.energyAssets.save, {
      ...HOME,
      assetId: battery,
      asset: { ...ROOF, name: 'Carport' },
      today: DAY,
    })
    expect(await links()).toMatchObject({ solar: shed, batteryCharge: null })
  })

  test('clearing a field clears it', async () => {
    const { t } = await seedHours(FULL)
    const assetId = await save(t)
    await t.withIdentity(bob).mutation(api.energyAssets.save, {
      ...HOME,
      assetId,
      asset: { kind: 'solar', name: 'Dak' },
      today: DAY,
    })
    const stored = await t.run((ctx) => ctx.db.get(assetId))
    expect(stored).not.toHaveProperty('purchaseCents')
    expect(stored).not.toHaveProperty('peakWatt')
  })

  test('refuses what cannot be, and another Group’s', async () => {
    const { t } = await seedHours(FULL)
    const assetId = await save(t)
    await expect(
      save(t, { asset: { ...ROOF, installedOn: '2026-12-01' } }),
    ).rejects.toThrow('assetInFuture')
    await expect(
      save(t, { asset: { ...ROOF, name: ' ' } }),
    ).rejects.toThrow('assetNeedsName')
    await expect(save(t, {}, carol)).rejects.toThrow()
    await expect(
      t.mutation(api.energyAssets.save, { ...HOME, asset: ROOF, today: DAY }),
    ).rejects.toThrow()
    for (const person of [t, t.withIdentity(carol)]) {
      await expect(
        person.mutation(api.energyAssets.remove, { ...HOME, assetId }),
      ).rejects.toThrow()
    }
    await t.run(async (ctx) => {
      const other = await ctx.db
        .query('groups')
        .filter((q) => q.eq(q.field('slug'), 'other'))
        .first()
      const user = await ctx.db.query('users').first()
      if (other && user) await insertSite(ctx, other._id, user._id)
    })
    for (const run of [
      () =>
        t.withIdentity(carol).mutation(api.energyAssets.save, {
          ...OTHER,
          assetId,
          asset: ROOF,
          today: DAY,
        }),
      () =>
        t
          .withIdentity(carol)
          .mutation(api.energyAssets.remove, { ...OTHER, assetId }),
    ]) {
      await expect(run()).rejects.toThrow('notFound')
    }
  })

  test('keeps twenty at most', async () => {
    const { t } = await seedHours(FULL)
    for (let index = 0; index < 20; index++) await save(t)
    await expect(save(t)).rejects.toThrow('tooManyAssets')
  })
})
