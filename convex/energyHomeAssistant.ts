'use node'

/**
 * The actions that talk to a Group's Home Assistant (APP-495): test and save
 * a connection, and read its hourly statistics.
 *
 * In Node, because Home Assistant gives statistics over a WebSocket only and
 * Convex's default runtime has no client for one; Node's also lets the
 * connection refuse a private address at the moment it resolves.
 *
 * Read-only: see `lib/homeAssistant.ts`. The token never leaves the server:
 * no action returns it, and it is in no scheduled argument.
 */
import {
  ENERGY_CHANNEL_ORDER,
  energyChannelsOverlap,
  energyProposals,
  haStatisticFits,
  hourlyAmountsFromSums,
  hourlyLevels,
  readHaHours,
  readHaStatistics,
} from '@gather/core/energy'
import { energyRefusal } from '@gather/core/refusals'
import { ConvexError, type Infer, v } from 'convex/values'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { action, internalAction } from './_generated/server'
import { rejectConnectedApps } from './lib/connectedApps'
import { energyChannelKindValidator, energyTariffValidator } from './lib/energy'
import { pacedWrite } from './lib/energyWritePace'
import { connectHomeAssistant, HomeAssistantError } from './lib/homeAssistant'
import { homeAssistantOrigin } from './lib/homeAssistantUrl'

const HOUR_MS = 3_600_000
const DAY_MS = 24 * HOUR_MS
/** A year of hours, and no more than a month of them per question. */
const HISTORY_MS = 365 * DAY_MS
const WINDOW_MS = 31 * DAY_MS
/** Rows per mutation: far under Convex's limits, and quick to retry. */
const ROWS_PER_WRITE = 500
/** An unreachable first import is tried again every hour for a day. */
const HISTORY_RETRIES = 24
const TOKEN_LIMIT = 1000
/** Sensors offered to pick from; a large home has a few hundred. */
const STATISTICS_LIMIT = 1000

const proposalValidator = v.object({
  kind: energyChannelKindValidator,
  tariff: v.optional(energyTariffValidator),
  statisticId: v.string(),
  available: v.boolean(),
  /** What the switch starts at. */
  on: v.boolean(),
  /** Another source's label, when it already supplies this channel. */
  suppliedBy: v.union(v.string(), v.null()),
})

const testedValidator = v.object({
  version: v.string(),
  /** False while Home Assistant has no Energy dashboard set up. */
  hasDashboard: v.boolean(),
  proposals: v.array(proposalValidator),
  statistics: v.array(
    v.object({
      id: v.string(),
      name: v.union(v.string(), v.null()),
      measure: v.union(
        v.literal('energy'),
        v.literal('volume'),
        v.literal('percent'),
      ),
    }),
  ),
})

const connectionArgs = {
  groupSlug: v.string(),
  address: v.string(),
  /** Left out to keep the stored token, for an unchanged address only. */
  token: v.optional(v.string()),
}

type Stored = { baseUrl: string | null; secret: string | null }

/**
 * The address and token to use. The stored token goes only to the address it
 * was stored for: otherwise anyone who may edit the address could point it at
 * a server of their own and read the token there.
 */
function connectionOf(
  args: { address: string; token?: string },
  stored: Stored,
): { origin: string; token: string } {
  const checked = homeAssistantOrigin(args.address)
  if ('problem' in checked) {
    throw new ConvexError(energyRefusal(checked.problem))
  }
  const typed = args.token?.trim()
  if (typed) {
    if (typed.length > TOKEN_LIMIT || /\s/.test(typed)) {
      throw new ConvexError(energyRefusal('sourceBadToken'))
    }
    return { origin: checked.origin, token: typed }
  }
  if (!stored.secret || stored.baseUrl !== checked.origin) {
    throw new ConvexError(energyRefusal('tokenNeeded'))
  }
  return { origin: checked.origin, token: stored.secret }
}

function connectRefusal(error: unknown): unknown {
  if (!(error instanceof HomeAssistantError)) return error
  const code = {
    unreachable: 'sourceUnreachable',
    notHomeAssistant: 'sourceNotHomeAssistant',
    badToken: 'sourceBadToken',
  } as const
  return new ConvexError(energyRefusal(code[error.problem]))
}

/** Step 1: whether it answers, and the channels it proposes. Saves nothing. */
export const test = action({
  args: connectionArgs,
  returns: testedValidator,
  handler: async (ctx, args): Promise<Infer<typeof testedValidator>> => {
    // Stays in the app (ADR-0046).
    await rejectConnectedApps(ctx)
    const context = await ctx.runQuery(internal.energySources.connectContext, {
      groupSlug: args.groupSlug,
    })
    const { origin, token } = connectionOf(args, context)
    try {
      const client = await connectHomeAssistant(origin, token)
      try {
        const preferences = await client.energyPreferences()
        const statistics = readHaStatistics(await client.statistics())
        const proposals = energyProposals(preferences, statistics).map(
          (proposal) => ({ ...proposal, existing: false }),
        )
        // Editing: what is connected now wins from what is proposed.
        const taken = new Set<number>()
        for (const own of context.own) {
          if (!own.externalRef) continue
          const available = statistics.some(
            (each) =>
              each.id === own.externalRef && haStatisticFits(each, own.kind),
          )
          let at = proposals.findIndex(
            (each, index) =>
              !taken.has(index) &&
              each.kind === own.kind &&
              each.tariff === own.tariff &&
              each.statisticId === own.externalRef,
          )
          if (at < 0) {
            at = proposals.findIndex(
              (each, index) =>
                !taken.has(index) &&
                each.kind === own.kind &&
                each.tariff === own.tariff,
            )
          }
          const row = {
            kind: own.kind,
            ...(own.tariff ? { tariff: own.tariff } : {}),
            statisticId: own.externalRef,
            available,
            fromDashboard: true,
            existing: true,
          }
          if (at < 0) {
            taken.add(proposals.push(row) - 1)
          } else {
            proposals[at] = row
            taken.add(at)
          }
        }
        proposals.sort(
          (a, b) =>
            ENERGY_CHANNEL_ORDER.indexOf(a.kind) -
              ENERGY_CHANNEL_ORDER.indexOf(b.kind) ||
            (a.tariff ?? '').localeCompare(b.tariff ?? ''),
        )
        const editing = context.own.length > 0
        return {
          version: client.version,
          hasDashboard: preferences !== null,
          proposals: proposals.map(
            ({ kind, tariff, statisticId, available, ...each }) => {
              const supplier = context.others.find((other) =>
                energyChannelsOverlap(other, { kind, tariff }),
              )
              return {
                kind,
                ...(tariff ? { tariff } : {}),
                statisticId,
                available,
                on: editing
                  ? each.existing
                  : available && each.fromDashboard && !supplier,
                suppliedBy: supplier?.label ?? null,
              }
            },
          ),
          statistics: statistics
            .sort((a, b) => a.id.localeCompare(b.id))
            .slice(0, STATISTICS_LIMIT),
        }
      } finally {
        client.close()
      }
    } catch (error) {
      throw connectRefusal(error)
    }
  },
})

/** Step 2: save the connection and its channels, and start reading. */
export const connect = action({
  args: {
    ...connectionArgs,
    channels: v.array(
      v.object({
        kind: energyChannelKindValidator,
        tariff: v.optional(energyTariffValidator),
        statisticId: v.string(),
      }),
    ),
    history: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    // Stays in the app (ADR-0046).
    await rejectConnectedApps(ctx)
    const context = await ctx.runQuery(internal.energySources.connectContext, {
      groupSlug: args.groupSlug,
    })
    const { origin, token } = connectionOf(args, context)
    try {
      const client = await connectHomeAssistant(origin, token)
      try {
        const known = new Map(
          readHaStatistics(await client.statistics()).map((each) => [
            each.id,
            each,
          ]),
        )
        for (const channel of args.channels) {
          const statistic = known.get(channel.statisticId)
          if (!statistic || !haStatisticFits(statistic, channel.kind)) {
            throw new ConvexError(energyRefusal('statisticNotFound'))
          }
        }
      } finally {
        client.close()
      }
    } catch (error) {
      throw connectRefusal(error)
    }
    await ctx.runMutation(internal.energySources.saveConnection, {
      groupSlug: args.groupSlug,
      baseUrl: origin,
      secret: token,
      channels: args.channels,
      ...(args.history
        ? {
            historyFrom:
              Math.floor(Date.now() / HOUR_MS) * HOUR_MS - HISTORY_MS,
          }
        : {}),
    })
    return null
  },
})

type Plan = {
  channelId: Id<'energyChannels'>
  kind: (typeof ENERGY_CHANNEL_ORDER)[number]
  statisticId: string
  from: number
}

/**
 * Read one source's new hours. With `historyFrom` every channel is read from
 * there instead of from its last stored hour. Oldest first, so an import that
 * stops halfway is carried on by the next hourly sync.
 */
export const syncSource = internalAction({
  args: {
    sourceId: v.id('energySources'),
    historyFrom: v.optional(v.number()),
    attempt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const plan = await ctx.runMutation(internal.energySources.beginSync, {
      sourceId: args.sourceId,
      history: args.historyFrom !== undefined,
    })
    if (!plan) return null
    const finish = (
      problem: HomeAssistantError['problem'] | 'statisticMissing' | 'syncFailed' | null,
      missing: string[] = [],
    ) =>
      ctx.runMutation(internal.energySources.finishSync, {
        sourceId: args.sourceId,
        baseUrl: plan.baseUrl,
        secret: plan.secret,
        problem,
        missing,
      })

    // The hour still running has no statistic yet.
    const end = Math.floor(Date.now() / HOUR_MS) * HOUR_MS
    let client: Awaited<ReturnType<typeof connectHomeAssistant>> | null = null
    try {
      client = await connectHomeAssistant(plan.baseUrl, plan.secret)
      const known = new Map(
        readHaStatistics(await client.statistics()).map((each) => [
          each.id,
          each,
        ]),
      )
      const missing: string[] = []
      const channels: (Plan & { baseline: number | null })[] = []
      for (const channel of plan.channels) {
        const statistic = known.get(channel.statisticId)
        if (!statistic || !haStatisticFits(statistic, channel.kind)) {
          missing.push(channel.statisticId)
          continue
        }
        channels.push({
          ...channel,
          from: args.historyFrom ?? channel.from,
          baseline: null,
        })
      }

      let write: { channel: Plan; hour: { hourStart: number; amount: number } }[] = []
      const flush = async (): Promise<boolean> => {
        if (write.length === 0) return true
        const batches = new Map<
          string,
          {
            channelId: Id<'energyChannels'>
            statisticId: string
            hours: { hourStart: number; amount: number }[]
          }
        >()
        for (const { channel, hour } of write) {
          const batch = batches.get(channel.channelId) ?? {
            channelId: channel.channelId,
            statisticId: channel.statisticId,
            hours: [],
          }
          batch.hours.push(hour)
          batches.set(channel.channelId, batch)
        }
        const rows = write.length
        write = []
        return await pacedWrite(rows, () =>
          ctx.runMutation(internal.energySources.storeIntervals, {
            sourceId: args.sourceId,
            baseUrl: plan.baseUrl,
            batches: [...batches.values()],
          }),
        )
      }

      let from = Math.min(end, ...channels.map((each) => each.from))
      while (from < end) {
        const to = Math.min(end, from + WINDOW_MS)
        const asked = channels.filter((each) => each.from < to)
        const answer = await client.hourly(
          asked.map((each) => each.statisticId),
          from,
          to,
        )
        for (const channel of asked) {
          const hours = readHaHours(answer[channel.statisticId]).filter(
            (each) => each.hourStart >= channel.from && each.hourStart < to,
          )
          let amounts: { hourStart: number; amount: number }[]
          if (channel.kind === 'batterySoc') {
            amounts = hourlyLevels(hours)
          } else {
            const read = hourlyAmountsFromSums(hours, channel.baseline)
            amounts = read.amounts
            channel.baseline = read.baseline
          }
          for (const hour of amounts) {
            write.push({ channel, hour })
            if (write.length >= ROWS_PER_WRITE && !(await flush())) return null
          }
        }
        if (!(await flush())) return null
        from = to
      }
      await finish(missing.length ? 'statisticMissing' : null, missing)
    } catch (error) {
      // Not Home Assistant's doing: a failed write. Convex reports it, and
      // the next hourly sync starts again from the last stored hour.
      const problem =
        error instanceof HomeAssistantError ? error.problem : 'syncFailed'
      // The retry first: recording the problem is a write that can fail too.
      const attempt = args.attempt ?? 0
      if (
        problem !== 'badToken' &&
        args.historyFrom !== undefined &&
        attempt < HISTORY_RETRIES
      ) {
        await ctx.scheduler.runAfter(
          HOUR_MS,
          internal.energyHomeAssistant.syncSource,
          { ...args, attempt: attempt + 1 },
        )
      }
      await finish(problem)
      if (!(error instanceof HomeAssistantError)) throw error
    } finally {
      client?.close()
    }
    return null
  },
})
