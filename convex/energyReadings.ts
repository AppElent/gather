/**
 * Typed meter readings (APP-494): the meters a Group reads itself, and the
 * cumulative counts it types for them.
 *
 * A meter counts up. A reading lower than the one before it on the same
 * channel is refused: a new meter is a new channel, not a correction. One
 * reading per channel per day; typing that day again replaces it. Usage is
 * computed from these rows when it is shown (`energyUsage.ts`), so nothing
 * else is written here.
 *
 * Group-scoped like every Energy function (ADR-0031); a channel outside the
 * Group answers like one that does not exist (ADR-0009).
 */
import { addDays, isIsoDate } from '@gather/core/civil-date'
import {
  amsterdamDayStart,
  checkEnergyReading,
  energyChannelsOverlap,
  energyReadingMoment,
} from '@gather/core/energy'
import { energyRefusal } from '@gather/core/refusals'
import { ConvexError, v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import { mutation, type QueryCtx, query } from './_generated/server'
import {
  energyChannelKindValidator,
  energyTariffValidator,
  energyUnitValidator,
} from './lib/energy'
import { connectedChannels, reconcileManualChannels } from './lib/energyManual'
import { primarySiteOf } from './lib/energyUsage'
import { requireGroupBySlug } from './lib/groupAccess'

/** Longest label a source is saved with ("Meterstanden"). */
const SOURCE_LABEL_LIMIT = 60

const METER_KINDS = ['gridImport', 'gridExport', 'gas'] as const

const readingValidator = v.object({ value: v.number(), at: v.number() })

/** The manual source of a site, and its channels still in use. */
async function manualChannels(ctx: QueryCtx, siteId: Id<'energySites'>) {
  const source = await ctx.db
    .query('energySources')
    .withIndex('by_site', (q) => q.eq('siteId', siteId))
    .filter((q) => q.eq(q.field('kind'), 'manual'))
    .first()
  if (!source) return { source: null, channels: [] }
  const channels = await ctx.db
    .query('energyChannels')
    .withIndex('by_source', (q) => q.eq('sourceId', source._id))
    .collect()
  return {
    source,
    channels: channels.filter((channel) => channel.retiredAt === undefined),
  }
}

/** The readings around a day: before it, on it, and after it. */
async function readingsAround(
  ctx: QueryCtx,
  channelId: Id<'energyChannels'>,
  day: string,
) {
  const start = amsterdamDayStart(day)
  const end = amsterdamDayStart(addDays(day, 1))
  const [previous, onDay, next] = await Promise.all([
    ctx.db
      .query('energyReadings')
      .withIndex('by_channel_at', (q) =>
        q.eq('channelId', channelId).lt('at', start),
      )
      .order('desc')
      .first(),
    ctx.db
      .query('energyReadings')
      .withIndex('by_channel_at', (q) =>
        q.eq('channelId', channelId).gte('at', start).lt('at', end),
      )
      .order('desc')
      .first(),
    ctx.db
      .query('energyReadings')
      .withIndex('by_channel_at', (q) =>
        q.eq('channelId', channelId).gte('at', end),
      )
      .first(),
  ])
  return { previous, onDay, next }
}

/** Kinds a typed meter can read and a connected source already measures whole. */
async function measuredKinds(ctx: QueryCtx, siteId: Id<'energySites'>) {
  const measured = await connectedChannels(ctx, siteId)
  return METER_KINDS.filter((kind) =>
    (['t1', 't2'] as const).every((tariff) =>
      measured.some((each) => energyChannelsOverlap(each, { kind, tariff })),
    ),
  )
}

const point = (reading: Doc<'energyReadings'> | null) =>
  reading ? { value: reading.value, at: reading.at } : null

/**
 * What the readings screen shows for `day`: each meter the Group reads, with
 * the reading before that day (to type against), the one already typed for
 * it and the next one, if any. `null` while the Group has no address.
 */
export const form = query({
  args: { groupSlug: v.string(), day: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      hasManualSource: v.boolean(),
      lastReadingAt: v.union(v.number(), v.null()),
      /** Kinds that need no typed meter. Installed phones do not read it. */
      measured: v.array(energyChannelKindValidator),
      channels: v.array(
        v.object({
          _id: v.id('energyChannels'),
          kind: energyChannelKindValidator,
          tariff: v.optional(energyTariffValidator),
          unit: energyUnitValidator,
          previous: v.union(readingValidator, v.null()),
          onDay: v.union(readingValidator, v.null()),
          next: v.union(readingValidator, v.null()),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    if (!isIsoDate(args.day)) throw new ConvexError(energyRefusal('notFound'))
    const site = await primarySiteOf(ctx, group._id)
    if (!site) return null
    const { source, channels } = await manualChannels(ctx, site._id)
    let lastReadingAt: number | null = null
    const rows = await Promise.all(
      channels.map(async (channel) => {
        const around = await readingsAround(ctx, channel._id, args.day)
        const latest = await ctx.db
          .query('energyReadings')
          .withIndex('by_channel_at', (q) => q.eq('channelId', channel._id))
          .order('desc')
          .first()
        if (latest && (lastReadingAt === null || latest.at > lastReadingAt)) {
          lastReadingAt = latest.at
        }
        return {
          _id: channel._id,
          kind: channel.kind,
          tariff: channel.tariff,
          unit: channel.unit,
          previous: point(around.previous),
          onDay: point(around.onDay),
          next: point(around.next),
        }
      }),
    )
    return {
      hasManualSource: source !== null,
      lastReadingAt,
      measured: await measuredKinds(ctx, site._id),
      channels: rows.sort(
        (a, b) =>
          CHANNEL_ORDER.indexOf(a.kind) - CHANNEL_ORDER.indexOf(b.kind) ||
          (a.tariff ?? '').localeCompare(b.tariff ?? ''),
      ),
    }
  },
})

const CHANNEL_ORDER: Doc<'energyChannels'>['kind'][] = [
  'gridImport',
  'gridExport',
  'solar',
  'gas',
  'batteryCharge',
  'batteryDischarge',
  'batterySoc',
]

/**
 * Save the readings typed for one day. All or nothing: one refused reading
 * refuses them all, so a half-saved form never spreads half the usage.
 */
export const save = mutation({
  args: {
    groupSlug: v.string(),
    day: v.string(),
    readings: v.array(
      v.object({ channelId: v.id('energyChannels'), value: v.number() }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user, group } = await requireGroupBySlug(ctx, args.groupSlug)
    const at = energyReadingMoment(args.day, Date.now())
    if (at === null) throw new ConvexError(energyRefusal('readingInFuture'))
    const site = await primarySiteOf(ctx, group._id)
    if (!site) throw new ConvexError(energyRefusal('notFound'))
    const { channels } = await manualChannels(ctx, site._id)
    const typed = new Map(channels.map((channel) => [channel._id, channel]))

    const writes: (() => Promise<unknown>)[] = []
    const seen = new Set<string>()
    for (const reading of args.readings) {
      if (!typed.has(reading.channelId) || seen.has(reading.channelId)) {
        throw new ConvexError(energyRefusal('notFound'))
      }
      seen.add(reading.channelId)
      const around = await readingsAround(ctx, reading.channelId, args.day)
      const problem = checkEnergyReading(reading.value, {
        previous: around.previous?.value,
        next: around.next?.value,
      })
      if (problem === 'lowerThanPrevious') {
        throw new ConvexError(energyRefusal('readingLower'))
      }
      if (problem === 'higherThanNext') {
        throw new ConvexError(energyRefusal('readingHigher'))
      }
      if (problem) throw new ConvexError(energyRefusal('readingInvalid'))
      const existing = around.onDay
      writes.push(() =>
        existing
          ? ctx.db.patch(existing._id, {
              value: reading.value,
              at,
              enteredByUserId: user._id,
            })
          : ctx.db.insert('energyReadings', {
              groupId: group._id,
              channelId: reading.channelId,
              at,
              value: reading.value,
              enteredByUserId: user._id,
            }),
      )
    }
    for (const write of writes) await write()
    return null
  },
})

/**
 * Name the meters a Group reads itself: electricity from the grid (with or
 * without an off-peak and a normal counter), what goes back to it, and gas.
 * The address gets a meter-readings source when it has none yet. Once a site
 * has typed meters, a swap or a new meter is a new channel under Sources
 * (APP-495), so asking again is refused.
 */
export const setupChannels = mutation({
  args: {
    groupSlug: v.string(),
    split: v.boolean(),
    export: v.boolean(),
    gas: v.boolean(),
    sourceLabel: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user, group } = await requireGroupBySlug(ctx, args.groupSlug)
    const site = await primarySiteOf(ctx, group._id)
    if (!site) throw new ConvexError(energyRefusal('notFound'))
    const existing = await manualChannels(ctx, site._id)
    if (existing.channels.length > 0) {
      throw new ConvexError(energyRefusal('channelsExist'))
    }
    let sourceId = existing.source?._id
    if (!sourceId) {
      const label = args.sourceLabel.trim().slice(0, SOURCE_LABEL_LIMIT)
      if (!label) throw new ConvexError(energyRefusal('needsName'))
      sourceId = await ctx.db.insert('energySources', {
        groupId: group._id,
        siteId: site._id,
        kind: 'manual',
        label,
        status: 'ok',
        connectedByUserId: user._id,
      })
    }
    const meters: Pick<Doc<'energyChannels'>, 'kind' | 'tariff' | 'unit'>[] =
      []
    const electricity = (kind: 'gridImport' | 'gridExport') => {
      if (args.split) {
        meters.push({ kind, tariff: 't1', unit: 'kWh' })
        meters.push({ kind, tariff: 't2', unit: 'kWh' })
      } else {
        meters.push({ kind, unit: 'kWh' })
      }
    }
    electricity('gridImport')
    if (args.export) electricity('gridExport')
    if (args.gas) meters.push({ kind: 'gas', unit: 'm3' })
    // A meter retired because a source measures it keeps its readings.
    const retired = await ctx.db
      .query('energyChannels')
      .withIndex('by_source', (q) => q.eq('sourceId', sourceId))
      .collect()
    for (const meter of meters) {
      if (retired.some((each) => energyChannelsOverlap(each, meter))) continue
      await ctx.db.insert('energyChannels', {
        groupId: group._id,
        siteId: site._id,
        sourceId,
        ...meter,
      })
    }
    // Never active next to a connected channel of the same meter (APP-495).
    await reconcileManualChannels(ctx, site._id)
    return null
  },
})
