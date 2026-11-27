import { energyChannelCovered, energyChannelsOverlap } from '@gather/core/energy'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'

/** The channels in use of a site's connected sources (Home Assistant, Enelogic). */
export async function connectedChannels(
  ctx: QueryCtx,
  siteId: Id<'energySites'>,
) {
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
  const connected = new Set(
    sources
      .filter((each) => each.kind !== 'manual' && each.secret)
      .map((each) => each._id),
  )
  return channels.filter(
    (each) => connected.has(each.sourceId) && each.retiredAt === undefined,
  )
}

/**
 * Each channel comes from one source (APP-495): a typed meter that
 * connected Home Assistant channels measure whole is retired, so the readings
 * form stops asking for it, and comes back once nothing else measures it.
 * Its readings stay either way. Nothing else retires a typed meter today; a
 * meter swap that does must tell the two apart.
 */
export async function reconcileManualChannels(
  ctx: MutationCtx,
  siteId: Id<'energySites'>,
) {
  const [sources, channels, measured] = await Promise.all([
    ctx.db
      .query('energySources')
      .withIndex('by_site', (q) => q.eq('siteId', siteId))
      .collect(),
    ctx.db
      .query('energyChannels')
      .withIndex('by_site', (q) => q.eq('siteId', siteId))
      .collect(),
    connectedChannels(ctx, siteId),
  ])
  const manual = new Set(
    sources.filter((each) => each.kind === 'manual').map((each) => each._id),
  )
  const active: Doc<'energyChannels'>[] = []
  // Newest first, so of two retired meters the newer one comes back.
  const typed = channels
    .filter((each) => manual.has(each.sourceId))
    .sort(
      (a, b) =>
        Number(a.retiredAt !== undefined) - Number(b.retiredAt !== undefined) ||
        b._creationTime - a._creationTime,
    )
  for (const channel of typed) {
    const covered = energyChannelCovered(channel, measured)
    if (covered) {
      if (channel.retiredAt === undefined) {
        await ctx.db.patch(channel._id, { retiredAt: Date.now() })
      }
      continue
    }
    if (channel.retiredAt !== undefined) {
      if (active.some((each) => energyChannelsOverlap(each, channel))) continue
      await ctx.db.patch(channel._id, { retiredAt: undefined })
    }
    active.push(channel)
  }
}
