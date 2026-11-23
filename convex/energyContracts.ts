/**
 * Energy contracts (APP-494): what a site's energy costs from a date on.
 *
 * New tariffs are a new contract from the day they start, so the months
 * before keep counting with their own. The latest contract can be edited;
 * earlier ones are shown read-only. Amounts are excl. VAT as on the
 * contract; money totals are cents, prices per kWh or m³ euros.
 *
 * Group-scoped like every Energy function (ADR-0031).
 */
import { checkEnergyContract } from '@gather/core/energy'
import { energyRefusal } from '@gather/core/refusals'
import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { energyContractTermsValidator } from './lib/energy'
import { primarySiteOf } from './lib/energyUsage'
import { requireGroupBySlug } from './lib/groupAccess'

const SUPPLIER_LIMIT = 60

/** The site's contracts, newest first. `null` while the Group has no address. */
export const list = query({
  args: { groupSlug: v.string() },
  returns: v.union(
    v.null(),
    v.array(
      v.object({
        _id: v.id('energyContracts'),
        terms: energyContractTermsValidator,
      }),
    ),
  ),
  handler: async (ctx, args) => {
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    const site = await primarySiteOf(ctx, group._id)
    if (!site) return null
    const contracts = await ctx.db
      .query('energyContracts')
      .withIndex('by_site_validFrom', (q) => q.eq('siteId', site._id))
      .order('desc')
      .collect()
    return contracts.map(
      ({ _id, _creationTime, groupId, siteId, ...terms }) => ({ _id, terms }),
    )
  },
})

/**
 * Save a contract: the latest one edited in place (`contractId`), or a new
 * one from its own `validFrom`. Two contracts never start on the same day,
 * and only the latest may change, because earlier months count with theirs.
 */
export const save = mutation({
  args: {
    groupSlug: v.string(),
    contractId: v.optional(v.id('energyContracts')),
    terms: energyContractTermsValidator,
  },
  returns: v.id('energyContracts'),
  handler: async (ctx, args) => {
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    const site = await primarySiteOf(ctx, group._id)
    if (!site) throw new ConvexError(energyRefusal('notFound'))
    const supplierName = args.terms.supplierName?.trim().slice(0, SUPPLIER_LIMIT)
    const terms = {
      ...args.terms,
      supplierName: supplierName || undefined,
      fixedTariffs: args.terms.kind === 'fixed' ? args.terms.fixedTariffs : undefined,
      monthlyFixedCents: Math.round(args.terms.monthlyFixedCents),
      yearlyTaxCreditCents:
        args.terms.yearlyTaxCreditCents === undefined
          ? undefined
          : Math.round(args.terms.yearlyTaxCreditCents),
    }
    if (checkEnergyContract(terms)) {
      throw new ConvexError(energyRefusal('contractInvalid'))
    }
    const contracts = await ctx.db
      .query('energyContracts')
      .withIndex('by_site_validFrom', (q) => q.eq('siteId', site._id))
      .collect()
    const others = contracts.filter((each) => each._id !== args.contractId)
    if (others.some((each) => each.validFrom === terms.validFrom)) {
      throw new ConvexError(energyRefusal('contractDateTaken'))
    }
    if (args.contractId) {
      const current = contracts.find((each) => each._id === args.contractId)
      const latest = others.every((each) => each.validFrom < (current?.validFrom ?? ''))
      // Only the latest contract is edited, and it stays the latest.
      if (
        !current ||
        !latest ||
        others.some((each) => each.validFrom > terms.validFrom)
      ) {
        throw new ConvexError(energyRefusal('notFound'))
      }
      await ctx.db.patch(current._id, terms)
      return current._id
    }
    return ctx.db.insert('energyContracts', {
      groupId: group._id,
      siteId: site._id,
      ...terms,
    })
  },
})
