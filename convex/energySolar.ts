/**
 * Solar and battery (APP-496): what the roof made, what the home used of it,
 * and what the battery earned, per day of a month.
 *
 * Computed from hours, never from typed readings: a site without them gets
 * `noHourly` and no figures. Payback adds up the months the client asks for
 * one by one (`paybackMonth`), so no query reads a year of hours
 * (`convex/energyUsage.ts`).
 *
 * Group-scoped like every Energy function (ADR-0031). `today` is the caller's
 * Amsterdam day.
 */
import { isIsoDate } from '@gather/core/civil-date'
import {
  amsterdamDayOf,
  type EnergyPaybackDay,
  energyMonthDays,
  energyPaybackDayOf,
  isEnergyMonth,
} from '@gather/core/energy'
import { energyRefusal } from '@gather/core/refusals'
import { ConvexError, v } from 'convex/values'
import type { Doc } from './_generated/dataModel'
import { type QueryCtx, query } from './_generated/server'
import { energyAssetTermsValidator } from './lib/energy'
import {
  computeEnergyRange,
  firstHourOf,
  primarySiteOf,
  siteAssets,
  siteChannels,
} from './lib/energyUsage'
import { requireGroupBySlug } from './lib/groupAccess'

const nullableNumber = v.union(v.number(), v.null())

const batteryDayValidator = v.object({
  chargeKwh: v.number(),
  dischargeKwh: v.number(),
  chargeEur: nullableNumber,
  dischargeEur: nullableNumber,
})

const solarDayValidator = v.object({
  day: v.string(),
  producedKwh: nullableNumber,
  selfUsedKwh: nullableNumber,
  returnedKwh: nullableNumber,
  selfUsedEur: nullableNumber,
  consumptionKwh: nullableNumber,
  ownKwh: nullableNumber,
  battery: v.union(batteryDayValidator, v.null()),
  /** What the roof and the battery earned; null without a price or a figure. */
  solarEur: nullableNumber,
  batteryEur: nullableNumber,
})

const paybackDayValidator = v.object({
  day: v.string(),
  solarEur: nullableNumber,
  batteryEur: nullableNumber,
  /** Whether solar, or the battery, had figures that day. */
  solarMeasured: v.boolean(),
  batteryMeasured: v.boolean(),
})

const overviewValidator = v.union(
  v.null(),
  v.object({
    siteName: v.string(),
    /**
     * `noHourly`: typed readings only. `noAssets`: hours, but nothing measures
     * solar, a battery or its charge level.
     */
    status: v.union(
      v.literal('ok'),
      v.literal('noHourly'),
      v.literal('noAssets'),
    ),
    solar: v.boolean(),
    battery: v.boolean(),
    batterySoc: v.boolean(),
    /** The first day solar or the battery was measured. */
    firstDay: v.union(v.string(), v.null()),
    assets: v.array(
      v.object({ _id: v.id('energyAssets'), asset: energyAssetTermsValidator }),
    ),
    days: v.array(solarDayValidator),
  }),
)

/** A month's solar and battery, day by day up to `today`, and its assets. */
export const month = query({
  args: { groupSlug: v.string(), month: v.string(), today: v.string() },
  returns: overviewValidator,
  handler: async (ctx, args) => {
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    if (!isEnergyMonth(args.month) || !isIsoDate(args.today)) {
      throw new ConvexError(energyRefusal('notFound'))
    }
    const site = await primarySiteOf(ctx, group._id)
    if (!site) return null
    const channels = await siteChannels(ctx, site._id)
    const measured = channels.filter((each) => !each.manual)
    const has = (...kinds: Doc<'energyChannels'>['kind'][]) =>
      measured.some((each) => kinds.includes(each.channel.kind))
    const solar = has('solar')
    const battery = has('batteryCharge', 'batteryDischarge')
    const batterySoc = has('batterySoc')
    // A charge level alone still has a battery to show (APP-922).
    const status =
      measured.length === 0
        ? ('noHourly' as const)
        : solar || battery || batterySoc
          ? ('ok' as const)
          : ('noAssets' as const)
    const assets = (await siteAssets(ctx, site._id)).map(
      ({ _id, kind, name, peakWatt, capacityKwh, installedOn, purchaseCents }) => ({
        _id,
        asset: { kind, name, peakWatt, capacityKwh, installedOn, purchaseCents },
      }),
    )
    const base = {
      siteName: site.name,
      status,
      solar,
      battery,
      batterySoc,
      assets,
    }
    if (status !== 'ok') return { ...base, firstDay: null, days: [] }

    const first = await firstHourOf(
      ctx,
      measured.filter(({ channel }) =>
        ['solar', 'batteryCharge', 'batteryDischarge'].includes(channel.kind),
      ),
    )
    return {
      ...base,
      firstDay: first === null ? null : amsterdamDayOf(first),
      days: await solarDays(ctx, site, channels, args.month, args.today),
    }
  },
})

/**
 * What one past month adds to payback, day by day up to `today` (APP-962).
 *
 * `month` without the site's assets or its first measured hour, so editing an
 * asset leaves every open past month be. `null` without a site.
 */
export const paybackMonth = query({
  args: { groupSlug: v.string(), month: v.string(), today: v.string() },
  returns: v.union(v.null(), v.array(paybackDayValidator)),
  handler: async (ctx, args) => {
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    if (!isEnergyMonth(args.month) || !isIsoDate(args.today)) {
      throw new ConvexError(energyRefusal('notFound'))
    }
    const site = await primarySiteOf(ctx, group._id)
    if (!site) return null
    return await paybackDaysOf(ctx, site, args.month, args.today)
  },
})

/** `paybackMonth`'s days, from the site's channels and hours alone. */
export async function paybackDaysOf(
  ctx: QueryCtx,
  site: Doc<'energySites'>,
  month: string,
  today: string,
): Promise<EnergyPaybackDay[]> {
  const channels = await siteChannels(ctx, site._id)
  const days = await solarDays(ctx, site, channels, month, today)
  return days.map(energyPaybackDayOf)
}

/** A month's solar days up to `today`, each with what it earned. */
async function solarDays(
  ctx: QueryCtx,
  site: Doc<'energySites'>,
  channels: Awaited<ReturnType<typeof siteChannels>>,
  month: string,
  today: string,
) {
  const range = await computeEnergyRange(
    ctx,
    site,
    channels,
    energyMonthDays(month).filter((day) => day <= today),
    { solar: true },
  )
  return range.solarDays.map((day, index) => {
    const { battery: each } = day
    return {
      ...day,
      solarEur: solarEur(
        day,
        range.days[index]?.exportKwh ?? 0,
        range.exportCents[index] ?? null,
      ),
      batteryEur:
        each && each.chargeEur !== null && each.dischargeEur !== null
          ? each.dischargeEur - each.chargeEur
          : null,
    }
  })
}

/**
 * What the roof earned on a day: the grid power it saved, and its share of
 * what sending back earned, net metering included. Export is priced from
 * electricity alone, so a gas price still to come leaves it be (APP-920).
 */
function solarEur(
  solar: { selfUsedEur: number | null; returnedKwh: number | null },
  exportKwh: number,
  exportCents: number | null,
): number | null {
  if (solar.selfUsedEur === null || solar.returnedKwh === null) return null
  if (solar.returnedKwh === 0) return solar.selfUsedEur
  if (exportCents === null || exportKwh <= 0) return null
  const share = Math.min(1, solar.returnedKwh / exportKwh)
  return solar.selfUsedEur - (exportCents / 100) * share
}
