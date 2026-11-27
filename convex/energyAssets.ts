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
import { linkChannelsToAssets } from './lib/energyAssetLinks'
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
    let assetId = args.assetId
    if (assetId) {
      const asset = await ownAsset(ctx, site, assetId)
      await ctx.db.patch(asset._id, checked.asset)
    } else {
      const assets = await siteAssets(ctx, site._id)
      if (assets.length >= ENERGY_ASSET_LIMITS.perSite) {
        throw new ConvexError(energyRefusal('tooManyAssets'))
      }
      assetId = await ctx.db.insert('energyAssets', {
        groupId: site.groupId,
        siteId: site._id,
        ...checked.asset,
      })
    }
    await linkChannelsToAssets(ctx, site._id)
    return assetId
  },
})

/**
 * Remove panels or a battery. What was measured stays with its channels,
 * which move to the one asset of that kind left, if there is one.
 */
export const remove = mutation({
  args: { groupSlug: v.string(), assetId: v.id('energyAssets') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const site = await siteOf(ctx, args.groupSlug)
    const asset = await ownAsset(ctx, site, args.assetId)
    await ctx.db.delete(asset._id)
    await linkChannelsToAssets(ctx, site._id)
    return null
  },
})
