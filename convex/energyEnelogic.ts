/**
 * Enelogic as an Energy source (APP-497): connect a Group's Enelogic account
 * through OAuth2, pick channels from its measuring points, and read their
 * meter readings into hourly amounts.
 *
 * The OAuth round trip runs on the web, through the same
 * `/integrations/callback` as Notion and Todoist; the phone points there. Only
 * an admin connects (as for Home Assistant). The refresh token is the source's
 * `secret`: server-only, never returned or exported (ADR-0051).
 *
 * Enelogic gives 500 API calls a month for free (its API documentation), so
 * an account is read every six hours (`crons.ts`), one call per measuring
 * point, and a history import one call per point and month.
 */
import {
  ENERGY_CHANNEL_ORDER,
  type EnelogicPoint,
  type EnelogicReading,
  enelogicDay,
  enelogicHours,
  enelogicProposals,
  enelogicRateChannel,
  enelogicRates,
  enelogicStatistics,
  energyChannelsOverlap,
  energySourceProblemValue,
  hourlyAmountsFromSums,
  parseEnelogicRef,
  readEnelogicPoints,
  readEnelogicReadings,
} from '@gather/core/energy'
import { energyRefusal } from '@gather/core/refusals'
import { ConvexError, type Infer, v } from 'convex/values'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import {
  type ActionCtx,
  action,
  internalAction,
  internalMutation,
  internalQuery,
} from './_generated/server'
import { applyChannels, checkChoices, sourceOfKind } from './energySources'
import { rejectConnectedApps } from './lib/connectedApps'
import { energyChannelKindValidator, energyTariffValidator } from './lib/energy'
import { HISTORY_MS } from './lib/energyChannelLimit'
import { reconcileManualChannels } from './lib/energyManual'
import { primarySiteOf } from './lib/energyUsage'
import { pacedWrite } from './lib/energyWritePace'
import { requireGroupBySlug } from './lib/groupAccess'

const HOUR_MS = 3_600_000
const DAY_MS = 24 * HOUR_MS
const AUTHORIZE_URL = 'https://enelogic.com/oauth/v2/auth'
const TOKEN_URL = 'https://enelogic.com/oauth/v2/token'
const API_URL = 'https://enelogic.com/api'
/** A brand, so the same in every language. */
const LABEL = 'Enelogic'
/** Enelogic is Dutch; a point names its zone, the sync assumes this one. */
const TIME_ZONE = 'Europe/Amsterdam'
/** Days of quarter hours per question: a month is some 18,000 rows. */
const WINDOW_DAYS = 31
const ROWS_PER_WRITE = 500
const FETCH_MS = 30_000
/** Points read for the channels to pick from; a household has two or three. */
const POINTS_LIMIT = 10

// -- Talking to Enelogic -----------------------------------------------------------

type EnelogicProblem = 'revoked' | 'unreachable' | 'missing'

class EnelogicError extends Error {
  constructor(readonly problem: EnelogicProblem) {
    super(`Enelogic: ${problem}`)
  }
}

function oauthClient(): { clientId: string; clientSecret: string } {
  const clientId = process.env.ENELOGIC_CLIENT_ID
  const clientSecret = process.env.ENELOGIC_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new ConvexError(energyRefusal('enelogicNotConfigured'))
  }
  return { clientId, clientSecret }
}

async function request(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch {
    throw new EnelogicError('unreachable')
  } finally {
    clearTimeout(timer)
  }
}

/** A token answer: a refused grant is `revoked`, anything else unexpected `unreachable`. */
async function tokens(
  grant: Record<string, string>,
): Promise<{ access: string; refresh: string | null }> {
  const { clientId, clientSecret } = oauthClient()
  const response = await request(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      ...grant,
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  })
  if (response.status === 400 || response.status === 401) {
    throw new EnelogicError('revoked')
  }
  if (!response.ok) throw new EnelogicError('unreachable')
  const body = (await response.json().catch(() => null)) as Record<
    string,
    unknown
  > | null
  const access = body?.access_token
  const refresh = body?.refresh_token
  if (typeof access !== 'string' || !access) {
    throw new EnelogicError('unreachable')
  }
  return {
    access,
    refresh: typeof refresh === 'string' && refresh ? refresh : null,
  }
}

async function apiGet(path: string, access: string): Promise<unknown> {
  const response = await request(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${access}`, Accept: 'application/json' },
  })
  if (response.status === 401 || response.status === 403) {
    throw new EnelogicError('revoked')
  }
  if (response.status === 404) throw new EnelogicError('missing')
  if (!response.ok) throw new EnelogicError('unreachable')
  return await response.json().catch(() => {
    throw new EnelogicError('unreachable')
  })
}

/**
 * An access token for one run. Enelogic may hand out a new refresh token with
 * it and drop the old one, so the new one is stored at once, and only over the
 * one this run read: when another run got there first, this one stops (null).
 */
async function accessFor(
  ctx: ActionCtx,
  sourceId: Id<'energySources'>,
  refresh: string,
): Promise<string | null> {
  let answer: Awaited<ReturnType<typeof tokens>>
  try {
    answer = await tokens({
      grant_type: 'refresh_token',
      refresh_token: refresh,
    })
  } catch (error) {
    if (error instanceof EnelogicError && error.problem === 'revoked') {
      const now = await ctx.runQuery(internal.energyEnelogic.storedSecret, {
        sourceId,
      })
      if (now !== null && now !== refresh) return null
    }
    throw error
  }
  if (answer.refresh && answer.refresh !== refresh) {
    const stored = await ctx.runMutation(internal.energyEnelogic.rotateSecret, {
      sourceId,
      from: refresh,
      to: answer.refresh,
    })
    if (!stored) return null
  }
  return answer.access
}

function refusalOf(error: unknown): unknown {
  if (!(error instanceof EnelogicError)) return error
  return new ConvexError(
    energyRefusal(
      error.problem === 'revoked' ? 'enelogicRevoked' : 'enelogicUnreachable',
    ),
  )
}

/** Each day of the last three, for the registers a point has. */
async function pointsWithRates(access: string) {
  const points = readEnelogicPoints(
    await apiGet('/measuringpoints/', access),
  ).slice(0, POINTS_LIMIT)
  const now = Date.now()
  return await Promise.all(
    points.map(async (point) => {
      const from = enelogicDay(now - 3 * DAY_MS, point.timeZone)
      const to = enelogicDay(now + DAY_MS, point.timeZone)
      let rates: number[] = []
      try {
        rates = enelogicRates(
          readEnelogicReadings(
            await apiGet(
              `/measuringpoints/${point.id}/datapoint/days/${from}/${to}`,
              access,
            ),
            point.timeZone,
          ),
        )
      } catch (error) {
        // A point without days answers so; it offers nothing.
        if (!(error instanceof EnelogicError) || error.problem !== 'missing') {
          throw error
        }
      }
      return { point, rates }
    }),
  )
}

// -- Connecting (web, admins) ----------------------------------------------------

/** Where the web sends an admin to allow Gather in. */
export const authorizeUrl = action({
  args: { groupSlug: v.string(), redirectUri: v.string(), state: v.string() },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    // Stays in the app (ADR-0046).
    await rejectConnectedApps(ctx)
    await ctx.runQuery(internal.energySources.connectContext, {
      groupSlug: args.groupSlug,
      kind: 'enelogic',
    })
    const url = new URL(AUTHORIZE_URL)
    url.searchParams.set('client_id', oauthClient().clientId)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', 'account')
    url.searchParams.set('redirect_uri', args.redirectUri)
    url.searchParams.set('state', args.state)
    return url.toString()
  },
})

/** Finish the round trip: store the refresh token for the Group's address. */
export const completeOAuth = action({
  args: { groupSlug: v.string(), code: v.string(), redirectUri: v.string() },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    // Stays in the app (ADR-0046).
    await rejectConnectedApps(ctx)
    await ctx.runQuery(internal.energySources.connectContext, {
      groupSlug: args.groupSlug,
      kind: 'enelogic',
    })
    let answer: Awaited<ReturnType<typeof tokens>>
    try {
      answer = await tokens({
        grant_type: 'authorization_code',
        code: args.code,
        redirect_uri: args.redirectUri,
      })
    } catch (error) {
      if (error instanceof EnelogicError && error.problem === 'revoked') {
        throw new ConvexError(energyRefusal('enelogicRefused'))
      }
      throw refusalOf(error)
    }
    // Without one, Gather could read for an hour and then never again.
    if (!answer.refresh) throw new ConvexError(energyRefusal('enelogicRefused'))
    await ctx.runMutation(internal.energyEnelogic.saveAccount, {
      groupSlug: args.groupSlug,
      secret: answer.refresh,
    })
    return null
  },
})

const proposalValidator = v.object({
  kind: energyChannelKindValidator,
  tariff: v.optional(energyTariffValidator),
  statisticId: v.string(),
  available: v.boolean(),
  on: v.boolean(),
  suppliedBy: v.union(v.string(), v.null()),
})

const testedValidator = v.object({
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

/** Read the measuring points: the channels they propose. Saves nothing. */
export const test = action({
  args: { groupSlug: v.string() },
  returns: testedValidator,
  handler: async (ctx, args): Promise<Infer<typeof testedValidator>> => {
    // Stays in the app (ADR-0046).
    await rejectConnectedApps(ctx)
    const context = await ctx.runQuery(internal.energySources.connectContext, {
      groupSlug: args.groupSlug,
      kind: 'enelogic',
    })
    if (!context.sourceId || !context.secret) {
      throw new ConvexError(energyRefusal('enelogicNotConnected'))
    }
    let points: { point: EnelogicPoint; rates: number[] }[]
    try {
      const access = await accessFor(ctx, context.sourceId, context.secret)
      // Another run has just renewed the access: try again in a moment.
      if (access === null) {
        throw new ConvexError(energyRefusal('enelogicUnreachable'))
      }
      points = await pointsWithRates(access)
    } catch (error) {
      if (error instanceof EnelogicError && error.problem === 'revoked') {
        await ctx.runMutation(internal.energyEnelogic.finishSync, {
          sourceId: context.sourceId,
          problem: 'enelogicRevoked',
          missing: [],
        })
      }
      throw refusalOf(error)
    }
    const statistics = enelogicStatistics(points)
    const known = new Set(statistics.map((each) => each.id))
    const editing = context.own.length > 0
    // Editing: what is connected now comes first, then what else is proposed.
    const rows = [
      ...context.own.flatMap(({ kind, tariff, externalRef }) =>
        externalRef ? [{ kind, tariff, statisticId: externalRef, on: true }] : [],
      ),
      ...enelogicProposals(points)
        .filter(
          (proposal) =>
            !context.own.some((own) => energyChannelsOverlap(own, proposal)),
        )
        .map((proposal) => ({ ...proposal, on: !editing })),
    ]
    rows.sort(
      (a, b) =>
        ENERGY_CHANNEL_ORDER.indexOf(a.kind) -
          ENERGY_CHANNEL_ORDER.indexOf(b.kind) ||
        (a.tariff ?? '').localeCompare(b.tariff ?? ''),
    )
    return {
      proposals: rows.map(({ kind, tariff, statisticId, on }) => {
        const supplier = context.others.find((other) =>
          energyChannelsOverlap(other, { kind, tariff }),
        )
        const available = known.has(statisticId)
        return {
          kind,
          ...(tariff ? { tariff } : {}),
          statisticId,
          available,
          on: editing ? on : on && available && !supplier,
          suppliedBy: supplier?.label ?? null,
        }
      }),
      statistics,
    }
  },
})

/** Save the channels, and start reading. */
export const connect = action({
  args: {
    groupSlug: v.string(),
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
    for (const channel of args.channels) {
      const ref = parseEnelogicRef(channel.statisticId)
      const fits =
        ref !== null &&
        [false, true].some((gas) => {
          const read = enelogicRateChannel(ref.rate, gas)
          return read?.kind === channel.kind && read.tariff === channel.tariff
        })
      if (!fits) throw new ConvexError(energyRefusal('registerNotFound'))
    }
    await ctx.runMutation(internal.energyEnelogic.saveChannels, {
      groupSlug: args.groupSlug,
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

// -- Stored state ------------------------------------------------------------------

/** One Enelogic source per address: signing in again replaces its token. */
export const saveAccount = internalMutation({
  args: { groupSlug: v.string(), secret: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user, group, role } = await requireGroupBySlug(ctx, args.groupSlug)
    if (role !== 'admin') throw new ConvexError(energyRefusal('adminOnly'))
    const site = await primarySiteOf(ctx, group._id)
    if (!site) throw new ConvexError(energyRefusal('notFound'))
    const existing = await sourceOfKind(ctx, site._id, 'enelogic')
    const account = {
      secret: args.secret,
      status: 'ok' as const,
      lastError: undefined,
      connectedByUserId: user._id,
    }
    if (!existing) {
      await ctx.db.insert('energySources', {
        groupId: group._id,
        siteId: site._id,
        kind: 'enelogic',
        label: LABEL,
        ...account,
      })
      return null
    }
    await ctx.db.patch(existing._id, account)
    // Signed in again after a refusal or a disconnect: its channels go on.
    await reconcileManualChannels(ctx, site._id)
    await ctx.scheduler.runAfter(0, internal.energyEnelogic.syncSource, {
      sourceId: existing._id,
    })
    return null
  },
})

export const saveChannels = internalMutation({
  args: {
    groupSlug: v.string(),
    channels: v.array(
      v.object({
        kind: energyChannelKindValidator,
        tariff: v.optional(energyTariffValidator),
        statisticId: v.string(),
      }),
    ),
    historyFrom: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { group, role } = await requireGroupBySlug(ctx, args.groupSlug)
    if (role !== 'admin') throw new ConvexError(energyRefusal('adminOnly'))
    const site = await primarySiteOf(ctx, group._id)
    if (!site) throw new ConvexError(energyRefusal('notFound'))
    const source = await sourceOfKind(ctx, site._id, 'enelogic')
    if (!source?.secret) {
      throw new ConvexError(energyRefusal('enelogicNotConnected'))
    }
    checkChoices(args.channels)
    await applyChannels(ctx, {
      groupId: group._id,
      siteId: site._id,
      sourceId: source._id,
      channels: args.channels,
    })
    if (args.historyFrom !== undefined) {
      await ctx.db.patch(source._id, { status: 'syncing' })
    }
    await ctx.scheduler.runAfter(
      0,
      internal.energyEnelogic.syncSource,
      args.historyFrom === undefined
        ? { sourceId: source._id }
        : { sourceId: source._id, historyFrom: args.historyFrom },
    )
    return null
  },
})

export const storedSecret = internalQuery({
  args: { sourceId: v.id('energySources') },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) =>
    (await ctx.db.get(args.sourceId))?.secret ?? null,
})

/** Replace the refresh token, only over the one the run read. */
export const rotateSecret = internalMutation({
  args: { sourceId: v.id('energySources'), from: v.string(), to: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId)
    if (!source || source.secret !== args.from) return false
    await ctx.db.patch(source._id, { secret: args.to })
    return true
  },
})

type Plan = {
  secret: string
  channels: {
    channelId: Id<'energyChannels'>
    statisticId: string
    pointId: number
    rate: number
    from: number
  }[]
}

/** What one sync reads, or null: disconnected, refused, or gone. */
export const planSync = internalQuery({
  args: { sourceId: v.id('energySources') },
  handler: async (ctx, args): Promise<Plan | null> => {
    const source = await ctx.db.get(args.sourceId)
    if (
      source?.kind !== 'enelogic' ||
      !source.secret ||
      source.status === 'needsReconnect'
    ) {
      return null
    }
    const channels = await ctx.db
      .query('energyChannels')
      .withIndex('by_source', (q) => q.eq('sourceId', source._id))
      .collect()
    const plan: Plan['channels'] = []
    for (const channel of channels) {
      const ref = channel.externalRef && parseEnelogicRef(channel.externalRef)
      if (channel.retiredAt !== undefined || !ref || !channel.externalRef) {
        continue
      }
      const last = await ctx.db
        .query('energyIntervals')
        .withIndex('by_channel_hour', (q) => q.eq('channelId', channel._id))
        .order('desc')
        .first()
      plan.push({
        channelId: channel._id,
        statisticId: channel.externalRef,
        ...ref,
        // The stored hour is read again, as the baseline. A new channel
        // starts at the hour it was added.
        from:
          last?.hourStart ??
          Math.floor(channel._creationTime / HOUR_MS) * HOUR_MS - HOUR_MS,
      })
    }
    return { secret: source.secret, channels: plan }
  },
})

const problemValidator = v.union(
  v.null(),
  v.literal('enelogicRevoked'),
  v.literal('enelogicUnreachable'),
  v.literal('enelogicMissing'),
  v.literal('syncFailed'),
)

/**
 * Record how a sync ended. `lastSyncedAt` moves only when every channel was
 * read, so a source in error keeps saying when its data is from (ADR-0020).
 */
export const finishSync = internalMutation({
  args: {
    sourceId: v.id('energySources'),
    problem: problemValidator,
    missing: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId)
    if (!source?.secret) return null
    if (args.problem === null) {
      await ctx.db.patch(source._id, {
        status: 'ok',
        lastSyncedAt: Date.now(),
        lastError: undefined,
      })
    } else {
      await ctx.db.patch(source._id, {
        // A refused grant waits for an admin to sign in again.
        status: args.problem === 'enelogicRevoked' ? 'needsReconnect' : 'error',
        lastError: energySourceProblemValue(args.problem, args.missing),
      })
    }
    return null
  },
})

// -- Reading -----------------------------------------------------------------------

/**
 * Read one source's new hours: per measuring point, from the oldest channel's
 * last stored hour (or `historyFrom`) up to now, a month per question.
 */
export const syncSource = internalAction({
  args: {
    sourceId: v.id('energySources'),
    historyFrom: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const plan = await ctx.runQuery(internal.energyEnelogic.planSync, {
      sourceId: args.sourceId,
    })
    if (!plan) return null
    const finish = (
      problem: Infer<typeof problemValidator>,
      missing: string[] = [],
    ) =>
      ctx.runMutation(internal.energyEnelogic.finishSync, {
        sourceId: args.sourceId,
        problem,
        missing,
      })
    if (plan.channels.length === 0) {
      await finish(null)
      return null
    }
    try {
      const access = await accessFor(ctx, args.sourceId, plan.secret)
      if (access === null) return null
      const now = Date.now()
      const missing: string[] = []
      const points = new Map<number, Plan['channels']>()
      for (const channel of plan.channels) {
        const from =
          args.historyFrom === undefined
            ? channel.from
            : Math.min(channel.from, args.historyFrom - HOUR_MS)
        const list = points.get(channel.pointId) ?? []
        list.push({ ...channel, from })
        points.set(channel.pointId, list)
      }
      for (const [pointId, channels] of points) {
        const stored = await readPoint(ctx, {
          sourceId: args.sourceId,
          pointId,
          channels,
          access,
          now,
        })
        if (stored === 'stop') return null
        if (stored === 'missing') {
          missing.push(...channels.map((each) => each.statisticId))
        }
      }
      await finish(missing.length > 0 ? 'enelogicMissing' : null, missing)
    } catch (error) {
      if (error instanceof EnelogicError) {
        await finish(
          error.problem === 'revoked' ? 'enelogicRevoked' : 'enelogicUnreachable',
        )
        return null
      }
      // Not Enelogic's doing: a failed write. Convex reports it, and the next
      // sync starts again from the last stored hour.
      await finish('syncFailed')
      throw error
    }
    return null
  },
})

/** Read one point's channels a window at a time, writing as it goes. */
async function readPoint(
  ctx: ActionCtx,
  args: {
    sourceId: Id<'energySources'>
    pointId: number
    channels: Plan['channels']
    access: string
    now: number
  },
): Promise<'stored' | 'missing' | 'stop'> {
  const baselines = new Map<string, number | null>(
    args.channels.map((each) => [each.statisticId, null]),
  )
  let from = Math.min(...args.channels.map((each) => each.from))
  while (from < args.now) {
    const to = Math.min(args.now, from + WINDOW_DAYS * DAY_MS)
    let readings: EnelogicReading[]
    try {
      readings = readEnelogicReadings(
        await apiGet(
          `/measuringpoints/${args.pointId}/datapoints/${enelogicDay(from, TIME_ZONE)}/${enelogicDay(to + DAY_MS, TIME_ZONE)}`,
          args.access,
        ),
        TIME_ZONE,
      )
    } catch (error) {
      if (error instanceof EnelogicError && error.problem === 'missing') {
        return 'missing'
      }
      throw error
    }
    const batches: {
      channelId: Id<'energyChannels'>
      statisticId: string
      hours: { hourStart: number; amount: number }[]
    }[] = []
    for (const channel of args.channels) {
      const hours = enelogicHours(readings, channel.rate).filter(
        // A window asks from the start of its first day: what an earlier
        // window read is left out.
        (each) =>
          each.hourStart >= Math.max(channel.from, from) && each.hourStart < to,
      )
      const read = hourlyAmountsFromSums(
        hours,
        baselines.get(channel.statisticId) ?? null,
      )
      baselines.set(channel.statisticId, read.baseline)
      for (let at = 0; at < read.amounts.length; at += ROWS_PER_WRITE) {
        batches.push({
          channelId: channel.channelId,
          statisticId: channel.statisticId,
          hours: read.amounts.slice(at, at + ROWS_PER_WRITE),
        })
      }
    }
    for (const batch of batches) {
      const stored = await pacedWrite(batch.hours.length, () =>
        ctx.runMutation(internal.energySources.storeIntervals, {
          sourceId: args.sourceId,
          batches: [batch],
        }),
      )
      if (stored === 'stop') return 'stop'
    }
    from = to
  }
  return 'stored'
}
