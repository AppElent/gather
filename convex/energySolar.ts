/**
 * Solar and battery (APP-496): what the roof made, what the home used of it,
 * and what the battery earned, per day of a month.
 *
 * Computed from hours, never from typed readings: a site without them gets
 * `noHourly` and no figures. Payback adds up the months the client asks for
 * one by one, so no query reads a year of hours (`convex/energyUsage.ts`).
 *
 * Group-scoped like every Energy function (ADR-0031). `today` is the caller's
 * Amsterdam day.
 */
import { isIsoDate } from '@gather/core/civil-date'
import {
  amsterdamDayOf,
  energyMonthDays,
  isEnergyMonth,
} from '@gather/core/energy'
import { energyRefusal } from '@gather/core/refusals'
import { ConvexError, v } from 'convex/values'
import type { Doc } from './_generated/dataModel'
import { query } from './_generated/server'
import { energyAssetTermsValidator } from './lib/energy'
import {
  computeEnergyRange,
  type EnergyDay,
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

const overviewValidator = v.union(
  v.null(),
  v.object({
    siteName: v.string(),
    /**
     * `noHourly`: typed readings only. `noAssets`: hours, but nothing measures
     * solar or a battery.
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
    const status =
      measured.length === 0
        ? ('noHourly' as const)
        : solar || battery
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
      batterySoc: has('batterySoc'),
      assets,
    }
    if (status !== 'ok') return { ...base, firstDay: null, days: [] }

    const first = await Promise.all(
      measured
        .filter(({ channel }) =>
          ['solar', 'batteryCharge', 'batteryDischarge'].includes(channel.kind),
        )
        .map(({ channel }) =>
          ctx.db
            .query('energyIntervals')
            .withIndex('by_channel_hour', (q) => q.eq('channelId', channel._id))
            .first(),
        ),
    )
    const starts = first.flatMap((each) => (each ? [each.hourStart] : []))
    const range = await computeEnergyRange(
      ctx,
      site,
      channels,
      energyMonthDays(args.month).filter((day) => day <= args.today),
      { solar: true },
    )
    return {
      ...base,
      firstDay: starts.length ? amsterdamDayOf(Math.min(...starts)) : null,
      days: range.solarDays.map((day, index) => {
        const { battery: each } = day
        return {
          ...day,
          solarEur: solarEur(day, range.days[index]),
          batteryEur:
            each && each.chargeEur !== null && each.dischargeEur !== null
              ? each.dischargeEur - each.chargeEur
              : null,
        }
      }),
    }
  },
})

/**
 * What the roof earned on a day: the grid power it saved, and its share of
 * what sending back earned, net metering included.
 */
function solarEur(
  solar: { selfUsedEur: number | null; returnedKwh: number | null },
  day: EnergyDay | undefined,
): number | null {
  if (solar.selfUsedEur === null || solar.returnedKwh === null || !day) return null
  if (solar.returnedKwh === 0) return solar.selfUsedEur
  if (day.costStatus !== 'ok' || !day.cost || day.exportKwh <= 0) return null
  const share = Math.min(1, solar.returnedKwh / day.exportKwh)
  return solar.selfUsedEur - (day.cost.exportCents / 100) * share
}
