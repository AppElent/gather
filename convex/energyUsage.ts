/**
 * Energy usage and costs per day and per month (APP-494).
 *
 * Totals are computed here from readings and hourly intervals, never stored
 * (`designs/energy/APP-491-data-model.md`): a month reads its own rows, and
 * the year view asks for its months one by one, so no query reads a year of
 * hours. Days that come from typed readings are estimated; such a site has days
 * and months, never hours.
 *
 * Group-scoped like every Energy function (ADR-0031). `today` is the caller's
 * Amsterdam day, so a cached answer never goes stale at midnight.
 */
import { isIsoDate } from '@gather/core/civil-date'
import {
  energyContractOn,
  energyMonthDays,
  isEnergyMonth,
  netMeteringPossibleIn,
} from '@gather/core/energy'
import { energyRefusal } from '@gather/core/refusals'
import { ConvexError, v } from 'convex/values'
import { query } from './_generated/server'
import { energyContractKindValidator } from './lib/energy'
import {
  channelsPresent,
  computeEnergyRange,
  energyChannelsPresentValidator,
  energyCostStatusValidator,
  energyCostValidator,
  energyDayValidator,
  energyHourValidator,
  hasHourlySource,
  primarySiteOf,
  siteChannels,
  sumCosts,
} from './lib/energyUsage'
import { requireGroupBySlug } from './lib/groupAccess'

const contractSummaryValidator = v.object({
  kind: energyContractKindValidator,
  supplierName: v.optional(v.string()),
  validFrom: v.string(),
  netMetering: v.boolean(),
})

const totalsValidator = v.object({
  importKwh: v.number(),
  exportKwh: v.number(),
  solarKwh: v.union(v.number(), v.null()),
  gasM3: v.union(v.number(), v.null()),
  consumptionKwh: v.number(),
  estimated: v.boolean(),
  daysWithData: v.number(),
  firstDay: v.union(v.string(), v.null()),
  lastDay: v.union(v.string(), v.null()),
  cost: v.union(energyCostValidator, v.null()),
  costWithoutNet: v.union(energyCostValidator, v.null()),
  /** Days with usage but no cost yet: no contract, or prices not in. */
  costMissingDays: v.number(),
  /** Why the costs are missing, when every day with usage lacks them. */
  costStatus: energyCostStatusValidator,
})

const periodValidator = v.union(
  v.null(),
  v.object({
    siteName: v.string(),
    hasHourly: v.boolean(),
    channels: energyChannelsPresentValidator,
    contract: v.union(contractSummaryValidator, v.null()),
    /** Whether the screen offers "with / without net metering". */
    netMeteringChoice: v.boolean(),
    days: v.array(energyDayValidator),
    hours: v.array(energyHourValidator),
    totals: totalsValidator,
  }),
)

function totalsOf(days: (typeof energyDayValidator.type)[]) {
  const withData = days.filter((day) => day.hasData)
  const nullableSum = (pick: (day: (typeof withData)[number]) => number | null) => {
    const values = withData.map(pick).filter((value) => value !== null)
    return values.length ? values.reduce((a, b) => a + b, 0) : null
  }
  const missing = withData.filter((day) => day.costStatus !== 'ok')
  const statuses = new Set(missing.map((day) => day.costStatus))
  return {
    importKwh: withData.reduce((total, day) => total + day.importKwh, 0),
    exportKwh: withData.reduce((total, day) => total + day.exportKwh, 0),
    solarKwh: nullableSum((day) => day.solarKwh),
    gasM3: nullableSum((day) => day.gasM3),
    consumptionKwh: withData.reduce(
      (total, day) => total + day.consumptionKwh,
      0,
    ),
    estimated: withData.some((day) => day.estimated),
    daysWithData: withData.length,
    firstDay: withData[0]?.day ?? null,
    lastDay: withData[withData.length - 1]?.day ?? null,
    cost: sumCosts(withData.map((day) => day.cost)),
    costWithoutNet: sumCosts(withData.map((day) => day.costWithoutNet)),
    costMissingDays: missing.length,
    costStatus:
      withData.length === 0
        ? ('noData' as const)
        : missing.length < withData.length
          ? ('ok' as const)
          : statuses.has('noContract')
            ? ('noContract' as const)
            : ('noPrices' as const),
  }
}

/**
 * A month, day by day: usage, export, solar, gas and what each day cost with
 * and without net metering. Days after `today` are left without data.
 */
export const month = query({
  args: { groupSlug: v.string(), month: v.string(), today: v.string() },
  returns: periodValidator,
  handler: async (ctx, args) => {
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    if (!isEnergyMonth(args.month) || !isIsoDate(args.today)) {
      throw new ConvexError(energyRefusal('notFound'))
    }
    const site = await primarySiteOf(ctx, group._id)
    if (!site) return null
    const channels = await siteChannels(ctx, site._id)
    const days = energyMonthDays(args.month).filter((day) => day <= args.today)
    const range = await computeEnergyRange(ctx, site, channels, days)
    // Days still to come are part of the month, with nothing in them yet.
    const future = energyMonthDays(args.month)
      .filter((day) => day > args.today)
      .map((day) => ({
        day,
        hasData: false,
        estimated: false,
        importKwh: 0,
        exportKwh: 0,
        solarKwh: null,
        gasM3: null,
        batteryChargeKwh: null,
        batteryDischargeKwh: null,
        consumptionKwh: 0,
        cost: null,
        costWithoutNet: null,
        costStatus: 'noData' as const,
      }))
    const lastDay = days[days.length - 1] ?? `${args.month}-01`
    const contract = energyContractOn(range.contracts, lastDay) ?? null
    return {
      siteName: site.name,
      hasHourly: hasHourlySource(channels),
      channels: channelsPresent(channels),
      contract: contract && {
        kind: contract.kind,
        supplierName: contract.supplierName,
        validFrom: contract.validFrom,
        netMetering: contract.netMetering,
      },
      netMeteringChoice:
        netMeteringPossibleIn(args.month) &&
        range.contracts.some(
          (each) => each.netMetering && each.validFrom <= lastDay,
        ),
      days: [...range.days, ...future],
      hours: [],
      totals: totalsOf(range.days),
    }
  },
})

/**
 * One day, hour by hour from hourly sources (with the state of charge when
 * the site has a battery), plus the day's own totals. A site with only typed
 * readings gets the day's estimate and no hours.
 */
export const day = query({
  args: { groupSlug: v.string(), day: v.string() },
  returns: periodValidator,
  handler: async (ctx, args) => {
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    if (!isIsoDate(args.day)) throw new ConvexError(energyRefusal('notFound'))
    const site = await primarySiteOf(ctx, group._id)
    if (!site) return null
    const channels = await siteChannels(ctx, site._id)
    const hourly = hasHourlySource(channels)
    const range = await computeEnergyRange(ctx, site, channels, [args.day], {
      hourly,
    })
    const contract = energyContractOn(range.contracts, args.day) ?? null
    return {
      siteName: site.name,
      hasHourly: hourly,
      channels: channelsPresent(channels),
      contract: contract && {
        kind: contract.kind,
        supplierName: contract.supplierName,
        validFrom: contract.validFrom,
        netMetering: contract.netMetering,
      },
      netMeteringChoice: Boolean(
        contract?.netMetering && netMeteringPossibleIn(args.day.slice(0, 7)),
      ),
      days: range.days,
      hours: hourly ? range.hours : [],
      totals: totalsOf(range.days),
    }
  },
})
