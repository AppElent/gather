import { describe, expect, test } from 'vitest'
import { alice, bob, carol } from '../test/convexHarness'
import {
  DYNAMIC_TERMS,
  FIXED_TERMS,
  HOME,
  insertContract,
  insertSite,
  seedEnergyGroups,
} from '../test/energyUsageFixture'
import { api } from './_generated/api'

/**
 * Energy contracts (APP-494): new tariffs are a new contract from their own
 * day, and only the latest contract may change.
 */

async function seedSite() {
  const seeded = await seedEnergyGroups()
  const siteId = await seeded.t.run((ctx) =>
    insertSite(ctx, seeded.homeId, seeded.aliceId),
  )
  return { ...seeded, siteId }
}

describe('save', () => {
  test('saves a new contract, trimming the supplier', async () => {
    const { t, homeId, siteId } = await seedSite()
    const id = await t.withIdentity(bob).mutation(api.energyContracts.save, {
      ...HOME,
      terms: { ...FIXED_TERMS, supplierName: '  Eneco  ' },
    })
    const row = await t.run((ctx) => ctx.db.get(id))
    expect(row).toMatchObject({
      groupId: homeId,
      siteId,
      ...FIXED_TERMS,
      supplierName: 'Eneco',
    })
  })

  test('edits the latest contract in place', async () => {
    const { t } = await seedSite()
    const as = t.withIdentity(bob)
    const id = await as.mutation(api.energyContracts.save, {
      ...HOME,
      terms: FIXED_TERMS,
    })
    const again = await as.mutation(api.energyContracts.save, {
      ...HOME,
      contractId: id,
      terms: { ...FIXED_TERMS, supplierName: '', vatPercent: 9 },
    })
    expect(again).toBe(id)
    const rows = await t.run((ctx) => ctx.db.query('energyContracts').collect())
    expect(rows).toHaveLength(1)
    expect(rows[0]?.vatPercent).toBe(9)
    expect(rows[0]?.supplierName).toBeUndefined()
  })

  test('refuses to edit an earlier contract, or move the latest before another', async () => {
    const { t, homeId, siteId } = await seedSite()
    const { earlier, latest } = await t.run(async (ctx) => ({
      earlier: await insertContract(ctx, homeId, siteId, FIXED_TERMS),
      latest: await insertContract(ctx, homeId, siteId, {
        ...FIXED_TERMS,
        validFrom: '2026-07-01',
      }),
    }))
    const as = t.withIdentity(bob)
    await expect(
      as.mutation(api.energyContracts.save, {
        ...HOME,
        contractId: earlier,
        terms: { ...FIXED_TERMS, vatPercent: 9 },
      }),
    ).rejects.toThrow('energy:notFound')
    await expect(
      as.mutation(api.energyContracts.save, {
        ...HOME,
        contractId: latest,
        terms: { ...FIXED_TERMS, validFrom: '2025-12-01' },
      }),
    ).rejects.toThrow('energy:notFound')
    const rows = await t.run((ctx) => ctx.db.query('energyContracts').collect())
    expect(rows.map((row) => [row.validFrom, row.vatPercent])).toEqual([
      ['2026-01-01', 21],
      ['2026-07-01', 21],
    ])
  })

  test('refuses a second contract from the same day', async () => {
    const { t } = await seedSite()
    const as = t.withIdentity(bob)
    await as.mutation(api.energyContracts.save, { ...HOME, terms: FIXED_TERMS })
    await expect(
      as.mutation(api.energyContracts.save, { ...HOME, terms: DYNAMIC_TERMS }),
    ).rejects.toThrow('energy:contractDateTaken')
  })

  test('refuses an invalid date or amount, or a fixed contract without tariffs', async () => {
    const { t } = await seedSite()
    const as = t.withIdentity(bob)
    for (const terms of [
      { ...FIXED_TERMS, validFrom: '1 januari' },
      { ...FIXED_TERMS, vatPercent: 121 },
      { ...FIXED_TERMS, energyTaxEurPerKwh: -0.1 },
      { ...FIXED_TERMS, monthlyFixedCents: -1 },
      { ...FIXED_TERMS, fixedTariffs: undefined },
    ]) {
      await expect(
        as.mutation(api.energyContracts.save, { ...HOME, terms }),
      ).rejects.toThrow('energy:contractInvalid')
    }
    expect(
      await t.run((ctx) => ctx.db.query('energyContracts').collect()),
    ).toEqual([])
  })

  test('drops fixed tariffs from a dynamic contract, and rounds cents', async () => {
    const { t } = await seedSite()
    const id = await t.withIdentity(bob).mutation(api.energyContracts.save, {
      ...HOME,
      terms: {
        ...DYNAMIC_TERMS,
        fixedTariffs: FIXED_TERMS.fixedTariffs,
        monthlyFixedCents: 2804.6,
        yearlyTaxCreditCents: 52494.6,
      },
    })
    const row = await t.run((ctx) => ctx.db.get(id))
    expect(row?.kind).toBe('dynamic')
    expect(row?.fixedTariffs).toBeUndefined()
    expect(row?.monthlyFixedCents).toBe(2805)
    expect(row?.yearlyTaxCreditCents).toBe(52495)
  })

  test('refuses without an address, a contract of another Group, outsiders and the signed out', async () => {
    const empty = await seedEnergyGroups()
    await expect(
      empty.t
        .withIdentity(alice)
        .mutation(api.energyContracts.save, { ...HOME, terms: FIXED_TERMS }),
    ).rejects.toThrow('energy:notFound')

    const { t, otherId, carolId } = await seedSite()
    const theirs = await t.run(async (ctx) => {
      const site = await insertSite(ctx, otherId, carolId)
      return insertContract(ctx, otherId, site, FIXED_TERMS)
    })
    await expect(
      t.withIdentity(bob).mutation(api.energyContracts.save, {
        ...HOME,
        contractId: theirs,
        terms: { ...FIXED_TERMS, validFrom: '2026-02-01' },
      }),
    ).rejects.toThrow('energy:notFound')
    expect((await t.run((ctx) => ctx.db.get(theirs)))?.validFrom).toBe(
      '2026-01-01',
    )
    await expect(
      t
        .withIdentity(carol)
        .mutation(api.energyContracts.save, { ...HOME, terms: FIXED_TERMS }),
    ).rejects.toThrow()
    await expect(
      t.mutation(api.energyContracts.save, { ...HOME, terms: FIXED_TERMS }),
    ).rejects.toThrow()
  })
})

describe('list', () => {
  test('newest first, with the terms and without owner fields', async () => {
    const { t, homeId, siteId } = await seedSite()
    await t.run(async (ctx) => {
      await insertContract(ctx, homeId, siteId, FIXED_TERMS)
      await insertContract(ctx, homeId, siteId, {
        ...DYNAMIC_TERMS,
        validFrom: '2026-09-01',
      })
      await insertContract(ctx, homeId, siteId, {
        ...FIXED_TERMS,
        validFrom: '2026-04-01',
      })
    })
    const list = await t
      .withIdentity(bob)
      .query(api.energyContracts.list, HOME)
    expect(list?.map((each) => each.terms.validFrom)).toEqual([
      '2026-09-01',
      '2026-04-01',
      '2026-01-01',
    ])
    expect(list?.[0]?.terms).toEqual({ ...DYNAMIC_TERMS, validFrom: '2026-09-01' })
    expect(list?.[0]?.terms).not.toHaveProperty('groupId')
  })

  test('is null without an address, and refused outside the Group', async () => {
    const empty = await seedEnergyGroups()
    expect(
      await empty.t.withIdentity(bob).query(api.energyContracts.list, HOME),
    ).toBeNull()
    const { t } = await seedSite()
    await expect(
      t.withIdentity(carol).query(api.energyContracts.list, HOME),
    ).rejects.toThrow()
    await expect(t.query(api.energyContracts.list, HOME)).rejects.toThrow()
  })
})
