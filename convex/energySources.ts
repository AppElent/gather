/**
 * Energy's sources (APP-495): what feeds an address, and the Home Assistant
 * connection. The actions that talk to Home Assistant are in
 * `energyHomeAssistant.ts`, which runs in Node; everything they read or write
 * goes through the internal functions here.
 *
 * Any Member sees the sources and their state. Only an admin connects, edits
 * or disconnects one. The token (`energySources.secret`) is returned by
 * internal functions only, to the action that puts it on the socket.
 */
import {
  ENERGY_CHANNEL_ORDER,
  energyChannelsOverlap,
  energyChannelUnit,
  energySourceProblemValue,
} from '@gather/core/energy'
import { energyRefusal } from '@gather/core/refusals'
import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  mutation,
  type QueryCtx,
  query,
} from './_generated/server'
import { rejectConnectedApps } from './lib/connectedApps'
import {
  energyChannelKindValidator,
  energySourceKindValidator,
  energySourceStatusValidator,
  energyTariffValidator,
} from './lib/energy'
import {
  IMPORT_MS,
  MAX_CHANNELS,
  mostChannelsInAMonth,
} from './lib/energyChannelLimit'
import { reconcileManualChannels } from './lib/energyManual'
import { primarySiteOf } from './lib/energyUsage'
import { requireGroupBySlug } from './lib/groupAccess'

const HOUR_MS = 3_600_000
/** A brand, so the same in every language. */
const HOME_ASSISTANT_LABEL = 'Home Assistant'
/** Sources started per cron step, and the pause between two of them. */
const SOURCES_PER_STEP = 100
const SYNC_STAGGER_MS = 500
/**
 * A history import that did not finish is tried again every hour for six
 * hours and then every six, for two weeks.
 */
const HISTORY_RETRIES = 60
const HISTORY_RETRY_MAX_MS = 6 * HOUR_MS
const retryDelay = (attempt: number) =>
  attempt < 6 ? HOUR_MS : HISTORY_RETRY_MAX_MS

const byChannel = (
  a: Pick<Doc<'energyChannels'>, 'kind' | 'tariff'>,
  b: Pick<Doc<'energyChannels'>, 'kind' | 'tariff'>,
) =>
  ENERGY_CHANNEL_ORDER.indexOf(a.kind) - ENERGY_CHANNEL_ORDER.indexOf(b.kind) ||
  (a.tariff ?? '').localeCompare(b.tariff ?? '')

async function siteRows(ctx: QueryCtx, siteId: Id<'energySites'>) {
  const [sources, channels] = await Promise.all([
    ctx.db
      .query('energySources')
      .withIndex('by_site', (q) => q.eq('siteId', siteId))
      .collect(),
    ctx.db
      .query('energyChannels')
      .withIndex('by_site', (q) => q.eq('siteId', siteId))
      .collect(),
  ])
  return {
    sources,
    channels: channels.filter((each) => each.retiredAt === undefined),
  }
}

/** The address's sources and channels, or null while there is no address. */
export const list = query({
  args: { groupSlug: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      siteName: v.string(),
      /** Whether the caller may connect, edit and disconnect. */
      canManage: v.boolean(),
      /** The connected address, for an admin to edit; never the token. */
      homeAssistantAddress: v.union(v.string(), v.null()),
      sources: v.array(
        v.object({
          _id: v.id('energySources'),
          kind: energySourceKindValidator,
          label: v.string(),
          status: energySourceStatusValidator,
          connected: v.boolean(),
          lastSyncedAt: v.optional(v.number()),
          lastError: v.optional(v.string()),
          channelCount: v.number(),
          /** Typed meters only: when each was last read. */
          readings: v.array(
            v.object({
              kind: energyChannelKindValidator,
              tariff: v.optional(energyTariffValidator),
              lastReadingAt: v.union(v.number(), v.null()),
            }),
          ),
        }),
      ),
      channels: v.array(
        v.object({
          _id: v.id('energyChannels'),
          sourceId: v.id('energySources'),
          kind: energyChannelKindValidator,
          tariff: v.optional(energyTariffValidator),
          statisticId: v.optional(v.string()),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const { group, role } = await requireGroupBySlug(ctx, args.groupSlug)
    const site = await primarySiteOf(ctx, group._id)
    if (!site) return null
    const { sources, channels } = await siteRows(ctx, site._id)
    const canManage = role === 'admin'
    return {
      siteName: site.name,
      canManage,
      homeAssistantAddress: canManage
        ? (sources.find((each) => each.kind === 'homeAssistant')?.baseUrl ??
          null)
        : null,
      sources: await Promise.all(
        sources.map(async (source) => {
          const own = channels
            .filter((each) => each.sourceId === source._id)
            .sort(byChannel)
          const readings =
            source.kind === 'manual'
              ? await Promise.all(
                  own.map(async ({ _id, kind, tariff }) => {
                    const last = await ctx.db
                      .query('energyReadings')
                      .withIndex('by_channel_at', (q) => q.eq('channelId', _id))
                      .order('desc')
                      .first()
                    return { kind, tariff, lastReadingAt: last?.at ?? null }
                  }),
                )
              : []
          return {
            _id: source._id,
            kind: source.kind,
            label: source.label,
            status: source.status,
            connected: source.kind === 'manual' || Boolean(source.secret),
            lastSyncedAt: source.lastSyncedAt,
            lastError: source.lastError,
            channelCount: own.length,
            readings,
          }
        }),
      ),
      channels: channels.sort(byChannel).map((each) => ({
        _id: each._id,
        sourceId: each.sourceId,
        kind: each.kind,
        tariff: each.tariff,
        statisticId: each.externalRef,
      })),
    }
  },
})

/**
 * Forget the token and stop reading. The channels and everything already
 * read stay; typed meters Home Assistant had replaced are asked for again.
 */
export const disconnect = mutation({
  args: { groupSlug: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Stays in the app (ADR-0046).
    await rejectConnectedApps(ctx)
    const { group, role } = await requireGroupBySlug(ctx, args.groupSlug)
    if (role !== 'admin') throw new ConvexError(energyRefusal('adminOnly'))
    const site = await primarySiteOf(ctx, group._id)
    if (!site) throw new ConvexError(energyRefusal('notFound'))
    const source = await homeAssistantSource(ctx, site._id)
    if (!source) throw new ConvexError(energyRefusal('notFound'))
    await cancelImports(ctx, source._id)
    await ctx.db.patch(source._id, {
      secret: undefined,
      status: 'needsReconnect',
      lastError: energySourceProblemValue('disconnected'),
    })
    await reconcileManualChannels(ctx, site._id)
    return null
  },
})

async function homeAssistantSource(ctx: QueryCtx, siteId: Id<'energySites'>) {
  const sources = await ctx.db
    .query('energySources')
    .withIndex('by_site', (q) => q.eq('siteId', siteId))
    .collect()
  return sources.find((each) => each.kind === 'homeAssistant') ?? null
}

/**
 * A history import is known by the job that would end it (`endImport`): every
 * run carries its id, and does nothing once that job is no longer pending. So
 * an import is dropped or done at once for a run that is just starting too.
 * It ends after `IMPORT_MS`, which the channel limit counts on.
 */
export const endImport = internalMutation({
  args: {},
  returns: v.null(),
  handler: async () => null,
})

/**
 * Drop the history imports of a source, so none of an earlier connection
 * writes into a later one. An import always has a run that is pending or
 * busy; newest first, none waits longer than the longest retry.
 */
async function cancelImports(ctx: MutationCtx, sourceId: Id<'energySources'>) {
  const since = Date.now() - HISTORY_RETRY_MAX_MS - HOUR_MS
  for await (const job of ctx.db.system
    .query('_scheduled_functions')
    .order('desc')) {
    if (job._creationTime < since) return
    const args = job.args[0] as Record<string, unknown> | undefined
    if (
      (job.state.kind === 'pending' || job.state.kind === 'inProgress') &&
      job.name.includes('syncSource') &&
      args?.sourceId === sourceId &&
      args.historyFrom !== undefined
    ) {
      const importId = args.importId as Id<'_scheduled_functions'> | undefined
      if (importId && (await isPending(ctx, importId))) {
        await ctx.scheduler.cancel(importId)
      }
      if (job.state.kind === 'pending') await ctx.scheduler.cancel(job._id)
    }
  }
}

// -- For the actions in energyHomeAssistant.ts ------------------------------------

const channelChoiceValidator = v.object({
  kind: energyChannelKindValidator,
  tariff: v.optional(energyTariffValidator),
  statisticId: v.string(),
})

/**
 * Authorises an admin for the connect actions, which have no `ctx.db`, and
 * hands them the stored connection and what the site already measures.
 */
export const connectContext = internalQuery({
  args: { groupSlug: v.string() },
  handler: async (ctx, args) => {
    const { group, role } = await requireGroupBySlug(ctx, args.groupSlug)
    if (role !== 'admin') throw new ConvexError(energyRefusal('adminOnly'))
    const site = await primarySiteOf(ctx, group._id)
    if (!site) throw new ConvexError(energyRefusal('notFound'))
    const { sources, channels } = await siteRows(ctx, site._id)
    const source = sources.find((each) => each.kind === 'homeAssistant')
    return {
      baseUrl: source?.baseUrl ?? null,
      secret: source?.secret ?? null,
      own: channels
        .filter((each) => each.sourceId === source?._id)
        .map(({ kind, tariff, externalRef }) => ({ kind, tariff, externalRef })),
      others: channels
        .filter((each) => each.sourceId !== source?._id)
        .map(({ kind, tariff, sourceId }) => ({
          kind,
          tariff,
          label: sources.find((each) => each._id === sourceId)?.label ?? '',
        })),
    }
  },
})

/**
 * Save a tested connection: one Home Assistant source per address, so
 * connecting again edits it. A channel switched off is retired with its
 * history; switched on again, or given another sensor, the same channel
 * carries on, so its hours never exist twice.
 */
export const saveConnection = internalMutation({
  args: {
    groupSlug: v.string(),
    baseUrl: v.string(),
    secret: v.string(),
    channels: v.array(channelChoiceValidator),
    /** The stored token was used: refused when it is no longer stored. */
    storedToken: v.boolean(),
    historyFrom: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user, group, role } = await requireGroupBySlug(ctx, args.groupSlug)
    if (role !== 'admin') throw new ConvexError(energyRefusal('adminOnly'))
    const site = await primarySiteOf(ctx, group._id)
    if (!site) throw new ConvexError(energyRefusal('notFound'))
    checkChoices(args.channels)

    const existing = await homeAssistantSource(ctx, site._id)
    const unchanged =
      Boolean(existing?.secret) && existing?.baseUrl === args.baseUrl
    if (args.storedToken && !(unchanged && existing?.secret === args.secret)) {
      // Disconnected or replaced while this connection was being tested.
      throw new ConvexError(energyRefusal('tokenNeeded'))
    }
    // An import still to run goes on through an edit of its own connection.
    if (existing && (!unchanged || args.historyFrom !== undefined)) {
      await cancelImports(ctx, existing._id)
    }
    const connection = {
      baseUrl: args.baseUrl,
      secret: args.secret,
      status: 'syncing' as const,
      lastError: undefined,
      connectedByUserId: user._id,
    }
    let sourceId = existing?._id
    if (existing) {
      await ctx.db.patch(existing._id, connection)
    } else {
      sourceId = await ctx.db.insert('energySources', {
        groupId: group._id,
        siteId: site._id,
        kind: 'homeAssistant',
        label: HOME_ASSISTANT_LABEL,
        ...connection,
      })
    }
    if (!sourceId) return null
    const source = sourceId

    const left = await ctx.db
      .query('energyChannels')
      .withIndex('by_source', (q) => q.eq('sourceId', source))
      .collect()
    // The one in use before a retired one, the newest first.
    left.sort(
      (a, b) =>
        Number(a.retiredAt !== undefined) - Number(b.retiredAt !== undefined) ||
        b._creationTime - a._creationTime,
    )
    const take = (match: (channel: Doc<'energyChannels'>) => boolean) => {
      const at = left.findIndex(match)
      return at < 0 ? undefined : left.splice(at, 1)[0]
    }
    const open: typeof args.channels = []
    const carryOn = (
      channel: Doc<'energyChannels'>,
      statisticId: string,
    ) =>
      ctx.db.patch(channel._id, {
        externalRef: statisticId,
        retiredAt: undefined,
      })
    for (const choice of args.channels) {
      const same = take(
        (each) =>
          each.kind === choice.kind &&
          each.tariff === choice.tariff &&
          each.externalRef === choice.statisticId,
      )
      if (same) await carryOn(same, choice.statisticId)
      else open.push(choice)
    }
    for (const choice of open) {
      const kin = take(
        (each) => each.kind === choice.kind && each.tariff === choice.tariff,
      )
      if (kin) {
        await carryOn(kin, choice.statisticId)
      } else {
        await ctx.db.insert('energyChannels', {
          groupId: group._id,
          siteId: site._id,
          sourceId: source,
          kind: choice.kind,
          tariff: choice.tariff,
          unit: energyChannelUnit(choice.kind),
          externalRef: choice.statisticId,
        })
      }
    }
    for (const channel of left) {
      if (channel.retiredAt === undefined) {
        await ctx.db.patch(channel._id, { retiredAt: Date.now() })
      }
    }
    // Usage reads a month of hours, of retired channels too.
    const channels = await ctx.db
      .query('energyChannels')
      .withIndex('by_source', (q) => q.eq('sourceId', source))
      .collect()
    if (
      (await mostChannelsInAMonth(ctx, channels, Date.now())) > MAX_CHANNELS
    ) {
      throw new ConvexError(energyRefusal('tooManyChannels'))
    }
    await reconcileManualChannels(ctx, site._id)
    await ctx.scheduler.runAfter(
      0,
      internal.energyHomeAssistant.syncSource,
      args.historyFrom === undefined
        ? { sourceId: source }
        : {
            sourceId: source,
            historyFrom: args.historyFrom,
            importId: await ctx.scheduler.runAfter(
              IMPORT_MS,
              internal.energySources.endImport,
              {},
            ),
          },
    )
    return null
  },
})

function checkChoices(
  channels: readonly {
    kind: Doc<'energyChannels'>['kind']
    tariff?: 't1' | 't2'
    statisticId: string
  }[],
) {
  if (channels.length === 0 || channels.length > MAX_CHANNELS) {
    throw new ConvexError(energyRefusal('pickChannel'))
  }
  if (new Set(channels.map((each) => each.statisticId)).size < channels.length) {
    throw new ConvexError(energyRefusal('channelTwice'))
  }
  for (const channel of channels) {
    const split = channel.kind === 'gridImport' || channel.kind === 'gridExport'
    if (channel.tariff && !split) {
      throw new ConvexError(energyRefusal('channelsMixed'))
    }
    // A counter of every tariff next to one of a single tariff would count
    // the same energy twice.
    if (
      channels.some(
        (other) =>
          energyChannelsOverlap(channel, other) &&
          other.tariff !== channel.tariff,
      )
    ) {
      throw new ConvexError(energyRefusal('channelsMixed'))
    }
  }
}

type SyncPlan = {
  baseUrl: string
  secret: string
  /** The next try of a history import. */
  retryId: Id<'_scheduled_functions'> | undefined
  channels: {
    channelId: Id<'energyChannels'>
    kind: Doc<'energyChannels'>['kind']
    statisticId: string
    from: number
  }[]
}

/**
 * What one sync reads: the connection and, per channel in use, the last hour
 * stored. Null when there is nothing to do: disconnected, or gone.
 *
 * A history import is tried again unless it is done, so its next try is
 * scheduled before it starts: one that is killed has it too.
 */
export const beginSync = internalMutation({
  args: {
    sourceId: v.id('energySources'),
    history: v.optional(
      v.object({
        from: v.number(),
        attempt: v.number(),
        importId: v.id('_scheduled_functions'),
        /** Statistics that still need `from`; omitted means every channel. */
        historyFor: v.optional(v.array(v.string())),
      }),
    ),
  },
  handler: async (ctx, args): Promise<SyncPlan | null> => {
    if (args.history && !(await isPending(ctx, args.history.importId))) {
      return null
    }
    const source = await ctx.db.get(args.sourceId)
    if (
      !source ||
      source.kind !== 'homeAssistant' ||
      !source.baseUrl ||
      !source.secret
    ) {
      if (args.history) await ctx.scheduler.cancel(args.history.importId)
      return null
    }
    const channels = await ctx.db
      .query('energyChannels')
      .withIndex('by_source', (q) => q.eq('sourceId', source._id))
      .collect()
    let retryId: Id<'_scheduled_functions'> | undefined
    if (args.history && args.history.attempt < HISTORY_RETRIES) {
      retryId = await ctx.scheduler.runAfter(
        retryDelay(args.history.attempt),
        internal.energyHomeAssistant.syncSource,
        {
          sourceId: source._id,
          historyFrom: args.history.from,
          attempt: args.history.attempt + 1,
          importId: args.history.importId,
          ...(args.history.historyFor !== undefined
            ? { historyFor: args.history.historyFor }
            : {}),
        },
      )
    }
    // A refused token waits for a new one; so does its import.
    if (args.history && source.status === 'needsReconnect') {
      if (!retryId) await ctx.scheduler.cancel(args.history.importId)
      return null
    }
    // Only a long import shows as busy; the hourly one is done in seconds.
    if (args.history && source.status !== 'syncing') {
      await ctx.db.patch(source._id, { status: 'syncing' })
    }
    return {
      baseUrl: source.baseUrl,
      secret: source.secret,
      retryId,
      channels: await Promise.all(
        channels
          .filter((each) => each.retiredAt === undefined && each.externalRef)
          .map(async (channel) => {
            const last = await ctx.db
              .query('energyIntervals')
              .withIndex('by_channel_hour', (q) =>
                q.eq('channelId', channel._id),
              )
              .order('desc')
              .first()
            return {
              channelId: channel._id,
              kind: channel.kind,
              statisticId: channel.externalRef ?? '',
              // The stored hour itself is read again, as the baseline. A new
              // channel starts at the hour it was added.
              from:
                last?.hourStart ??
                Math.floor(channel._creationTime / HOUR_MS) * HOUR_MS - HOUR_MS,
            }
          }),
      ),
    }
  },
})

/**
 * Store hourly amounts: one row per channel and hour, whatever is stored
 * again. A channel edited meanwhile is left out, so one sensor's hours never
 * land in another's channel. Answers `stop` when the connection is gone or
 * changed, or the import this run belongs to was dropped.
 */
export const storeIntervals = internalMutation({
  args: {
    sourceId: v.id('energySources'),
    baseUrl: v.string(),
    importId: v.optional(v.id('_scheduled_functions')),
    batches: v.array(
      v.object({
        channelId: v.id('energyChannels'),
        statisticId: v.string(),
        hours: v.array(v.object({ hourStart: v.number(), amount: v.number() })),
      }),
    ),
  },
  returns: v.union(v.literal('stored'), v.literal('partly'), v.literal('stop')),
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId)
    if (!source?.secret || source.baseUrl !== args.baseUrl) {
      return 'stop' as const
    }
    if (args.importId && !(await isPending(ctx, args.importId))) {
      return 'stop' as const
    }
    let partly = false
    for (const batch of args.batches) {
      const channel = await ctx.db.get(batch.channelId)
      const first = batch.hours[0]
      const last = batch.hours[batch.hours.length - 1]
      if (!first || !last) continue
      if (
        !channel ||
        channel.sourceId !== source._id ||
        channel.externalRef !== batch.statisticId ||
        channel.retiredAt !== undefined
      ) {
        // Edited meanwhile: the other channels carry on.
        partly = true
        continue
      }
      const stored = await ctx.db
        .query('energyIntervals')
        .withIndex('by_channel_hour', (q) =>
          q
            .eq('channelId', channel._id)
            .gte('hourStart', first.hourStart)
            .lte('hourStart', last.hourStart),
        )
        .collect()
      const byHour = new Map(stored.map((each) => [each.hourStart, each]))
      for (const hour of batch.hours) {
        const row = byHour.get(hour.hourStart)
        if (!row) {
          await ctx.db.insert('energyIntervals', {
            groupId: channel.groupId,
            channelId: channel._id,
            hourStart: hour.hourStart,
            amount: hour.amount,
            estimated: false,
          })
        } else if (row.amount !== hour.amount || row.estimated) {
          await ctx.db.patch(row._id, { amount: hour.amount, estimated: false })
        }
      }
    }
    return partly ? ('partly' as const) : ('stored' as const)
  },
})

async function isPending(ctx: QueryCtx, id: Id<'_scheduled_functions'>) {
  return (await ctx.db.system.get(id))?.state.kind === 'pending'
}

/** Carry a long import on in a new run, before this one's time is up. */
export const continueImport = internalMutation({
  args: {
    sourceId: v.id('energySources'),
    importId: v.id('_scheduled_functions'),
    retryId: v.id('_scheduled_functions'),
    historyFrom: v.number(),
    attempt: v.number(),
    readFrom: v.number(),
    sums: v.array(v.object({ statisticId: v.string(), sum: v.number() })),
    incomplete: v.boolean(),
    historyFor: v.optional(v.array(v.string())),
    missed: v.optional(v.array(v.string())),
  },
  returns: v.null(),
  handler: async (ctx, { retryId, ...args }) => {
    if (!(await isPending(ctx, args.importId))) return null
    if (await isPending(ctx, retryId)) await ctx.scheduler.cancel(retryId)
    await ctx.scheduler.runAfter(
      0,
      internal.energyHomeAssistant.syncSource,
      args,
    )
    return null
  },
})

/**
 * Record how a sync ended. `lastSyncedAt` moves only when every channel was
 * read, so a source in error keeps saying when its data is from (ADR-0020).
 */
export const finishSync = internalMutation({
  args: {
    sourceId: v.id('energySources'),
    baseUrl: v.string(),
    /** A sync of an earlier connection says nothing about this one. */
    secret: v.string(),
    problem: v.union(
      v.null(),
      v.literal('unreachable'),
      v.literal('notHomeAssistant'),
      v.literal('badToken'),
      v.literal('statisticMissing'),
      v.literal('syncFailed'),
    ),
    missing: v.array(v.string()),
    /** The import this run belongs to, and its next try. */
    importId: v.optional(v.id('_scheduled_functions')),
    retryId: v.optional(v.id('_scheduled_functions')),
    /** Narrow the scheduled retry to statistics that still need history. */
    retry: v.optional(
      v.object({
        historyFrom: v.number(),
        attempt: v.number(),
        historyFor: v.array(v.string()),
      }),
    ),
    done: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.importId) {
      if (!(await isPending(ctx, args.importId))) return null
      if (args.done || !args.retryId) {
        await ctx.scheduler.cancel(args.importId)
        if (args.retryId && (await isPending(ctx, args.retryId))) {
          await ctx.scheduler.cancel(args.retryId)
        }
      }
    }
    const source = await ctx.db.get(args.sourceId)
    if (
      !source?.secret ||
      source.secret !== args.secret ||
      source.baseUrl !== args.baseUrl
    ) {
      return null
    }
    if (
      args.importId &&
      !args.done &&
      args.retry &&
      args.retryId &&
      (await isPending(ctx, args.retryId))
    ) {
      await ctx.scheduler.cancel(args.retryId)
      await ctx.scheduler.runAfter(
        retryDelay(args.retry.attempt),
        internal.energyHomeAssistant.syncSource,
        {
          sourceId: source._id,
          historyFrom: args.retry.historyFrom,
          attempt: args.retry.attempt + 1,
          importId: args.importId,
          historyFor: args.retry.historyFor,
        },
      )
    }
    if (args.problem === null) {
      await ctx.db.patch(source._id, {
        status: 'ok',
        lastSyncedAt: Date.now(),
        lastError: undefined,
      })
    } else {
      await ctx.db.patch(source._id, {
        // A refused token is not tried again: Home Assistant bans an address
        // after a few wrong ones.
        status: args.problem === 'badToken' ? 'needsReconnect' : 'error',
        lastError: energySourceProblemValue(args.problem, args.missing),
      })
    }
    return null
  },
})

/** The statuses the hourly cron syncs: every one but `needsReconnect`. */
const SYNCED_STATUSES = ['ok', 'error', 'syncing'] as const

/** Hourly: start a sync of every connected Home Assistant, a page at a time. */
export const startSyncs = internalMutation({
  args: {
    status: v.optional(
      v.union(v.literal('ok'), v.literal('error'), v.literal('syncing')),
    ),
    cursor: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const status = args.status ?? SYNCED_STATUSES[0]
    const page = await ctx.db
      .query('energySources')
      .withIndex('by_kind_status', (q) =>
        q.eq('kind', 'homeAssistant').eq('status', status),
      )
      .paginate({ numItems: SOURCES_PER_STEP, cursor: args.cursor ?? null })
    for (const [index, source] of page.page.entries()) {
      if (!source.secret) continue
      await ctx.scheduler.runAfter(
        index * SYNC_STAGGER_MS,
        internal.energyHomeAssistant.syncSource,
        { sourceId: source._id },
      )
    }
    const next = page.isDone
      ? SYNCED_STATUSES[SYNCED_STATUSES.indexOf(status) + 1]
      : status
    if (next) {
      await ctx.scheduler.runAfter(
        page.page.length * SYNC_STAGGER_MS,
        internal.energySources.startSyncs,
        page.isDone
          ? { status: next }
          : { status: next, cursor: page.continueCursor },
      )
    }
    return null
  },
})
