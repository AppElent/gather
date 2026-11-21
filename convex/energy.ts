/**
 * Energy: what a Group's home uses, produces and pays (APP-491, ADR-0051).
 *
 * Only the Module's shell so far (APP-492): the Group's address and the
 * source it starts with. Prices, contracts, readings and Home Assistant land
 * with APP-493..496 and add their own functions here.
 *
 * Every function is Group-scoped and authorises through the Group the caller
 * names (ADR-0031). A House or site in another Group answers like one that
 * does not exist (ADR-0009). A source's `secret` never leaves this file: the
 * shapes below name every field they return.
 */
import { checkEnergySiteName, primaryEnergySite } from '@gather/core/energy'
import { energyRefusal } from '@gather/core/refusals'
import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  energySourceKindValidator,
  energySourceStatusValidator,
} from './lib/energy'
import { findInGroup, requireGroupBySlug } from './lib/groupAccess'
import { nextOrder } from './lib/order'

/** A source as a Member may see it: never its token. */
const sourceSummaryValidator = v.object({
  _id: v.id('energySources'),
  kind: energySourceKindValidator,
  label: v.string(),
  status: energySourceStatusValidator,
  lastSyncedAt: v.optional(v.number()),
  lastError: v.optional(v.string()),
})

/** Longest label a source is saved with ("Home Assistant thuis"). */
const SOURCE_LABEL_LIMIT = 60

/**
 * The address the Module opens on, with its sources, or `null` while the
 * Group has none, which is the empty Module's cue (ADR-0022).
 */
export const overview = query({
  args: { groupSlug: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      site: v.object({
        _id: v.id('energySites'),
        name: v.string(),
        houseId: v.optional(v.id('houses')),
      }),
      sources: v.array(sourceSummaryValidator),
    }),
  ),
  handler: async (ctx, args) => {
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    const sites = await ctx.db
      .query('energySites')
      .withIndex('by_group', (q) => q.eq('groupId', group._id))
      .collect()
    const site = primaryEnergySite(sites)
    if (!site) return null
    const sources = await ctx.db
      .query('energySources')
      .withIndex('by_site', (q) => q.eq('siteId', site._id))
      .collect()
    return {
      site: { _id: site._id, name: site.name, houseId: site.houseId },
      sources: sources.map((source) => ({
        _id: source._id,
        kind: source.kind,
        label: source.label,
        status: source.status,
        lastSyncedAt: source.lastSyncedAt,
        lastError: source.lastError,
      })),
    }
  },
})

/**
 * Add an address: the empty Module's form. Meter readings are a full source
 * (ADR-0051), so choosing them saves that source at once, labelled in the
 * Member's own language. Home Assistant is only a choice until it is
 * connected (APP-495): nothing is saved for it, because a source without a
 * connection would read as one.
 */
export const createSite = mutation({
  args: {
    groupSlug: v.string(),
    name: v.string(),
    houseId: v.optional(v.id('houses')),
    source: v.union(
      v.object({ kind: v.literal('homeAssistant') }),
      v.object({ kind: v.literal('manual'), label: v.string() }),
    ),
  },
  returns: v.id('energySites'),
  handler: async (ctx, args) => {
    const { user, group } = await requireGroupBySlug(ctx, args.groupSlug)
    const checked = checkEnergySiteName(args.name)
    if ('problem' in checked) {
      throw new ConvexError(energyRefusal(checked.problem))
    }
    if (
      args.houseId &&
      !(await findInGroup(ctx, args.groupSlug, args.houseId))
    ) {
      throw new ConvexError(energyRefusal('houseNotFound'))
    }

    // The screen always sends its own word for the source; only another
    // client could send none, and the source would have no name to show.
    const manualLabel =
      args.source.kind === 'manual'
        ? args.source.label.trim().slice(0, SOURCE_LABEL_LIMIT)
        : ''
    if (args.source.kind === 'manual' && !manualLabel) {
      throw new ConvexError(energyRefusal('needsName'))
    }

    const sites = await ctx.db
      .query('energySites')
      .withIndex('by_group', (q) => q.eq('groupId', group._id))
      .collect()
    const siteId = await ctx.db.insert('energySites', {
      groupId: group._id,
      name: checked.name,
      houseId: args.houseId,
      createdByUserId: user._id,
      order: nextOrder(sites),
    })

    if (args.source.kind === 'manual') {
      await ctx.db.insert('energySources', {
        groupId: group._id,
        siteId,
        kind: 'manual',
        label: manualLabel,
        status: 'ok',
        connectedByUserId: user._id,
      })
    }
    return siteId
  },
})
