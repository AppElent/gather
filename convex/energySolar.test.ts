import { amsterdamDayHours } from '@gather/core/energy'
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

  test('is for members of the Group', async () => {
    const { t } = await seedHours(FULL)
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
