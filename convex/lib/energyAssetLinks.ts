/**
 * Which panels or battery a channel measures (`energyChannels.assetId`,
 * APP-922). A site with one asset of a kind ties every channel of that kind
 * to it. With two or more nobody has said which channel is whose, so channels
 * keep the asset they have and a new one stays untied.
 */
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'

const ASSET_KIND: Partial<
  Record<Doc<'energyChannels'>['kind'], Doc<'energyAssets'>['kind']>
> = {
  solar: 'solar',
  batteryCharge: 'battery',
  batteryDischarge: 'battery',
  batterySoc: 'battery',
}

/** Tie a site's channels to its assets. Call it after either changes. */
export async function linkChannelsToAssets(
  ctx: MutationCtx,
  siteId: Id<'energySites'>,
) {
  const [assets, channels] = await Promise.all([
    ctx.db
      .query('energyAssets')
      .withIndex('by_site', (q) => q.eq('siteId', siteId))
      .collect(),
    ctx.db
      .query('energyChannels')
      .withIndex('by_site', (q) => q.eq('siteId', siteId))
      .collect(),
  ])
  await Promise.all(
    channels.map((channel) => {
      const kind = ASSET_KIND[channel.kind]
      const ofKind = assets.filter((asset) => asset.kind === kind)
      const own = ofKind.find((asset) => asset._id === channel.assetId)
      const assetId = own?._id ?? (ofKind.length === 1 ? ofKind[0]?._id : undefined)
      return assetId === channel.assetId
        ? null
        : ctx.db.patch(channel._id, { assetId })
    }),
  )
}
