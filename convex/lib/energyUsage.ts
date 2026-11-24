/**
 * Energy usage and costs per day, computed from readings and hourly intervals
 * (APP-494). No rollup table: a month reads its own rows, which stays well
 * inside a query's limits (a site with seven hourly channels reads about
 * 5,200 intervals and 3,000 quarter-hour prices a month). A year is twelve
 * month queries, so no single query ever reads a whole year of hours.
 *
 * A channel of a manual source counts from its readings, spread over days
 * and marked estimated; any other channel counts from its intervals. A typed
 * meter adds nothing between the first and the last hour hourly channels measured
 * of the same thing: hours missed in between are in the next one they have.
 */
import { addDays } from '@gather/core/civil-date'
import {
  addEnergyCosts,
  amsterdamDayOf,
  amsterdamDayStart,
  DEFAULT_ENERGY_PRICE_PROVIDER,
  type EnergyByTariff,
  type EnergyContractTerms,
  type EnergyCost,
  type EnergyDayUse,
  type EnergyElectricityPrice,
  energyContractOn,
  energyDayCost,
  energyNetMetering,
  netMeteringOn,
  primaryEnergySite,
  spreadReadingsOverDays,
} from '@gather/core/energy'
import { v } from 'convex/values'
import type { Doc, Id } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { accountPrices, firstAccountPrice, marketPrices, priceFeedsOf } from './energyPriceRows'

const HOUR_MS = 3_600_000

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

type SitePrices = {
  /** The prices over [from, to) of one day. */
  electricity: (from: number, to: number) => EnergyElectricityPrice
  gas: PriceSlot[]
}

const NO_PRICES: SitePrices = {
  electricity: () => ({ marketEurPerKwh: null }),
  gas: [],
}

/**
 * The prices a site is priced at in [start, end), whole days. Read only when a
 * dynamic contract needs them.
 *
 * A day with account prices is priced at those; every other day at the market
 * price of the feed's provider, and at EnergyZero's, the same auction, where
 * that has none. Account days stay account days when the feed is given
 * another provider later, so it rewrites no month. Export always earns the
 * market price: an account price holds tax. Gas is always EnergyZero's, for
 * the contract to price.
 */
async function loadPrices(
  ctx: QueryCtx,
  siteId: Id<'energySites'>,
  days: readonly string[],
  start: number,
  end: number,
): Promise<SitePrices> {
  const feeds = await priceFeedsOf(ctx, siteId)
  const feed = feeds[0]
  const account = (
    await Promise.all(
      feeds.map((each) => accountPrices(ctx, each._id, start, end)),
    )
  ).flat()
  const firstAccount =
    feed?.scope === 'account' ? await firstAccountPrice(ctx, feed._id) : null

  const own =
    feed?.provider === 'entsoe'
      ? await marketPrices(ctx, 'entsoe', 'electricity', start, end)
      : []
  const bounds = days.map((day) => ({
    from: amsterdamDayStart(day),
    to: amsterdamDayStart(addDays(day, 1)),
  }))
  const within = (slots: readonly PriceSlot[], at: { from: number; to: number }) =>
    slots.some((slot) => slot.start >= at.from && slot.start < at.to)
  // Only the stretch the feed's own provider leaves open.
  const open = bounds.filter((day) => !within(own, day))
  const fallback = open.length
    ? await marketPrices(
        ctx,
        DEFAULT_ENERGY_PRICE_PROVIDER,
        'electricity',
        open[0]?.from ?? start,
        open[open.length - 1]?.to ?? end,
      )
    : []
  const market: PriceSlot[] = [
    ...own,
    ...fallback.filter((slot) =>
      open.some((day) => slot.start >= day.from && slot.start < day.to),
    ),
  ]
  const allInDays = new Set(
    bounds
      .filter(
        (day) =>
          within(account, day) ||
          (firstAccount !== null && firstAccount.start <= day.from),
      )
      .map((day) => day.from),
  )
  return {
    electricity: (from, to) => {
      const marketEurPerKwh = average(market, from, to)
      const day = bounds.find((each) => from >= each.from && from < each.to)
      return day && allInDays.has(day.from)
        ? { marketEurPerKwh, allInEurPerKwh: average(account, from, to) }
        : { marketEurPerKwh }
    },
    gas: await marketPrices(ctx, DEFAULT_ENERGY_PRICE_PROVIDER, 'gas', start, end),
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

/**
 * The time an hourly channel measured, from its first stored hour to its last.
 * Home Assistant adds the hours it missed to the next one it has, so time
 * without rows in between is counted too (APP-495).
 */
async function measuredSpan(ctx: QueryCtx, channelId: Id<'energyChannels'>) {
  const hours = () =>
    ctx.db
      .query('energyIntervals')
      .withIndex('by_channel_hour', (q) => q.eq('channelId', channelId))
  const [first, last] = await Promise.all([
    hours().order('asc').first(),
    hours().order('desc').first(),
  ])
  if (!first || !last) return null
  return {
    from: first.hourStart,
    to: last.hourStart + HOUR_MS,
  }
}

type Span = { from: number; to: number }

/** The share of `day` inside any of `spans`. */
function shareWithin(spans: readonly Span[], day: Span) {
  let covered = 0
  let until = day.from
  for (const span of [...spans].sort((a, b) => a.from - b.from)) {
    const from = Math.max(span.from, until)
    const to = Math.min(span.to, day.to)
    if (to <= from) continue
    covered += to - from
    until = to
  }
  return covered / (day.to - day.from)
}

/**
 * Whether an hour of `channel` is counted by another hourly one as well: a
 * total's by its two tariffs together, one tariff's by a total without both.
 */
function countedTwice(
  hourly: readonly {
    channel: Doc<'energyChannels'>
    intervals: readonly Doc<'energyIntervals'>[]
  }[],
) {
  const key = (
    { kind, tariff }: Pick<Doc<'energyChannels'>, 'kind' | 'tariff'>,
    hourStart: number,
  ) => `${kind}:${tariff ?? 'total'}:${hourStart}`
  const stored = new Set<string>()
  for (const { channel, intervals } of hourly) {
    for (const each of intervals) stored.add(key(channel, each.hourStart))
  }
  return ({ kind, tariff }: Doc<'energyChannels'>, hourStart: number) => {
    const has = (of: 't1' | 't2' | undefined) =>
      stored.has(key({ kind, tariff: of }, hourStart))
    const pair = has('t1') && has('t2')
    return tariff ? has(undefined) && !pair : pair
  }
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

  // What hourly sources measured decides what may still be added from typed
  // readings and from counters that overlap (APP-495).
  const hourly = await Promise.all(
    channels
      .filter((each) => !each.manual)
      .map(async ({ channel }) => ({
        channel,
        intervals: await ctx.db
          .query('energyIntervals')
          .withIndex('by_channel_hour', (q) =>
            q
              .eq('channelId', channel._id)
              .gte('hourStart', start)
              .lt('hourStart', end),
          )
          .collect(),
      })),
  )
  const spans: ({ channel: Doc<'energyChannels'> } & Span)[] = []
  if (channels.some((each) => each.manual)) {
    await Promise.all(
      hourly.map(async ({ channel }) => {
        const span = await measuredSpan(ctx, channel._id)
        if (span) spans.push({ channel, ...span })
      }),
    )
  }
  // Typed meters of every tariff: when they were read, and the hours measured.
  const typedTotals: (Span & {
    kind: Doc<'energyChannels'>['kind']
    whole: Span[]
  })[] = []
  for (const { channel, manual } of channels) {
    if (!manual || channel.kind === 'batterySoc') continue
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
    const from = readings[0]?.at
    const to = readings[readings.length - 1]?.at
    if (from === undefined || to === undefined) continue
    const same = spans.filter((each) => each.channel.kind === channel.kind)
    const of = (tariff: 't1' | 't2') =>
      same.filter((each) => each.channel.tariff === tariff)
    // Where hours count all this meter counts: a total, its own tariff, or
    // for a meter of every tariff both of them.
    const whole: Span[] = same.filter(
      (each) => !each.channel.tariff || each.channel.tariff === channel.tariff,
    )
    if (!channel.tariff) {
      for (const t1 of of('t1')) {
        for (const t2 of of('t2')) {
          whole.push({
            from: Math.max(t1.from, t2.from),
            to: Math.min(t1.to, t2.to),
          })
        }
      }
      typedTotals.push({ kind: channel.kind, from, to, whole })
    }
    // Each stretch between two readings loses the part hours count already.
    for (const [index, reading] of readings.entries()) {
      const next = readings[index + 1]
      if (!next) continue
      const spread = spreadReadingsOverDays([reading, next], days)
      for (const [dayIndex, amount] of spread.entries()) {
        const day = days[dayIndex] as string
        const bucket = dayBuckets.get(day)
        if (amount === null || !bucket) continue
        const share = shareWithin(whole, {
          from: Math.max(reading.at, amsterdamDayStart(day)),
          to: Math.min(next.at, amsterdamDayStart(addDays(day, 1))),
        })
        if (share < 1) addTo(bucket, channel, amount * (1 - share), true)
      }
    }
  }

  const twice = countedTwice(hourly)
  for (const { channel, intervals } of hourly) {
    for (const interval of intervals) {
      const at = interval.hourStart
      if (twice(channel, at)) continue
      // State of charge is a level, not an amount: a day's figure is the
      // average of its hours, so it is only kept per hour.
      const dayBucket = dayBuckets.get(amsterdamDayOf(at))
      // One tariff alone is already in what a typed meter of both counted.
      const typed =
        channel.tariff !== undefined &&
        typedTotals.some(
          (each) =>
            each.kind === channel.kind &&
            each.from <= at &&
            at < each.to &&
            !each.whole.some((span) => span.from <= at && at < span.to),
        )
      if (dayBucket && channel.kind !== 'batterySoc' && !typed) {
        addTo(dayBucket, channel, interval.amount, interval.estimated)
      }
      const hourBucket = hourBuckets.get(at)
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
    ? await loadPrices(ctx, site._id, days, start, end)
    : NO_PRICES

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
          ...prices.electricity(at, at + HOUR_MS),
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
      ...prices.electricity(dayStart, dayEnd),
      gasMarketEurPerM3: average(prices.gas, dayStart, dayEnd),
    }
    const costWithoutNet = energyDayCost(use, contract as EnergyContractTerms)
    return {
      ...base,
      // Net metering is applied to the whole month below.
      cost: costWithoutNet,
      costWithoutNet,
      costStatus: costWithoutNet ? ('ok' as const) : ('noPrices' as const),
    }
  })
  netEachMonth(result, contracts)

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

/**
 * Net metering per month and contract over the days given (a month so far):
 * each costed day under a contract with net metering gets its share of that
 * contract's netting in the month (`energyNetMetering`). Changes `days` in place.
 */
function netEachMonth(
  days: EnergyDay[],
  contracts: readonly Doc<'energyContracts'>[],
) {
  const months = new Map<string, EnergyDay[]>()
  for (const day of days) {
    const contract = energyContractOn(contracts, day.day)
    if (!day.costWithoutNet || !contract || !netMeteringOn(contract, day.day)) {
      continue
    }
    // Each contract settles its own days: a supplier switch mid-month nets
    // the two parts apart.
    const key = `${contract._id}:${day.day.slice(0, 7)}`
    months.set(key, [...(months.get(key) ?? []), day])
  }
  for (const netted of months.values()) {
    const costs = energyNetMetering(
      netted.map((day) => ({
        importKwh: day.importKwh,
        exportKwh: day.exportKwh,
        cost: day.costWithoutNet as EnergyCost,
      })),
    )
    netted.forEach((day, index) => {
      day.cost = costs[index] ?? day.cost
    })
  }
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
