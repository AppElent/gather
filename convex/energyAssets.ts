/**
 * A site's solar panels and home batteries (APP-496): what they are, since
 * when and for how much, so payback can be counted for those with a price.
 *
 * Group-scoped like every Energy function (ADR-0031). `today` is the caller's
 * Amsterdam day.
 */
import { isIsoDate } from '@gather/core/civil-date'
import { checkEnergyAsset, ENERGY_ASSET_LIMITS } from '@gather/core/energy'
import { energyRefusal } from '@gather/core/refusals'
import { ConvexError, v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import { type MutationCtx, mutation } from './_generated/server'
import { energyAssetTermsValidator } from './lib/energy'
import { primarySiteOf, siteAssets } from './lib/energyUsage'
import { requireGroupBySlug } from './lib/groupAccess'

async function siteOf(ctx: MutationCtx, groupSlug: string) {
  const { group } = await requireGroupBySlug(ctx, groupSlug)
  const site = await primarySiteOf(ctx, group._id)
  if (!site) throw new ConvexError(energyRefusal('notFound'))
  return site
}

/** The asset when it is this site's, else a refusal. */
async function ownAsset(
  ctx: MutationCtx,
  site: Doc<'energySites'>,
  assetId: Id<'energyAssets'>,
) {
  const asset = await ctx.db.get(assetId)
  if (!asset || asset.siteId !== site._id) {
    throw new ConvexError(energyRefusal('notFound'))
  }
  return asset
}

/** Add panels or a battery, or change one (`assetId`). */
export const save = mutation({
  args: {
    groupSlug: v.string(),
    assetId: v.optional(v.id('energyAssets')),
    asset: energyAssetTermsValidator,
    today: v.string(),
  },
  returns: v.id('energyAssets'),
  handler: async (ctx, args) => {
    const site = await siteOf(ctx, args.groupSlug)
    if (!isIsoDate(args.today)) throw new ConvexError(energyRefusal('notFound'))
    const checked = checkEnergyAsset(args.asset, args.today)
    if ('problem' in checked) {
      throw new ConvexError(energyRefusal(checked.problem))
    }
    if (args.assetId) {
      const asset = await ownAsset(ctx, site, args.assetId)
      await ctx.db.patch(asset._id, checked.asset)
      return asset._id
    }
    const assets = await siteAssets(ctx, site._id)
    if (assets.length >= ENERGY_ASSET_LIMITS.perSite) {
      throw new ConvexError(energyRefusal('tooManyAssets'))
    }
    return ctx.db.insert('energyAssets', {
      groupId: site.groupId,
      siteId: site._id,
      ...checked.asset,
    })
  },
})

/** Remove panels or a battery. What was measured stays with its channels. */
export const remove = mutation({
  args: { groupSlug: v.string(), assetId: v.id('energyAssets') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const site = await siteOf(ctx, args.groupSlug)
    const asset = await ownAsset(ctx, site, args.assetId)
    const channels = await ctx.db
      .query('energyChannels')
      .withIndex('by_site', (q) => q.eq('siteId', site._id))
      .collect()
    await Promise.all(
      channels
        .filter((channel) => channel.assetId === asset._id)
        .map((channel) => ctx.db.patch(channel._id, { assetId: undefined })),
    )
    await ctx.db.delete(asset._id)
    return null
  },
})
