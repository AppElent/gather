/**
 * Energy usage and costs per day, computed from readings and hourly intervals
 * (APP-494). No rollup table: a month reads its own rows, which stays well
 * inside a query's limits (a site with seven hourly channels reads about
 * 5,200 intervals and 3,000 quarter-hour prices a month). A year is twelve
 * month queries, so no single query ever reads a whole year of hours.
 *
 * A channel of a manual source counts from its readings, spread over days
 * and marked estimated; any other channel counts from its intervals.
 */
import { addDays } from '@gather/core/civil-date'
import {
  addEnergyCosts,
  amsterdamDayOf,
  amsterdamDayStart,
  type EnergyByTariff,
  type EnergyContractTerms,
  type EnergyCost,
  type EnergyDayUse,
  energyContractOn,
  energyDayCost,
  netMeteringOn,
  primaryEnergySite,
  spreadReadingsOverDays,
} from '@gather/core/energy'
import { v } from 'convex/values'
import type { Doc, Id } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'

const HOUR_MS = 3_600_000
const DEFAULT_PRICE_PROVIDER = 'energyzero'

export const energyCostValidator = v.object({
  importCents: v.number(),
  exportCents: v.number(),
  gasCents: v.number(),
  fixedCents: v.number(),
  creditCents: v.number(),
  totalCents: v.number(),
})

export const energyCostStatusValidator = v.union(
  v.literal('ok'),
  v.literal('noData'),
  v.literal('noContract'),
  v.literal('noPrices'),
)
export type EnergyCostStatus = 'ok' | 'noData' | 'noContract' | 'noPrices'

export const energyDayValidator = v.object({
  day: v.string(),
  hasData: v.boolean(),
  estimated: v.boolean(),
  importKwh: v.number(),
  exportKwh: v.number(),
  solarKwh: v.union(v.number(), v.null()),
  gasM3: v.union(v.number(), v.null()),
  batteryChargeKwh: v.union(v.number(), v.null()),
  batteryDischargeKwh: v.union(v.number(), v.null()),
  consumptionKwh: v.number(),
  /** With net metering when the day's contract has it, else as below. */
  cost: v.union(energyCostValidator, v.null()),
  /** Always without net metering: what the day costs from 2027. */
  costWithoutNet: v.union(energyCostValidator, v.null()),
  costStatus: energyCostStatusValidator,
})
export type EnergyDay = typeof energyDayValidator.type

export const energyHourValidator = v.object({
  hourStart: v.number(),
  hasData: v.boolean(),
  importKwh: v.number(),
  exportKwh: v.number(),
  solarKwh: v.union(v.number(), v.null()),
  batteryChargeKwh: v.union(v.number(), v.null()),
  batteryDischargeKwh: v.union(v.number(), v.null()),
  /** What the home used that hour, by the same rule as a day's. */
  consumptionKwh: v.number(),
  /** Average state of charge in that hour, in percent. */
  socPercent: v.union(v.number(), v.null()),
})
export type EnergyHour = typeof energyHourValidator.type

export const energyChannelsPresentValidator = v.object({
  gridImport: v.boolean(),
  gridExport: v.boolean(),
  solar: v.boolean(),
  gas: v.boolean(),
  battery: v.boolean(),
  batterySoc: v.boolean(),
})

type ChannelWithSource = {
  channel: Doc<'energyChannels'>
  manual: boolean
}

/** A site's channels, each with whether its source is typed readings. */
export async function siteChannels(
  ctx: QueryCtx,
  siteId: Id<'energySites'>,
): Promise<ChannelWithSource[]> {
  const [channels, sources] = await Promise.all([
    ctx.db
      .query('energyChannels')
      .withIndex('by_site', (q) => q.eq('siteId', siteId))
      .collect(),
    ctx.db
      .query('energySources')
      .withIndex('by_site', (q) => q.eq('siteId', siteId))
      .collect(),
  ])
  const manualSources = new Set(
    sources.filter((source) => source.kind === 'manual').map((s) => s._id),
  )
  return channels.map((channel) => ({
    channel,
    manual: manualSources.has(channel.sourceId),
  }))
}

export function channelsPresent(channels: readonly ChannelWithSource[]) {
  const has = (kind: Doc<'energyChannels'>['kind']) =>
    channels.some((each) => each.channel.kind === kind)
  return {
    gridImport: has('gridImport'),
    gridExport: has('gridExport'),
    solar: has('solar'),
    gas: has('gas'),
    battery: has('batteryCharge') || has('batteryDischarge'),
    batterySoc: has('batterySoc'),
  }
}

/** Whether any channel has hourly data: a source other than typed readings. */
export function hasHourlySource(channels: readonly ChannelWithSource[]) {
  return channels.some((each) => !each.manual)
}

type Bucket = {
  hasData: boolean
  estimated: boolean
  /** Only grid import and export: whether hourly pricing can be trusted. */
  electricityEstimated: boolean
  importKwh: EnergyByTariff
  exportKwh: EnergyByTariff
  solar: number | null
  gas: number | null
  charge: number | null
  discharge: number | null
  socSum: number
  socCount: number
}

function emptyBucket(): Bucket {
  return {
    hasData: false,
    estimated: false,
    electricityEstimated: false,
    importKwh: { t1: 0, t2: 0, single: 0 },
    exportKwh: { t1: 0, t2: 0, single: 0 },
    solar: null,
    gas: null,
    charge: null,
    discharge: null,
    socSum: 0,
    socCount: 0,
  }
}

function addTo(
  bucket: Bucket,
  channel: Doc<'energyChannels'>,
  amount: number,
  estimated: boolean,
) {
  bucket.hasData = true
  if (estimated) bucket.estimated = true
  if (
    estimated &&
    (channel.kind === 'gridImport' || channel.kind === 'gridExport')
  ) {
    bucket.electricityEstimated = true
  }
  const tariff = channel.tariff ?? 'single'
  switch (channel.kind) {
    case 'gridImport':
      bucket.importKwh[tariff] += amount
      break
    case 'gridExport':
      bucket.exportKwh[tariff] += amount
      break
    case 'solar':
      bucket.solar = (bucket.solar ?? 0) + amount
      break
    case 'gas':
      bucket.gas = (bucket.gas ?? 0) + amount
      break
    case 'batteryCharge':
      bucket.charge = (bucket.charge ?? 0) + amount
      break
    case 'batteryDischarge':
      bucket.discharge = (bucket.discharge ?? 0) + amount
      break
    case 'batterySoc':
      bucket.socSum += amount
      bucket.socCount += 1
      break
  }
}

function sum(tariffs: EnergyByTariff) {
  return tariffs.t1 + tariffs.t2 + tariffs.single
}

function consumption(bucket: Bucket, hasSolar: boolean) {
  const importKwh = sum(bucket.importKwh)
  if (!hasSolar) return importKwh
  return (
    importKwh -
    sum(bucket.exportKwh) +
    (bucket.solar ?? 0) +
    (bucket.discharge ?? 0) -
    (bucket.charge ?? 0)
  )
}

type PriceSlot = { start: number; eurPerUnit: number }

/**
 * The prices a site is priced at in [start, end): its account feed's when it
 * has one, otherwise the market prices of its feed's provider (EnergyZero by
 * default). Read only when a dynamic contract needs them.
 */
async function loadPrices(
  ctx: QueryCtx,
  siteId: Id<'energySites'>,
  start: number,
  end: number,
) {
  const feed = await ctx.db
    .query('energyPriceFeeds')
    .withIndex('by_site', (q) => q.eq('siteId', siteId))
    .first()
  const read = async (carrier: 'electricity' | 'gas', from: number) => {
    if (feed && feed.scope === 'account') {
      return ctx.db
        .query('energyPrices')
        .withIndex('by_feed_carrier_start', (q) =>
          q
            .eq('feedId', feed._id)
            .eq('carrier', carrier)
            .gte('start', from)
            .lt('start', end),
        )
        .collect()
    }
    const rows = await ctx.db
      .query('energyPrices')
      .withIndex('by_provider_carrier_start', (q) =>
        q
          .eq('provider', feed?.provider ?? DEFAULT_PRICE_PROVIDER)
          .eq('carrier', carrier)
          .gte('start', from)
          .lt('start', end),
      )
      .collect()
    return rows.filter((row) => row.feedId === undefined)
  }
  const [electricity, gas] = await Promise.all([
    read('electricity', start),
    read('gas', start),
  ])
  return {
    allIn: Boolean(feed && feed.scope === 'account' && feed.includesTaxes),
    electricity: electricity.map(({ start, eurPerUnit }) => ({
      start,
      eurPerUnit,
    })),
    gas: gas.map(({ start, eurPerUnit }) => ({ start, eurPerUnit })),
  }
}

function average(slots: readonly PriceSlot[], from: number, to: number) {
  let total = 0
  let count = 0
  for (const slot of slots) {
    if (slot.start < from || slot.start >= to) continue
    total += slot.eurPerUnit
    count += 1
  }
  return count === 0 ? null : total / count
}

export interface EnergyRange {
  days: EnergyDay[]
  /** Per hour, only when asked for and only from hourly sources. */
  hours: EnergyHour[]
  contracts: Doc<'energyContracts'>[]
}

/**
 * Usage and costs for each of `days` (consecutive, in order). With
 * `hourly`, also each hour of the range from hourly sources.
 */
export async function computeEnergyRange(
  ctx: QueryCtx,
  site: Doc<'energySites'>,
  channels: readonly ChannelWithSource[],
  days: readonly string[],
  options: { hourly?: boolean } = {},
): Promise<EnergyRange> {
  const first = days[0]
  const last = days[days.length - 1]
  if (!first || !last) return { days: [], hours: [], contracts: [] }
  const start = amsterdamDayStart(first)
  const end = amsterdamDayStart(addDays(last, 1))
  const hasSolar = channels.some((each) => each.channel.kind === 'solar')

  const dayBuckets = new Map(days.map((day) => [day, emptyBucket()]))
  // Hourly sources are bucketed per hour too, so a dynamic contract prices
  // them hour by hour in a month just as in a day.
  const hourBuckets = new Map<number, Bucket>()
  if (channels.some((each) => !each.manual)) {
    for (let at = start; at < end; at += HOUR_MS) {
      hourBuckets.set(at, emptyBucket())
    }
  }

  for (const { channel, manual } of channels) {
    if (manual) {
      if (channel.kind === 'batterySoc') continue
      const [before, inside, after] = await Promise.all([
        ctx.db
          .query('energyReadings')
          .withIndex('by_channel_at', (q) =>
            q.eq('channelId', channel._id).lt('at', start),
          )
          .order('desc')
          .first(),
        ctx.db
          .query('energyReadings')
          .withIndex('by_channel_at', (q) =>
            q.eq('channelId', channel._id).gte('at', start).lt('at', end),
          )
          .collect(),
        ctx.db
          .query('energyReadings')
          .withIndex('by_channel_at', (q) =>
            q.eq('channelId', channel._id).gte('at', end),
          )
          .first(),
      ])
      const readings = [
        ...(before ? [before] : []),
        ...inside,
        ...(after ? [after] : []),
      ]
      const spread = spreadReadingsOverDays(readings, days)
      spread.forEach((amount, index) => {
        const bucket = dayBuckets.get(days[index] as string)
        if (amount !== null && bucket) addTo(bucket, channel, amount, true)
      })
      continue
    }
    const intervals = await ctx.db
      .query('energyIntervals')
      .withIndex('by_channel_hour', (q) =>
        q.eq('channelId', channel._id).gte('hourStart', start).lt('hourStart', end),
      )
      .collect()
    // State of charge is a level, not an amount: a day's figure is the
    // average of its hours, so it is only kept per hour.
    for (const interval of intervals) {
      const dayBucket = dayBuckets.get(amsterdamDayOf(interval.hourStart))
      if (dayBucket && channel.kind !== 'batterySoc') {
        addTo(dayBucket, channel, interval.amount, interval.estimated)
      }
      const hourBucket = hourBuckets.get(interval.hourStart)
      if (hourBucket) {
        addTo(hourBucket, channel, interval.amount, interval.estimated)
      }
    }
  }

  const contracts = await ctx.db
    .query('energyContracts')
    .withIndex('by_site_validFrom', (q) => q.eq('siteId', site._id))
    .collect()
  const needsPrices = days.some(
    (day) => energyContractOn(contracts, day)?.kind === 'dynamic',
  )
  const prices = needsPrices
    ? await loadPrices(ctx, site._id, start, end)
    : { allIn: false, electricity: [], gas: [] }

  const hourlyChannels = channels.some(
    (each) => !each.manual && each.channel.kind === 'gridImport',
  )

  const result: EnergyDay[] = days.map((day) => {
    const bucket = dayBuckets.get(day) ?? emptyBucket()
    const base = {
      day,
      hasData: bucket.hasData,
      estimated: bucket.estimated,
      importKwh: sum(bucket.importKwh),
      exportKwh: sum(bucket.exportKwh),
      solarKwh: bucket.solar,
      gasM3: bucket.gas,
      batteryChargeKwh: bucket.charge,
      batteryDischargeKwh: bucket.discharge,
      consumptionKwh: consumption(bucket, hasSolar),
    }
    if (!bucket.hasData) {
      return { ...base, cost: null, costWithoutNet: null, costStatus: 'noData' as const }
    }
    const contract = energyContractOn(contracts, day)
    if (!contract) {
      return {
        ...base,
        cost: null,
        costWithoutNet: null,
        costStatus: 'noContract' as const,
      }
    }
    const dayStart = amsterdamDayStart(day)
    const dayEnd = amsterdamDayStart(addDays(day, 1))
    let hours: EnergyDayUse['hours']
    if (contract.kind === 'dynamic' && hourlyChannels && !bucket.electricityEstimated) {
      const priced: NonNullable<EnergyDayUse['hours']>[number][] = []
      for (let at = dayStart; at < dayEnd; at += HOUR_MS) {
        const hour = hourBuckets.get(at)
        priced.push({
          importKwh: hour ? sum(hour.importKwh) : 0,
          exportKwh: hour ? sum(hour.exportKwh) : 0,
          marketEurPerKwh: average(prices.electricity, at, at + HOUR_MS),
        })
      }
      hours = priced
    }
    // Typed readings have no hours: such a day is priced at its average
    // market price.
    const use: EnergyDayUse = {
      day,
      importKwh: bucket.importKwh,
      exportKwh: bucket.exportKwh,
      gasM3: bucket.gas,
      hours,
      marketEurPerKwh: average(prices.electricity, dayStart, dayEnd),
      gasMarketEurPerM3: average(prices.gas, dayStart, dayEnd),
      allInPrices: prices.allIn,
    }
    const terms = contract as EnergyContractTerms
    const costWithoutNet = energyDayCost(use, terms, { netMetering: false })
    const cost = netMeteringOn(contract, day)
      ? energyDayCost(use, terms, { netMetering: true })
      : costWithoutNet
    return {
      ...base,
      cost,
      costWithoutNet,
      costStatus: cost ? ('ok' as const) : ('noPrices' as const),
    }
  })

  const hours: EnergyHour[] = !options.hourly
    ? []
    : [...hourBuckets.entries()].map(
    ([hourStart, bucket]) => ({
      hourStart,
      hasData: bucket.hasData,
      importKwh: sum(bucket.importKwh),
      exportKwh: sum(bucket.exportKwh),
      solarKwh: bucket.solar,
      batteryChargeKwh: bucket.charge,
      batteryDischargeKwh: bucket.discharge,
      consumptionKwh: consumption(bucket, hasSolar),
      socPercent: bucket.socCount ? bucket.socSum / bucket.socCount : null,
    }),
  )

  return { days: result, hours, contracts }
}

/** Sum the costs of the days that have one; null when none has. */
export function sumCosts(
  costs: readonly (EnergyCost | null)[],
): EnergyCost | null {
  let total: EnergyCost | null = null
  for (const cost of costs) {
    if (cost) total = total ? addEnergyCosts(total, cost) : cost
  }
  return total
}

/**
 * The site the Module opens on, or null while the Group has none. Every
 * Energy screen reads this one site (APP-492 shows one address).
 */
export async function primarySiteOf(ctx: QueryCtx, groupId: Id<'groups'>) {
  const sites = await ctx.db
    .query('energySites')
    .withIndex('by_group', (q) => q.eq('groupId', groupId))
    .collect()
  return primaryEnergySite(sites) ?? null
}
