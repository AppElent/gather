import type { Id } from '../convex/_generated/dataModel'
import type { MutationCtx } from '../convex/_generated/server'

/** Every Group-scoped Energy table (APP-491's data model). */
export const ENERGY_GROUP_TABLES = [
  'energySites',
  'energyContracts',
  'energySources',
  'energyChannels',
  'energyAssets',
  'energyReadings',
  'energyIntervals',
  'energyPriceFeeds',
] as const

/** The secrets the fixture stores, which no export or query may carry. */
export const ENERGY_SECRETS = {
  source: 'secret-home-assistant-token',
  feed: 'secret-tibber-key',
} as const

/**
 * One address with a row in every Energy table: a contract, a Home Assistant
 * source with its token, a meter channel and a solar one, the panels, a
 * typed reading, an hour of usage, an account price feed with its key and
 * one price from it. Plus one market price, which belongs to no Group.
 *
 * Inserted directly: the functions that write most of these arrive with
 * APP-493..496, and the cascade and the export must already handle them.
 */
export async function insertEnergyHousehold(
  ctx: MutationCtx,
  groupId: Id<'groups'>,
  userId: Id<'users'>,
) {
  const siteId = await ctx.db.insert('energySites', {
    groupId,
    name: 'Thuis',
    createdByUserId: userId,
    order: 0,
  })
  await ctx.db.insert('energyContracts', {
    groupId,
    siteId,
    validFrom: '2026-01-01',
    kind: 'dynamic',
    supplierName: 'Frank Energie',
    importMarkupEurPerKwh: 0.02,
    exportFeeEurPerKwh: -0.01,
    energyTaxEurPerKwh: 0.1,
    vatPercent: 21,
    monthlyFixedCents: 3000,
    netMetering: true,
  })
  const sourceId = await ctx.db.insert('energySources', {
    groupId,
    siteId,
    kind: 'homeAssistant',
    label: 'Home Assistant',
    baseUrl: 'https://ha.example.com',
    secret: ENERGY_SECRETS.source,
    status: 'ok',
    connectedByUserId: userId,
  })
  const assetId = await ctx.db.insert('energyAssets', {
    groupId,
    siteId,
    kind: 'solar',
    name: 'Dak',
    peakWatt: 4200,
  })
  const meterId = await ctx.db.insert('energyChannels', {
    groupId,
    siteId,
    sourceId,
    kind: 'gridImport',
    tariff: 't1',
    unit: 'kWh',
    externalRef: 'sensor.p1_import_t1',
  })
  await ctx.db.insert('energyChannels', {
    groupId,
    siteId,
    sourceId,
    kind: 'solar',
    unit: 'kWh',
    assetId,
  })
  await ctx.db.insert('energyReadings', {
    groupId,
    channelId: meterId,
    at: Date.UTC(2026, 10, 1),
    value: 12345.6,
    enteredByUserId: userId,
  })
  await ctx.db.insert('energyIntervals', {
    groupId,
    channelId: meterId,
    hourStart: Date.UTC(2026, 10, 1, 7),
    amount: 0.42,
    estimated: false,
  })
  const feedId = await ctx.db.insert('energyPriceFeeds', {
    groupId,
    siteId,
    provider: 'tibber',
    scope: 'account',
    secret: ENERGY_SECRETS.feed,
    includesTaxes: true,
    status: 'ok',
  })
  const accountPriceId = await ctx.db.insert('energyPrices', {
    provider: 'tibber',
    feedId,
    carrier: 'electricity',
    start: Date.UTC(2026, 10, 1, 7),
    minutes: 15,
    eurPerUnit: 0.31,
  })
  const marketPriceId = await ctx.db.insert('energyPrices', {
    provider: 'energyzero',
    carrier: 'electricity',
    start: Date.UTC(2026, 10, 1, 7),
    minutes: 15,
    eurPerUnit: 0.11,
  })
  return { siteId, sourceId, meterId, feedId, accountPriceId, marketPriceId }
}

/** How many rows each Group-scoped Energy table still holds for `groupId`. */
export async function energyRowsOf(
  ctx: MutationCtx,
  groupId: Id<'groups'>,
): Promise<Record<(typeof ENERGY_GROUP_TABLES)[number], number>> {
  const counts = {} as Record<(typeof ENERGY_GROUP_TABLES)[number], number>
  for (const table of ENERGY_GROUP_TABLES) {
    const rows = await ctx.db
      .query(table)
      .withIndex('by_group', (q) => q.eq('groupId', groupId))
      .collect()
    counts[table] = rows.length
  }
  return counts
}
