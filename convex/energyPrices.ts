/**
 * Energy prices (APP-493): what a kWh costs per hour, and where that comes
 * from. The actions that talk to a provider are in `energyPriceFetch.ts`;
 * everything they read or write goes through the internal functions here.
 *
 * Any Member sees the prices and the price source. Only an admin sets one.
 * The key (`energyPriceFeeds.secret`) is returned by internal functions only,
 * to the action that sends it to its own provider.
 */
import { addDays, isIsoDate } from '@gather/core/civil-date'
import {
  amsterdamDayOf,
  amsterdamDayStart,
  checkEnergyPriceKey,
  completeElectricityDay,
  completeGasDay,
  DEFAULT_ENERGY_PRICE_PROVIDER,
  type EnergyPriceProvider,
  type EnergyPriceSlot,
  energyContractOn,
  energyDayQuarters,
  energyImportPrice,
  energyPriceHours,
  energyPriceNeedsKey,
  energyPriceScope,
  netMeteringOn,
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
  energyCarrierValidator,
  energyPriceFeedStatusValidator,
  energyPriceProviderValidator,
} from './lib/energy'
import {
  accountPrices,
  type MarketPriceProvider,
  marketPrices,
  priceFeedOf,
} from './lib/energyPriceRows'
import { primarySiteOf } from './lib/energyUsage'
import { requireGroupBySlug } from './lib/groupAccess'

/** Feeds handled per step, and the pause between two account fetches. */
const FEEDS_PER_STEP = 100
const FETCH_STAGGER_MS = 500
/** Keys one run tries before it waits for the next. */
const KEYS_PER_RUN = 10

const problemValidator = v.union(
  v.literal('unreachable'),
  v.literal('badAnswer'),
  v.literal('keyRejected'),
  v.literal('noSubscription'),
  v.literal('late'),
)

const marketProviderValidator = v.union(
  v.literal('energyzero'),
  v.literal('entsoe'),
)

const slotValidator = v.object({
  start: v.number(),
  minutes: v.number(),
  eurPerUnit: v.number(),
})

// -- What the screens read ----------------------------------------------------------

const priceDayValidator = v.object({
  day: v.string(),
  /** Whose prices these are: EnergyZero's while another market one has none. */
  provider: energyPriceProviderValidator,
  /** `market`: no dynamic contract that day, so a price excl. VAT and taxes. */
  basis: v.union(v.literal('allIn'), v.literal('market')),
  /** The contract's parts of an all-in price; null for account prices. */
  terms: v.union(
    v.null(),
    v.object({
      supplierName: v.union(v.string(), v.null()),
      importMarkupEurPerKwh: v.number(),
      energyTaxEurPerKwh: v.number(),
      vatPercent: v.number(),
    }),
  ),
  /** Null without a dynamic contract, or while net metering still nets it. */
  exportFeeEurPerKwh: v.union(v.number(), v.null()),
  hours: v.array(
    v.object({
      start: v.number(),
      price: v.number(),
      market: v.union(v.number(), v.null()),
    }),
  ),
})

/**
 * The address's prices on `day` (the reader's today) and the day after, or
 * null while there is no address. A day that is not complete is null.
 */
export const view = query({
  args: { groupSlug: v.string(), day: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      siteName: v.string(),
      /** Whether the caller may set the price source. */
      canManage: v.boolean(),
      provider: energyPriceProviderValidator,
      /** Whether a key is stored. The key itself is never returned. */
      hasKey: v.boolean(),
      status: energyPriceFeedStatusValidator,
      /** A code (`EnergyPriceProblem`). */
      lastError: v.union(v.string(), v.null()),
      lastFetchedAt: v.union(v.number(), v.null()),
      contract: v.union(
        v.null(),
        v.object({
          kind: v.union(v.literal('dynamic'), v.literal('fixed')),
          supplierName: v.union(v.string(), v.null()),
        }),
      ),
      today: v.union(priceDayValidator, v.null()),
      tomorrow: v.union(priceDayValidator, v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    const { group, role } = await requireGroupBySlug(ctx, args.groupSlug)
    const site = await primarySiteOf(ctx, group._id)
    if (!site || !isIsoDate(args.day)) return null
    const [feed, contracts] = await Promise.all([
      priceFeedOf(ctx, site._id),
      ctx.db
        .query('energyContracts')
        .withIndex('by_site_validFrom', (q) => q.eq('siteId', site._id))
        .collect(),
    ])
    const provider = feed?.provider ?? DEFAULT_ENERGY_PRICE_PROVIDER
    const contract = energyContractOn(contracts, args.day)
    const [today, tomorrow] = await Promise.all([
      priceDay(ctx, feed, contracts, args.day),
      priceDay(ctx, feed, contracts, addDays(args.day, 1)),
    ])
    // EnergyZero has no key, so nothing about it is a site's own: when it
    // last gave prices is when the newest of them was stored.
    const own = feed && feed.provider !== DEFAULT_ENERGY_PRICE_PROVIDER ? feed : null
    const newest = own
      ? null
      : await ctx.db
          .query('energyPrices')
          .withIndex('by_provider_carrier_start', (q) =>
            q
              .eq('provider', DEFAULT_ENERGY_PRICE_PROVIDER)
              .eq('carrier', 'electricity'),
          )
          .order('desc')
          .first()
    return {
      siteName: site.name,
      canManage: role === 'admin',
      provider,
      hasKey: Boolean(own?.secret),
      status: own?.status ?? ('ok' as const),
      lastError: own?.lastError ?? null,
      lastFetchedAt: own ? (own.lastFetchedAt ?? null) : (newest?._creationTime ?? null),
      contract: contract
        ? { kind: contract.kind, supplierName: contract.supplierName ?? null }
        : null,
      today,
      tomorrow,
    }
  },
})

async function priceDay(
  ctx: QueryCtx,
  feed: Doc<'energyPriceFeeds'> | null,
  contracts: readonly Doc<'energyContracts'>[],
  day: string,
) {
  const start = amsterdamDayStart(day)
  const end = amsterdamDayStart(addDays(day, 1))
  const found = energyContractOn(contracts, day)
  const contract = found?.kind === 'dynamic' ? found : undefined
  const market = async (provider: MarketPriceProvider) =>
    energyPriceHours(
      day,
      await marketPrices(ctx, provider, 'electricity', start, end),
    )
  const netted = contract ? netMeteringOn(contract, day) : false
  const exportFeeEurPerKwh =
    contract && !netted ? contract.exportFeeEurPerKwh : null

  if (feed?.scope === 'account') {
    const [own, known] = await Promise.all([
      accountPrices(ctx, feed._id, start, end),
      market(DEFAULT_ENERGY_PRICE_PROVIDER),
    ])
    const hours = energyPriceHours(day, own)
    if (!hours) return null
    return {
      day,
      provider: feed.provider,
      basis: 'allIn' as const,
      terms: null,
      exportFeeEurPerKwh,
      hours: hours.map((hour, index) => ({
        start: hour.start,
        price: hour.eurPerUnit,
        market: known?.[index]?.eurPerUnit ?? null,
      })),
    }
  }

  let provider: MarketPriceProvider =
    feed?.provider === 'entsoe' ? 'entsoe' : DEFAULT_ENERGY_PRICE_PROVIDER
  let hours = await market(provider)
  if (!hours && provider !== DEFAULT_ENERGY_PRICE_PROVIDER) {
    provider = DEFAULT_ENERGY_PRICE_PROVIDER
    hours = await market(provider)
  }
  if (!hours) return null
  return {
    day,
    provider,
    basis: contract ? ('allIn' as const) : ('market' as const),
    terms: contract
      ? {
          supplierName: contract.supplierName ?? null,
          importMarkupEurPerKwh: contract.importMarkupEurPerKwh,
          energyTaxEurPerKwh: contract.energyTaxEurPerKwh,
          vatPercent: contract.vatPercent,
        }
      : null,
    exportFeeEurPerKwh,
    hours: hours.map((hour) => ({
      start: hour.start,
      price: contract
        ? energyImportPrice(hour.eurPerUnit, contract)
        : hour.eurPerUnit,
      market: hour.eurPerUnit,
    })),
  }
}

// -- The price source ---------------------------------------------------------------

/**
 * Set the address's price source. A provider with a key keeps the stored one
 * when none is typed; another provider never gets a key typed for this one.
 */
export const saveFeed = mutation({
  args: {
    groupSlug: v.string(),
    provider: energyPriceProviderValidator,
    /** Left out to keep the stored key of the same provider. */
    key: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Stays in the app (ADR-0046).
    await rejectConnectedApps(ctx)
    const { group, role } = await requireGroupBySlug(ctx, args.groupSlug)
    if (role !== 'admin') throw new ConvexError(energyRefusal('adminOnly'))
    const site = await primarySiteOf(ctx, group._id)
    if (!site) throw new ConvexError(energyRefusal('notFound'))
    const existing = await priceFeedOf(ctx, site._id)
    const current = existing?.provider ?? DEFAULT_ENERGY_PRICE_PROVIDER

    let secret: string | undefined
    if (energyPriceNeedsKey(args.provider)) {
      if (args.key?.trim()) {
        const checked = checkEnergyPriceKey(args.key)
        if (!checked) throw new ConvexError(energyRefusal('priceKeyInvalid'))
        secret = checked
      } else if (current === args.provider && existing?.secret) {
        return null
      } else {
        throw new ConvexError(energyRefusal('priceKeyNeeded'))
      }
    } else if (current === args.provider) {
      return null
    }

    const connection = {
      provider: args.provider,
      scope: energyPriceScope(args.provider),
      secret,
      includesTaxes: energyPriceScope(args.provider) === 'account',
      status: 'ok' as const,
      lastFetchedAt: undefined,
      lastError: undefined,
    }
    let feedId = existing?._id
    if (existing) {
      // What another key gave for today on is not this one's. Days before
      // keep the prices they were paid at.
      if (existing.scope === 'account') {
        const today = amsterdamDayStart(amsterdamDayOf(Date.now()))
        const rows = await accountPrices(
          ctx,
          existing._id,
          today,
          Number.MAX_SAFE_INTEGER,
        )
        for (const row of rows) await ctx.db.delete(row._id)
      }
      await ctx.db.patch(existing._id, connection)
    } else {
      feedId = await ctx.db.insert('energyPriceFeeds', {
        groupId: group._id,
        siteId: site._id,
        ...connection,
      })
    }
    if (secret && feedId) {
      await ctx.scheduler.runAfter(0, internal.energyPriceFetch.fetchFeed, {
        feedId,
        triesLeft: 2,
      })
    }
    return null
  },
})

// -- The daily fetch ------------------------------------------------------------------

/**
 * The daily cron: EnergyZero for everyone, ENTSO-E once for everyone, and
 * each Tibber feed for itself.
 */
export const startFetches = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(0, internal.energyPriceFetch.fetchEnergyZero, {})
    await ctx.scheduler.runAfter(0, internal.energyPriceFetch.fetchEntsoe, {})
    await ctx.scheduler.runAfter(0, internal.energyPrices.startAccountFetches, {})
    return null
  },
})

export const startAccountFetches = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query('energyPriceFeeds')
      .withIndex('by_provider', (q) => q.eq('provider', 'tibber'))
      .paginate({ numItems: FEEDS_PER_STEP, cursor: args.cursor ?? null })
    let started = 0
    for (const feed of page.page) {
      if (!feed.secret || feed.status === 'needsKey') continue
      await ctx.scheduler.runAfter(
        started * FETCH_STAGGER_MS,
        internal.energyPriceFetch.fetchFeed,
        { feedId: feed._id },
      )
      started += 1
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        started * FETCH_STAGGER_MS,
        internal.energyPrices.startAccountFetches,
        { cursor: page.continueCursor },
      )
    }
    return null
  },
})

/** Which of these days a market provider has not given a whole day for. */
export const missingMarketDays = internalQuery({
  args: {
    provider: marketProviderValidator,
    carrier: energyCarrierValidator,
    days: v.array(v.string()),
  },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    const missing: string[] = []
    for (const day of args.days) {
      const rows = await marketPrices(
        ctx,
        args.provider,
        args.carrier,
        amsterdamDayStart(day),
        amsterdamDayStart(addDays(day, 1)),
      )
      const whole = args.carrier === 'gas' ? 1 : energyDayQuarters(day)
      if (rows.length !== whole) missing.push(day)
    }
    return missing
  },
})

type FeedKey = {
  feedId: Id<'energyPriceFeeds'>
  provider: EnergyPriceProvider
  secret: string
}

const usable = (feed: Doc<'energyPriceFeeds'> | null): FeedKey | null =>
  feed?.secret && feed.status !== 'needsKey'
    ? { feedId: feed._id, provider: feed.provider, secret: feed.secret }
    : null

/** One feed's key, or null: gone, without one, or refused until it changes. */
export const feedKey = internalQuery({
  args: { feedId: v.id('energyPriceFeeds') },
  handler: async (ctx, args): Promise<FeedKey | null> =>
    usable(await ctx.db.get(args.feedId)),
})

/** Some keys a market provider can be read with. */
export const marketKeys = internalQuery({
  args: { provider: v.literal('entsoe') },
  handler: async (ctx, args): Promise<FeedKey[]> => {
    const keys: FeedKey[] = []
    const feeds = ctx.db
      .query('energyPriceFeeds')
      .withIndex('by_provider', (q) => q.eq('provider', args.provider))
    for await (const feed of feeds) {
      const key = usable(feed)
      if (key) keys.push(key)
      if (keys.length === KEYS_PER_RUN) break
    }
    return keys
  },
})

/**
 * Store one whole day, or nothing: an incomplete day is refused. Storing the
 * same day again changes only prices that differ. Account prices are stored
 * only while their feed still holds the key they were read with.
 */
export const storeDay = internalMutation({
  args: {
    provider: energyPriceProviderValidator,
    account: v.optional(
      v.object({ feedId: v.id('energyPriceFeeds'), secret: v.string() }),
    ),
    carrier: energyCarrierValidator,
    day: v.string(),
    slots: v.array(slotValidator),
  },
  returns: v.union(
    v.literal('stored'),
    v.literal('incomplete'),
    v.literal('refused'),
  ),
  handler: async (ctx, args) => {
    const { account, provider, carrier, day } = args
    // A row has a feed exactly when its provider's prices are one Member's,
    // which is what lets a market read trust its provider.
    if ((energyPriceScope(provider) === 'account') !== Boolean(account)) {
      return 'refused' as const
    }
    if (carrier === 'gas' && provider !== DEFAULT_ENERGY_PRICE_PROVIDER) {
      return 'refused' as const
    }
    if (account) {
      const feed = await ctx.db.get(account.feedId)
      if (
        !feed ||
        feed.provider !== provider ||
        feed.secret !== account.secret
      ) {
        return 'refused' as const
      }
    }
    const whole =
      carrier === 'gas'
        ? completeGasDay(day, args.slots)
        : completeElectricityDay(day, args.slots)
    if (!whole) return 'incomplete' as const
    await upsert(ctx, { provider, feedId: account?.feedId, carrier, day }, whole)
    return 'stored' as const
  },
})

async function upsert(
  ctx: MutationCtx,
  row: {
    provider: EnergyPriceProvider
    feedId: Id<'energyPriceFeeds'> | undefined
    carrier: 'electricity' | 'gas'
    day: string
  },
  slots: readonly EnergyPriceSlot[],
) {
  const { provider, feedId, carrier, day } = row
  const start = amsterdamDayStart(day)
  const end = amsterdamDayStart(addDays(day, 1))
  const existing = feedId
    ? await accountPrices(ctx, feedId, start, end)
    : await marketPrices(
        ctx,
        provider as MarketPriceProvider,
        carrier,
        start,
        end,
      )
  const byStart = new Map(existing.map((each) => [each.start, each]))
  for (const slot of slots) {
    const known = byStart.get(slot.start)
    if (!known) {
      await ctx.db.insert('energyPrices', {
        provider,
        ...(feedId ? { feedId } : {}),
        carrier,
        ...slot,
      })
    } else if (
      known.eurPerUnit !== slot.eurPerUnit ||
      known.minutes !== slot.minutes
    ) {
      await ctx.db.patch(known._id, {
        eurPerUnit: slot.eurPerUnit,
        minutes: slot.minutes,
      })
    }
  }
}

/** What a fetch came to, for one feed that still holds the key it used. */
export const finishFetch = internalMutation({
  args: {
    feedId: v.id('energyPriceFeeds'),
    secret: v.string(),
    problem: v.union(problemValidator, v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const feed = await ctx.db.get(args.feedId)
    if (!feed || feed.secret !== args.secret) return null
    await ctx.db.patch(feed._id, outcome(args.problem))
    return null
  },
})

/** The same for every feed of a market provider whose key is not refused. */
export const finishMarketFetch = internalMutation({
  args: {
    provider: v.literal('entsoe'),
    problem: v.union(problemValidator, v.null()),
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query('energyPriceFeeds')
      .withIndex('by_provider', (q) => q.eq('provider', args.provider))
      .paginate({ numItems: FEEDS_PER_STEP, cursor: args.cursor ?? null })
    for (const feed of page.page) {
      if (feed.secret && feed.status !== 'needsKey') {
        await ctx.db.patch(feed._id, outcome(args.problem))
      }
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.energyPrices.finishMarketFetch, {
        provider: args.provider,
        problem: args.problem,
        cursor: page.continueCursor,
      })
    }
    return null
  },
})

/** The last good time stays when a fetch fails. */
function outcome(problem: typeof problemValidator.type | null) {
  if (problem === null) {
    return {
      status: 'ok' as const,
      lastError: undefined,
      lastFetchedAt: Date.now(),
    }
  }
  return {
    status:
      problem === 'keyRejected' ? ('needsKey' as const) : ('error' as const),
    lastError: problem,
  }
}
