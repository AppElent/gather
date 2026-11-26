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
  amsterdamDayHours,
  amsterdamDayOf,
  amsterdamDayStart,
  DEFAULT_ENERGY_PRICE_PROVIDER,
  type EnergyByTariff,
  type EnergyContractTerms,
  type EnergyCost,
  type EnergyDayUse,
  type EnergyElectricityPrice,
  type EnergySolarDay,
  type EnergySolarHour,
  energyContractOn,
  energyDayCost,
  energyDayFixedCost,
  energyHourImportPrice,
  energyNetMetering,
  energySolarDay,
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
  /**
   * With net metering when the day's contract has it, else as below. Only the
   * fixed costs and tax credit when `costStatus` is not `ok`.
   */
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

/**
 * A site's channels, each with whether its source is typed readings.
 *
 * Reads only the manual source: every hourly sync patches the Home Assistant
 * one, and reading it would re-run every open month, payback's past months
 * included, each hour (APP-921).
 */
export async function siteChannels(
  ctx: QueryCtx,
  siteId: Id<'energySites'>,
): Promise<ChannelWithSource[]> {
  const [channels, manual] = await Promise.all([
    ctx.db
      .query('energyChannels')
      .withIndex('by_site', (q) => q.eq('siteId', siteId))
      .collect(),
    ctx.db
      .query('energySources')
      .withIndex('by_site_kind', (q) =>
        q.eq('siteId', siteId).eq('kind', 'manual'),
      )
      .collect(),
  ])
  const manualSources = new Set(manual.map((source) => source._id))
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
  /** Per hour: whether the grid's import and export were measured at all. */
  importMeasured: boolean
  exportMeasured: boolean
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
    importMeasured: false,
    exportMeasured: false,
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
      bucket.importMeasured = true
      break
    case 'gridExport':
      bucket.exportKwh[tariff] += amount
      bucket.exportMeasured = true
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
  // Only the days the feed's own provider leaves open, so the two together
  // are never more than one price for each quarter (`MAX_CHANNELS`).
  const fallback = await Promise.all(
    bounds
      .filter((day) => !within(own, day))
      .map((day) =>
        marketPrices(
          ctx,
          DEFAULT_ENERGY_PRICE_PROVIDER,
          'electricity',
          day.from,
          day.to,
        ),
      ),
  )
  const market: PriceSlot[] = [...own, ...fallback.flat()]
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
 *
 * Known limit (APP-726), accepted rather than detected: the whole span is
 * measured, so typed readings inside an outage are never counted, even when
 * Home Assistant truly lost those hours (a recorder reset) and no catch-up
 * row holds them. Telling the two apart needs a signal the stored data does
 * not carry: a row holds only `hourStart`, `amount` and `estimated`, and a
 * catch-up row is not marked, so nothing says it is one.
 * - Row size against the typed stretch across the gap fails both ways. A
 *   catch-up row after a quiet outage is as small as one ordinary hour, and
 *   one after a busy outage is as large as a heavy hour; typed readings are
 *   sparse and rarely start or end on the gap's edges.
 * - A counter reset is not visible: Home Assistant imports a sum, and the
 *   rows hold the hour's difference, not the counter.
 * Any guess here risks counting an outage twice (the row and the typed
 * stretch) in the normal catch-up case, which is the worse error: a lost gap
 * under-counts what the typed readings could have shown, while a double
 * count invents usage in the common case. Revisit only if the import starts storing what makes a row a
 * catch-up (for example the number of hours it covers), which is a schema
 * change.
 */
export async function measuredSpan(
  ctx: QueryCtx,
  channelId: Id<'energyChannels'>,
  /**
   * The end of the range asked about. The span is then exact before it and
   * only reaches past it: the newest hour is never read, so each new one
   * leaves a past month be (APP-921).
   */
  until?: number,
) {
  const hours = () =>
    ctx.db
      .query('energyIntervals')
      .withIndex('by_channel_hour', (q) => q.eq('channelId', channelId))
  const first = await hours().order('asc').first()
  if (!first) return null
  if (until === undefined) {
    const last = await hours().order('desc').first()
    return { from: first.hourStart, to: (last ?? first).hourStart + HOUR_MS }
  }
  const [before, after] = await Promise.all([
    ctx.db
      .query('energyIntervals')
      .withIndex('by_channel_hour', (q) =>
        q.eq('channelId', channelId).lt('hourStart', until),
      )
      .order('desc')
      .first(),
    ctx.db
      .query('energyIntervals')
      .withIndex('by_channel_hour', (q) =>
        q.eq('channelId', channelId).gte('hourStart', until),
      )
      .first(),
  ])
  return {
    from: first.hourStart,
    to: (after ?? before ?? first).hourStart + HOUR_MS,
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

/** A site's contracts, oldest first. */
export async function siteContracts(
  ctx: QueryCtx,
  siteId: Id<'energySites'>,
) {
  return ctx.db
    .query('energyContracts')
    .withIndex('by_site_validFrom', (q) => q.eq('siteId', siteId))
    .collect()
}

/** A site's solar panels and batteries, oldest first. */
export async function siteAssets(ctx: QueryCtx, siteId: Id<'energySites'>) {
  return ctx.db
    .query('energyAssets')
    .withIndex('by_site', (q) => q.eq('siteId', siteId))
    .collect()
}

export interface EnergyRange {
  days: EnergyDay[]
  /** Per hour, only when asked for and only from hourly sources. */
  hours: EnergyHour[]
  contracts: Doc<'energyContracts'>[]
  /** Each day's measured hours with their price, only with `solar`. */
  solarDays: EnergySolarDay[]
  /**
   * Per day, only with `solar`: what sending back earned in cents (negative),
   * net metering included, priced from electricity alone. A day whose gas has
   * no price yet still has it; null when its electricity has none (APP-920).
   */
  exportCents: (number | null)[]
}

/**
 * Usage and costs for each of `days` (consecutive, in order). With
 * `hourly`, also each hour of the range from hourly sources; with `solar`,
 * each day's solar and battery figures from the same hours (APP-496). Net metering is
 * over the days given, so a day's share takes its whole month.
 */
export async function computeEnergyRange(
  ctx: QueryCtx,
  site: Doc<'energySites'>,
  channels: readonly ChannelWithSource[],
  days: readonly string[],
  options: { hourly?: boolean; solar?: boolean } = {},
): Promise<EnergyRange> {
  const first = days[0]
  const last = days[days.length - 1]
  if (!first || !last) {
    return { days: [], hours: [], contracts: [], solarDays: [], exportCents: [] }
  }
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
  // A retired channel gets no hours after it retired, so one that did before
  // the range has nothing in it and is not read at all (APP-724).
  const hourly = await Promise.all(
    channels
      .filter(
        ({ manual, channel }) =>
          !manual &&
          (channel.retiredAt === undefined || channel.retiredAt > start),
      )
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
        const span = await measuredSpan(ctx, channel._id, end)
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
    if (readings.length < 2) continue
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
    }
    // Each stretch between two readings loses the part hours count already.
    // A stretch where the count goes down (a replaced meter) counts nothing.
    for (const [index, reading] of readings.entries()) {
      const next = readings[index + 1]
      if (!next || next.value < reading.value) continue
      if (!channel.tariff) {
        typedTotals.push({
          kind: channel.kind,
          from: reading.at,
          to: next.at,
          whole,
        })
      }
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
      //
      // Known limit (APP-725), accepted rather than pro-rated: this decides
      // per whole hour, and Home Assistant keeps only each hour's sum.
      // - A typed reading in the middle of a T1 hour is off by up to that
      //   hour's T1: the hour is dropped when it starts inside a typed
      //   stretch, counted when it starts before one, so the part of it
      //   on the wrong side of the reading is counted twice or not at all.
      // - A catch-up row (the hours Home Assistant missed, added to the next
      //   hour it has) after the last typed reading counts once more than it
      //   should, by at most the T1 of the outage hours before that reading,
      //   which the typed stretches counted already. The row holds one sum
      //   for the whole outage, so no split can be read back from it.
      // Both errors are at most one outage's or one hour's T1, only where a
      // site has a typed total beside a lone T1 counter, and the next typed
      // reading after the outage settles the days it covers. A pro-rating
      // guess would need an assumed hourly shape and a second pass over the
      // readings, to fix a small error that stays bounded; so it is left.
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
      if (hourBucket && !typed) {
        addTo(hourBucket, channel, interval.amount, interval.estimated)
      }
    }
  }

  const contracts = await siteContracts(ctx, site._id)
  const needsPrices = days.some(
    (day) => energyContractOn(contracts, day)?.kind === 'dynamic',
  )
  const prices = needsPrices
    ? await loadPrices(ctx, site._id, days, start, end)
    : NO_PRICES

  const hourlyChannels = channels.some(
    (each) => !each.manual && each.channel.kind === 'gridImport',
  )

  // Electricity alone, without gas, for what the roof sent back (APP-920).
  const electricity: (EnergyCost | null)[] = []
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
    const contract = energyContractOn(contracts, day)
    // Fixed costs run on every day of a contract, also one without usage or
    // prices (APP-635); null when the contract has none.
    const fixed = contract ? energyDayFixedCost(day, contract) : null
    electricity.push(null)
    if (!bucket.hasData) {
      return {
        ...base,
        cost: fixed,
        costWithoutNet: fixed,
        costStatus: 'noData' as const,
      }
    }
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
      const pricedHours: NonNullable<EnergyDayUse['hours']>[number][] = []
      for (let at = dayStart; at < dayEnd; at += HOUR_MS) {
        const hour = hourBuckets.get(at)
        pricedHours.push({
          importKwh: hour ? sum(hour.importKwh) : 0,
          exportKwh: hour ? sum(hour.exportKwh) : 0,
          ...prices.electricity(at, at + HOUR_MS),
        })
      }
      hours = pricedHours
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
    const priced = energyDayCost(use, contract as EnergyContractTerms)
    if (options.solar) {
      electricity[electricity.length - 1] =
        priced ??
        energyDayCost({ ...use, gasM3: null }, contract as EnergyContractTerms)
    }
    const costWithoutNet = priced ?? fixed
    return {
      ...base,
      // Net metering is applied to the whole month below.
      cost: costWithoutNet,
      costWithoutNet,
      costStatus: priced ? ('ok' as const) : ('noPrices' as const),
    }
  })
  const netted = netEachMonth(
    result.map((day) => ({
      ...day,
      cost: day.costStatus === 'ok' ? day.costWithoutNet : null,
    })),
    contracts,
  )
  result.forEach((day, index) => {
    day.cost = netted[index] ?? day.cost
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

  const solarSince = options.solar
    ? await firstHourOf(
        ctx,
        channels.filter((each) => each.channel.kind === 'solar' && !each.manual),
      )
    : null
  const solarDays = options.solar
    ? days.map((day) =>
        energySolarDay(
          day,
          solarHours(
            day,
            hourBuckets,
            energyContractOn(contracts, day),
            prices,
            solarSince,
          ),
        ),
      )
    : []

  const exportCents = options.solar
    ? netEachMonth(
        result.map((day, index) => ({ ...day, cost: electricity[index] ?? null })),
        contracts,
      ).map((cost) => cost?.exportCents ?? null)
    : []

  return { days: result, hours, contracts, solarDays, exportCents }
}

/** The first hour any of `channels` has a figure for. */
export async function firstHourOf(
  ctx: QueryCtx,
  channels: readonly ChannelWithSource[],
): Promise<number | null> {
  const first = await Promise.all(
    channels.map(({ channel }) =>
      ctx.db
        .query('energyIntervals')
        .withIndex('by_channel_hour', (q) => q.eq('channelId', channel._id))
        .first(),
    ),
  )
  const starts = first.flatMap((each) => (each ? [each.hourStart] : []))
  return starts.length ? Math.min(...starts) : null
}

/**
 * A day's hours as `energySolarDay` reads them, each with its price. An
 * inverter that is off at night reports no figure then: on a day it reported
 * at all, such an hour made nothing. Hours before `solarSince`, when solar
 * was not measured yet, stay unknown.
 */
function solarHours(
  day: string,
  buckets: ReadonlyMap<number, Bucket>,
  contract: Doc<'energyContracts'> | undefined,
  prices: SitePrices,
  solarSince: number | null,
): EnergySolarHour[] {
  const hours = amsterdamDayHours(day).flatMap((at) => {
    const bucket = buckets.get(at)
    return bucket ? [{ at, bucket }] : []
  })
  const reported = hours.some(({ bucket }) => bucket.solar !== null)
  const off = (at: number) =>
    reported && solarSince !== null && at >= solarSince ? 0 : null
  // A split meter counts an hour on the tariff that applied; an hour it
  // counted nothing in has the tariff of the hour before it.
  const tariffs = hours.map(({ bucket }) => hourTariff(bucket))
  let tariff = tariffs.find((each) => each !== null) ?? 't2'
  return hours.map(({ at, bucket }, index) => {
    tariff = tariffs[index] ?? tariff
    return {
      importKwh: bucket.importMeasured ? sum(bucket.importKwh) : null,
      exportKwh: bucket.exportMeasured ? sum(bucket.exportKwh) : null,
      solarKwh: bucket.solar ?? off(at),
      chargeKwh: bucket.charge,
      dischargeKwh: bucket.discharge,
      importPrice: energyHourImportPrice(
        contract as EnergyContractTerms | undefined,
        prices.electricity(at, at + HOUR_MS),
        tariff,
      ),
    }
  })
}

function hourTariff({ importKwh, exportKwh }: Bucket): 't1' | 't2' | null {
  const t1 = importKwh.t1 + exportKwh.t1
  const t2 = importKwh.t2 + exportKwh.t2
  return t1 === t2 ? null : t1 > t2 ? 't1' : 't2'
}

/**
 * Net metering per month and contract over the days given (a month so far):
 * each day with a cost under a contract with net metering gets its share of
 * that contract's netting in the month (`energyNetMetering`). Returns each
 * day's cost with net metering, in order; a day without a cost stays null.
 */
function netEachMonth(
  days: readonly {
    day: string
    importKwh: number
    exportKwh: number
    cost: EnergyCost | null
  }[],
  contracts: readonly Doc<'energyContracts'>[],
): (EnergyCost | null)[] {
  const result = days.map((day) => day.cost)
  const months = new Map<string, number[]>()
  days.forEach((day, index) => {
    const contract = energyContractOn(contracts, day.day)
    if (!day.cost || !contract || !netMeteringOn(contract, day.day)) return
    // Each contract settles its own days: a supplier switch mid-month nets
    // the two parts apart.
    const key = `${contract._id}:${day.day.slice(0, 7)}`
    months.set(key, [...(months.get(key) ?? []), index])
  })
  for (const indexes of months.values()) {
    const costs = energyNetMetering(
      indexes.map((index) => {
        const day = days[index] as (typeof days)[number]
        return {
          importKwh: day.importKwh,
          exportKwh: day.exportKwh,
          cost: day.cost as EnergyCost,
        }
      }),
    )
    indexes.forEach((index, at) => {
      result[index] = costs[at] ?? result[index] ?? null
    })
  }
  return result
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
