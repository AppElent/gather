/**
 * Reading `energyPrices` (APP-493). A row is a market price, the same for
 * every Group, or one feed's account price. Only account providers write
 * account rows (`energyPriceScope`, checked by `energyPrices.storeDay`), so a
 * read of a market provider through `by_provider_carrier_start` holds market
 * rows alone.
 */
import type { EnergyPriceProvider } from '@gather/core/energy'
import type { Id } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'

/** Providers whose rows belong to no Group. */
export type MarketPriceProvider = Exclude<EnergyPriceProvider, 'tibber'>

export async function marketPrices(
  ctx: QueryCtx,
  provider: MarketPriceProvider,
  carrier: 'electricity' | 'gas',
  start: number,
  end: number,
) {
  return ctx.db
    .query('energyPrices')
    .withIndex('by_provider_carrier_start', (q) =>
      q
        .eq('provider', provider)
        .eq('carrier', carrier)
        .gte('start', start)
        .lt('start', end),
    )
    .collect()
}

export async function accountPrices(
  ctx: QueryCtx,
  feedId: Id<'energyPriceFeeds'>,
  start: number,
  end: number,
) {
  return ctx.db
    .query('energyPrices')
    .withIndex('by_feed_carrier_start', (q) =>
      q
        .eq('feedId', feedId)
        .eq('carrier', 'electricity')
        .gte('start', start)
        .lt('start', end),
    )
    .collect()
}

/** The first day an account feed priced, if it ever did. */
export async function firstAccountPrice(
  ctx: QueryCtx,
  feedId: Id<'energyPriceFeeds'>,
) {
  return ctx.db
    .query('energyPrices')
    .withIndex('by_feed_carrier_start', (q) =>
      q.eq('feedId', feedId).eq('carrier', 'electricity'),
    )
    .first()
}

/** Every price source a site has had: the newest is the one in use. */
export async function priceFeedsOf(ctx: QueryCtx, siteId: Id<'energySites'>) {
  return ctx.db
    .query('energyPriceFeeds')
    .withIndex('by_site', (q) => q.eq('siteId', siteId))
    .order('desc')
    .collect()
}

/** A site's price source; a site without one is priced by EnergyZero. */
export async function priceFeedOf(ctx: QueryCtx, siteId: Id<'energySites'>) {
  return ctx.db
    .query('energyPriceFeeds')
    .withIndex('by_site', (q) => q.eq('siteId', siteId))
    .order('desc')
    .first()
}
