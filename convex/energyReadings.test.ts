import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { alice, bob, carol } from '../test/convexHarness'
import {
  FIXED_TERMS,
  HOME,
  insertContract,
  insertManualMeters,
  insertReading,
  insertSite,
  noonOn,
  seedEnergyGroups,
} from '../test/energyUsageFixture'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'

/**
 * Typed meter readings (APP-494): naming the meters, typing their counts,
 * and refusing a count that would make usage run backwards.
 */

/** 10:30 in Amsterdam on Monday 23 November 2026. */
const NOW = Date.UTC(2026, 10, 23, 9, 30)

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})
afterEach(() => {
  vi.useRealTimers()
})

const SETUP = {
  ...HOME,
  split: true,
  export: true,
  gas: true,
  sourceLabel: 'Meterstanden',
}

async function seedSite() {
  const seeded = await seedEnergyGroups()
  const siteId = await seeded.t.run((ctx) =>
    insertSite(ctx, seeded.homeId, seeded.aliceId),
  )
  return { ...seeded, siteId }
}

async function seedMeters() {
  const seeded = await seedSite()
  const meters = await seeded.t.run((ctx) =>
    insertManualMeters(ctx, seeded.homeId, seeded.siteId, seeded.aliceId),
  )
  return { ...seeded, ...meters }
}

describe('setupChannels', () => {
  test('names split import, export and gas, and adds the readings source', async () => {
    const { t, siteId } = await seedSite()
    await t.withIdentity(bob).mutation(api.energyReadings.setupChannels, SETUP)

    const sources = await t.run((ctx) => ctx.db.query('energySources').collect())
    expect(sources).toEqual([
      expect.objectContaining({ siteId, kind: 'manual', label: 'Meterstanden' }),
    ])
    const channels = await t.run((ctx) =>
      ctx.db.query('energyChannels').collect(),
    )
    expect(
      channels.map(({ kind, tariff, unit, sourceId }) => ({
        kind,
        tariff,
        unit,
        sourceId,
      })),
    ).toEqual([
      { kind: 'gridImport', tariff: 't1', unit: 'kWh', sourceId: sources[0]?._id },
      { kind: 'gridImport', tariff: 't2', unit: 'kWh', sourceId: sources[0]?._id },
      { kind: 'gridExport', tariff: 't1', unit: 'kWh', sourceId: sources[0]?._id },
      { kind: 'gridExport', tariff: 't2', unit: 'kWh', sourceId: sources[0]?._id },
      { kind: 'gas', tariff: undefined, unit: 'm3', sourceId: sources[0]?._id },
    ])
  })

  test('uses the source the address already has, and a single meter', async () => {
    const { t, homeId, siteId, aliceId } = await seedSite()
    const sourceId = await t.run((ctx) =>
      ctx.db.insert('energySources', {
        groupId: homeId,
        siteId,
        kind: 'manual',
        label: 'Standen',
        status: 'ok',
        connectedByUserId: aliceId,
      }),
    )
    await t.withIdentity(alice).mutation(api.energyReadings.setupChannels, {
      ...SETUP,
      split: false,
      export: false,
      gas: false,
      sourceLabel: '',
    })
    expect(
      await t.run((ctx) => ctx.db.query('energySources').collect()),
    ).toHaveLength(1)
    const channels = await t.run((ctx) =>
      ctx.db.query('energyChannels').collect(),
    )
    expect(channels).toEqual([
      expect.objectContaining({ kind: 'gridImport', sourceId, unit: 'kWh' }),
    ])
    expect(channels[0]?.tariff).toBeUndefined()
  })

  test('refuses a second time', async () => {
    const { t } = await seedSite()
    const as = t.withIdentity(alice)
    await as.mutation(api.energyReadings.setupChannels, SETUP)
    await expect(
      as.mutation(api.energyReadings.setupChannels, SETUP),
    ).rejects.toThrow('energy:channelsExist')
    expect(
      await t.run((ctx) => ctx.db.query('energyChannels').collect()),
    ).toHaveLength(5)
  })

  test('refuses without an address, or without a name for a new source', async () => {
    const empty = await seedEnergyGroups()
    await expect(
      empty.t.withIdentity(alice).mutation(api.energyReadings.setupChannels, SETUP),
    ).rejects.toThrow('energy:notFound')

    const { t } = await seedSite()
    await expect(
      t
        .withIdentity(alice)
        .mutation(api.energyReadings.setupChannels, { ...SETUP, sourceLabel: '  ' }),
    ).rejects.toThrow('energy:needsName')
    expect(await t.run((ctx) => ctx.db.query('energyChannels').collect())).toEqual(
      [],
    )
  })

  test('is refused outside the Group, and signed out', async () => {
    const { t } = await seedSite()
    await expect(
      t.withIdentity(carol).mutation(api.energyReadings.setupChannels, SETUP),
    ).rejects.toThrow()
    await expect(
      t.mutation(api.energyReadings.setupChannels, SETUP),
    ).rejects.toThrow()
  })
})

describe('save', () => {
  async function readings(t: Awaited<ReturnType<typeof seedMeters>>['t']) {
    return t.run((ctx) => ctx.db.query('energyReadings').collect())
  }

  test('saves a past day at noon, today at now, and who typed it', async () => {
    const { t, bobId, importT1, gas } = await seedMeters()
    const as = t.withIdentity(bob)
    await as.mutation(api.energyReadings.save, {
      ...HOME,
      day: '2026-11-01',
      readings: [
        { channelId: importT1, value: 1000 },
        { channelId: gas, value: 300 },
      ],
    })
    await as.mutation(api.energyReadings.save, {
      ...HOME,
      day: '2026-11-23',
      readings: [{ channelId: importT1, value: 1100 }],
    })
    const rows = await readings(t)
    expect(
      rows.map(({ channelId, at, value, enteredByUserId }) => ({
        channelId,
        at,
        value,
        enteredByUserId,
      })),
    ).toEqual([
      { channelId: importT1, at: noonOn('2026-11-01'), value: 1000, enteredByUserId: bobId },
      { channelId: gas, at: noonOn('2026-11-01'), value: 300, enteredByUserId: bobId },
      {
        channelId: importT1,
        // Now, give or take the clock convex-test moves on.
        at: expect.toSatisfy((at: number) => at >= NOW && at < NOW + 1000),
        value: 1100,
        enteredByUserId: bobId,
      },
    ])
  })

  test('replaces the reading of the same day', async () => {
    const { t, importT1 } = await seedMeters()
    const as = t.withIdentity(bob)
    for (const value of [1000, 1005.5]) {
      await as.mutation(api.energyReadings.save, {
        ...HOME,
        day: '2026-11-01',
        readings: [{ channelId: importT1, value }],
      })
    }
    const rows = await readings(t)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.value).toBe(1005.5)
  })

  test('refuses lower than the previous reading, and writes nothing at all', async () => {
    const { t, importT1, importT2, gas } = await seedMeters()
    const as = t.withIdentity(bob)
    await as.mutation(api.energyReadings.save, {
      ...HOME,
      day: '2026-11-01',
      readings: [{ channelId: importT1, value: 1000 }],
    })
    await expect(
      as.mutation(api.energyReadings.save, {
        ...HOME,
        day: '2026-11-10',
        readings: [
          { channelId: importT2, value: 2000 },
          { channelId: gas, value: 300 },
          { channelId: importT1, value: 999.9 },
        ],
      }),
    ).rejects.toThrow('energy:readingLower')
    const rows = await readings(t)
    expect(rows.map((row) => row.value)).toEqual([1000])
  })

  test('refuses higher than a later reading', async () => {
    const { t, importT1 } = await seedMeters()
    const as = t.withIdentity(bob)
    await as.mutation(api.energyReadings.save, {
      ...HOME,
      day: '2026-11-10',
      readings: [{ channelId: importT1, value: 1000 }],
    })
    await expect(
      as.mutation(api.energyReadings.save, {
        ...HOME,
        day: '2026-11-05',
        readings: [{ channelId: importT1, value: 1000.1 }],
      }),
    ).rejects.toThrow('energy:readingHigher')
    // Between its neighbours, or equal to one, is fine.
    await as.mutation(api.energyReadings.save, {
      ...HOME,
      day: '2026-11-05',
      readings: [{ channelId: importT1, value: 1000 }],
    })
    expect(await readings(t)).toHaveLength(2)
  })

  test('refuses a day after today, and a negative count', async () => {
    const { t, importT1 } = await seedMeters()
    const as = t.withIdentity(bob)
    await expect(
      as.mutation(api.energyReadings.save, {
        ...HOME,
        day: '2026-11-24',
        readings: [{ channelId: importT1, value: 1000 }],
      }),
    ).rejects.toThrow('energy:readingInFuture')
    await expect(
      as.mutation(api.energyReadings.save, {
        ...HOME,
        day: '2026-11-20',
        readings: [{ channelId: importT1, value: -1 }],
      }),
    ).rejects.toThrow('energy:readingInvalid')
    expect(await readings(t)).toEqual([])
  })

  test('refuses a channel of another Group, or one that is not typed, as not found', async () => {
    const { t, homeId, siteId, otherId, carolId, aliceId, importT1 } =
      await seedMeters()
    const { theirs, hourly } = await t.run(async (ctx) => {
      const otherSite = await insertSite(ctx, otherId, carolId)
      const theirMeters = await insertManualMeters(ctx, otherId, otherSite, carolId)
      const sourceId = await ctx.db.insert('energySources', {
        groupId: homeId,
        siteId,
        kind: 'homeAssistant',
        label: 'Home Assistant',
        status: 'ok',
        connectedByUserId: aliceId,
      })
      const hourly = await ctx.db.insert('energyChannels', {
        groupId: homeId,
        siteId,
        sourceId,
        kind: 'gridImport',
        unit: 'kWh',
      })
      return { theirs: theirMeters.importT1, hourly }
    })
    const as = t.withIdentity(bob)
    for (const channelId of [theirs, hourly] as Id<'energyChannels'>[]) {
      await expect(
        as.mutation(api.energyReadings.save, {
          ...HOME,
          day: '2026-11-20',
          readings: [
            { channelId: importT1, value: 1000 },
            { channelId, value: 1000 },
          ],
        }),
      ).rejects.toThrow('energy:notFound')
    }
    // The same channel twice is refused too.
    await expect(
      as.mutation(api.energyReadings.save, {
        ...HOME,
        day: '2026-11-20',
        readings: [
          { channelId: importT1, value: 1000 },
          { channelId: importT1, value: 1001 },
        ],
      }),
    ).rejects.toThrow('energy:notFound')
    expect(await readings(t)).toEqual([])
  })

  test('is refused outside the Group, and signed out', async () => {
    const { t, importT1 } = await seedMeters()
    const args = {
      ...HOME,
      day: '2026-11-20',
      readings: [{ channelId: importT1, value: 1000 }],
    }
    await expect(
      t.withIdentity(carol).mutation(api.energyReadings.save, args),
    ).rejects.toThrow()
    await expect(t.mutation(api.energyReadings.save, args)).rejects.toThrow()
    expect(await readings(t)).toEqual([])
  })
})

describe('form', () => {
  test('shows each meter with the readings before, on and after the day', async () => {
    const { t, importT1, importT2, exportId, gas } = await seedMeters()
    const as = t.withIdentity(bob)
    await as.mutation(api.energyReadings.save, {
      ...HOME,
      day: '2026-11-01',
      readings: [{ channelId: importT1, value: 1000 }],
    })
    await as.mutation(api.energyReadings.save, {
      ...HOME,
      day: '2026-11-10',
      readings: [{ channelId: importT1, value: 1050 }],
    })
    await as.mutation(api.energyReadings.save, {
      ...HOME,
      day: '2026-11-20',
      readings: [{ channelId: importT1, value: 1100 }],
    })

    const form = await as.query(api.energyReadings.form, {
      ...HOME,
      day: '2026-11-10',
    })
    expect(form?.hasManualSource).toBe(true)
    expect(form?.lastReadingAt).toBe(noonOn('2026-11-20'))
    expect(form?.channels.map((channel) => channel._id)).toEqual([
      importT1,
      importT2,
      exportId,
      gas,
    ])
    expect(form?.channels[0]).toMatchObject({
      kind: 'gridImport',
      tariff: 't1',
      unit: 'kWh',
      previous: { value: 1000, at: noonOn('2026-11-01') },
      onDay: { value: 1050, at: noonOn('2026-11-10') },
      next: { value: 1100, at: noonOn('2026-11-20') },
    })
    expect(form?.channels[3]).toMatchObject({
      kind: 'gas',
      previous: null,
      onDay: null,
      next: null,
    })
  })

  test('says when the address has no readings source yet', async () => {
    const { t } = await seedSite()
    expect(
      await t
        .withIdentity(bob)
        .query(api.energyReadings.form, { ...HOME, day: '2026-11-10' }),
    ).toEqual({ hasManualSource: false, lastReadingAt: null, measured: [], channels: [] })
    const empty = await seedEnergyGroups()
    expect(
      await empty.t
        .withIdentity(bob)
        .query(api.energyReadings.form, { ...HOME, day: '2026-11-10' }),
    ).toBeNull()
  })

  test('is refused outside the Group, and signed out', async () => {
    const { t } = await seedMeters()
    const args = { ...HOME, day: '2026-11-10' }
    await expect(
      t.withIdentity(carol).query(api.energyReadings.form, args),
    ).rejects.toThrow()
    await expect(t.query(api.energyReadings.form, args)).rejects.toThrow()
  })
})

describe('recent', () => {
  test('lists the typed readings newest first, only of typed meters', async () => {
    const { t, homeId, siteId, aliceId, importT1, gas } = await seedMeters()
    const as = t.withIdentity(bob)
    await as.mutation(api.energyReadings.save, {
      ...HOME,
      day: '2026-11-01',
      readings: [
        { channelId: importT1, value: 1000 },
        { channelId: gas, value: 300 },
      ],
    })
    await as.mutation(api.energyReadings.save, {
      ...HOME,
      day: '2026-11-10',
      readings: [{ channelId: importT1, value: 1050 }],
    })
    // A connected source's channel is never listed.
    await t.run(async (ctx) => {
      const sourceId = await ctx.db.insert('energySources', {
        groupId: homeId,
        siteId,
        kind: 'homeAssistant',
        label: 'Home Assistant',
        status: 'ok',
        connectedByUserId: aliceId,
      })
      const hourly = await ctx.db.insert('energyChannels', {
        groupId: homeId,
        siteId,
        sourceId,
        kind: 'solar',
        unit: 'kWh',
      })
      await insertReading(ctx, homeId, hourly, '2026-11-15', 5)
    })
    const recent = await as.query(api.energyReadings.recent, HOME)
    expect(
      recent.map(({ kind, tariff, unit, value, at }) => ({
        kind,
        tariff,
        unit,
        value,
        at,
      })),
    ).toEqual([
      { kind: 'gridImport', tariff: 't1', unit: 'kWh', value: 1050, at: noonOn('2026-11-10') },
      { kind: 'gridImport', tariff: 't1', unit: 'kWh', value: 1000, at: noonOn('2026-11-01') },
      { kind: 'gas', tariff: undefined, unit: 'm3', value: 300, at: noonOn('2026-11-01') },
    ])
  })

  test("leaves out a retired meter's readings", async () => {
    const { t, importT1, gas } = await seedMeters()
    const as = t.withIdentity(bob)
    await as.mutation(api.energyReadings.save, {
      ...HOME,
      day: '2026-11-01',
      readings: [
        { channelId: importT1, value: 1000 },
        { channelId: gas, value: 300 },
      ],
    })
    await t.run((ctx) => ctx.db.patch(gas, { retiredAt: NOW }))
    const recent = await as.query(api.energyReadings.recent, HOME)
    expect(recent.map(({ kind, value }) => ({ kind, value }))).toEqual([
      { kind: 'gridImport', value: 1000 },
    ])
  })

  test('is empty without an address, and refused outside the Group', async () => {
    const empty = await seedEnergyGroups()
    expect(
      await empty.t.withIdentity(bob).query(api.energyReadings.recent, HOME),
    ).toEqual([])
    const { t } = await seedMeters()
    await expect(
      t.withIdentity(carol).query(api.energyReadings.recent, HOME),
    ).rejects.toThrow('groups:not-a-member')
    await expect(t.query(api.energyReadings.recent, HOME)).rejects.toThrow()
  })
})

describe('remove', () => {
  async function seedRead() {
    const seeded = await seedMeters()
    const ids = await seeded.t.run(async (ctx) => ({
      first: await insertReading(ctx, seeded.homeId, seeded.importT1, '2026-11-01', 1000),
      middle: await insertReading(ctx, seeded.homeId, seeded.importT1, '2026-11-06', 1010),
      last: await insertReading(ctx, seeded.homeId, seeded.importT1, '2026-11-11', 1040),
    }))
    return { ...seeded, ...ids }
  }

  const rows = (t: Awaited<ReturnType<typeof seedRead>>['t']) =>
    t.run((ctx) => ctx.db.query('energyReadings').collect())

  test('a Member deletes one typed reading, and only that one', async () => {
    const { t, first, middle, last } = await seedRead()
    await t
      .withIdentity(bob)
      .mutation(api.energyReadings.remove, { ...HOME, readingId: middle })
    expect((await rows(t)).map((row) => row._id)).toEqual([first, last])
  })

  test('usage and costs for the days around it are worked out again', async () => {
    const { t, homeId, siteId, middle } = await seedRead()
    await t.run((ctx) => insertContract(ctx, homeId, siteId, FIXED_TERMS))
    const month = { ...HOME, month: '2026-11', today: '2026-11-20' }
    const as = t.withIdentity(bob)
    const dayOf = async (day: string) =>
      (await as.query(api.energyUsage.month, month))?.days.find(
        (each) => each.day === day,
      )

    // 10 kWh over the five days to the 6th, 30 over the five after it.
    const before = await dayOf('2026-11-03')
    expect(before?.importKwh).toBeCloseTo(2)
    const beforeCost = before?.cost?.importCents
    expect((await dayOf('2026-11-08'))?.importKwh).toBeCloseTo(6)

    await as.mutation(api.energyReadings.remove, { ...HOME, readingId: middle })

    // Now 40 kWh spread evenly over the ten days, either side of the 6th.
    const after = await dayOf('2026-11-03')
    expect(after?.importKwh).toBeCloseTo(4)
    expect((await dayOf('2026-11-08'))?.importKwh).toBeCloseTo(4)
    expect(after?.cost?.importCents).toBeGreaterThan(beforeCost ?? Infinity)
  })

  test('refuses outside the Group, and signed out, and deletes nothing', async () => {
    const { t, middle } = await seedRead()
    const args = { ...HOME, readingId: middle }
    await expect(
      t.withIdentity(carol).mutation(api.energyReadings.remove, args),
    ).rejects.toThrow('groups:not-a-member')
    // Carol's own Group cannot reach it either: not found, like a missing one.
    await expect(
      t
        .withIdentity(carol)
        .mutation(api.energyReadings.remove, { groupSlug: 'other', readingId: middle }),
    ).rejects.toThrow('energy:readingNotFound')
    await expect(t.mutation(api.energyReadings.remove, args)).rejects.toThrow()
    expect(await rows(t)).toHaveLength(3)
  })

  test('refuses an unknown id, and an imported reading, as not found', async () => {
    const { t, homeId, siteId, aliceId, middle } = await seedRead()
    const imported = await t.run(async (ctx) => {
      const sourceId = await ctx.db.insert('energySources', {
        groupId: homeId,
        siteId,
        kind: 'homeAssistant',
        label: 'Home Assistant',
        status: 'ok',
        connectedByUserId: aliceId,
      })
      const channelId = await ctx.db.insert('energyChannels', {
        groupId: homeId,
        siteId,
        sourceId,
        kind: 'solar',
        unit: 'kWh',
      })
      return insertReading(ctx, homeId, channelId, '2026-11-15', 5)
    })
    const as = t.withIdentity(bob)
    await as.mutation(api.energyReadings.remove, { ...HOME, readingId: middle })
    // Deleted once, it is gone: asking again is not found.
    await expect(
      as.mutation(api.energyReadings.remove, { ...HOME, readingId: middle }),
    ).rejects.toThrow('energy:readingNotFound')
    await expect(
      as.mutation(api.energyReadings.remove, { ...HOME, readingId: imported }),
    ).rejects.toThrow('energy:readingNotFound')
    expect(await rows(t)).toHaveLength(3)
  })

  test("refuses a retired meter's reading as not found, and deletes nothing", async () => {
    // A retired meter can come back; deleting its readings would change past usage.
    const { t, importT1, middle } = await seedRead()
    await t.run((ctx) => ctx.db.patch(importT1, { retiredAt: NOW }))
    await expect(
      t
        .withIdentity(bob)
        .mutation(api.energyReadings.remove, { ...HOME, readingId: middle }),
    ).rejects.toThrow('energy:readingNotFound')
    expect(await rows(t)).toHaveLength(3)
  })
})
