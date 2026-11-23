import { amsterdamDayStart } from '@gather/core/energy'
import type { Doc, Id } from '../convex/_generated/dataModel'
import type { MutationCtx } from '../convex/_generated/server'
import { alice, bob, carol, seedGroup, seedMember, testConvex } from './convexHarness'

/**
 * A Group with one address, for the readings, usage and contract tests
 * (APP-494). Alice and Bob are in Home; Carol is in Other.
 */

export const HOME = { groupSlug: 'home' } as const
export const OTHER = { groupSlug: 'other' } as const

const HOUR = 3_600_000

/** Noon on an Amsterdam day: when a reading typed for a past day was taken. */
export function noonOn(day: string): number {
  return amsterdamDayStart(day) + 12 * HOUR
}

/** A fixed contract with Dutch 2026 tariffs, all excl. VAT. */
export const FIXED_TERMS = {
  validFrom: '2026-01-01',
  kind: 'fixed',
  supplierName: 'Eneco',
  importMarkupEurPerKwh: 0,
  exportFeeEurPerKwh: 0,
  energyTaxEurPerKwh: 0.1088,
  gasTaxEurPerM3: 0.6,
  fixedTariffs: { t1: 0.27, t2: 0.29, export: 0.06, gas: 1.1 },
  vatPercent: 21,
  monthlyFixedCents: 2805,
  yearlyTaxCreditCents: 52495,
  netMetering: true,
} satisfies Omit<Doc<'energyContracts'>, '_id' | '_creationTime' | 'groupId' | 'siteId'>

/** A dynamic contract: market price plus a markup, no fixed costs. */
export const DYNAMIC_TERMS = {
  validFrom: '2026-01-01',
  kind: 'dynamic',
  supplierName: 'Frank Energie',
  importMarkupEurPerKwh: 0.02,
  exportFeeEurPerKwh: -0.01,
  energyTaxEurPerKwh: 0.1,
  gasMarkupEurPerM3: 0.05,
  gasTaxEurPerM3: 0.6,
  vatPercent: 21,
  monthlyFixedCents: 0,
  netMetering: false,
} satisfies Omit<Doc<'energyContracts'>, '_id' | '_creationTime' | 'groupId' | 'siteId'>

export async function seedEnergyGroups() {
  const t = testConvex()
  const ids = await t.run(async (ctx) => {
    const [aliceId, bobId, carolId] = await Promise.all(
      [alice, bob, carol].map((person) =>
        ctx.db.insert('users', {
          clerkId: person.subject,
          name: person.name,
          email: person.email,
        }),
      ),
    )
    const homeId = await seedGroup(ctx, { name: 'Home', slug: 'home' })
    const otherId = await seedGroup(ctx, { name: 'Other', slug: 'other' })
    await seedMember(ctx, homeId, aliceId, 'admin')
    await seedMember(ctx, homeId, bobId, 'member')
    await seedMember(ctx, otherId, carolId, 'admin')
    return { aliceId, bobId, carolId, homeId, otherId }
  })
  return { t, ...ids }
}

export async function insertSite(
  ctx: MutationCtx,
  groupId: Id<'groups'>,
  userId: Id<'users'>,
  name = 'Thuis',
) {
  return ctx.db.insert('energySites', {
    groupId,
    name,
    createdByUserId: userId,
    order: 0,
  })
}

/**
 * A manual source with split import, single export and gas, as
 * `setupChannels` would make them.
 */
export async function insertManualMeters(
  ctx: MutationCtx,
  groupId: Id<'groups'>,
  siteId: Id<'energySites'>,
  userId: Id<'users'>,
) {
  const sourceId = await ctx.db.insert('energySources', {
    groupId,
    siteId,
    kind: 'manual',
    label: 'Meterstanden',
    status: 'ok',
    connectedByUserId: userId,
  })
  const channel = (
    kind: Doc<'energyChannels'>['kind'],
    unit: Doc<'energyChannels'>['unit'],
    tariff?: 't1' | 't2',
  ) =>
    ctx.db.insert('energyChannels', {
      groupId,
      siteId,
      sourceId,
      kind,
      unit,
      tariff,
    })
  return {
    sourceId,
    importT1: await channel('gridImport', 'kWh', 't1'),
    importT2: await channel('gridImport', 'kWh', 't2'),
    exportId: await channel('gridExport', 'kWh'),
    gas: await channel('gas', 'm3'),
  }
}

export async function insertReading(
  ctx: MutationCtx,
  groupId: Id<'groups'>,
  channelId: Id<'energyChannels'>,
  day: string,
  value: number,
) {
  return ctx.db.insert('energyReadings', {
    groupId,
    channelId,
    at: noonOn(day),
    value,
  })
}

export async function insertContract(
  ctx: MutationCtx,
  groupId: Id<'groups'>,
  siteId: Id<'energySites'>,
  terms: Omit<Doc<'energyContracts'>, '_id' | '_creationTime' | 'groupId' | 'siteId'>,
) {
  return ctx.db.insert('energyContracts', { groupId, siteId, ...terms })
}
