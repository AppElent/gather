import type { BarcodeFormat, FormatConfidence } from '@gather/core/barcodes'
import {
  compareLoyaltyCards,
  LOYALTY_CARD_LIMITS,
  type RetailerCategory,
  searchRetailers,
} from '@gather/core/loyalty-cards'
import { loyaltyCardRefusal } from '@gather/core/refusals'
import { ConvexError, v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'
import { mutation, query } from './_generated/server'
import { findInGroup, requireGroupBySlug } from './lib/groupAccess'
import {
  barcodeFormatValidator,
  checkedBrandColor,
  checkedCardNumber,
  checkedOptionalText,
  checkedStoreName,
} from './lib/loyaltyCards'
import { getCurrentUser } from './lib/sharing'
import {
  deleteStoredFile,
  replaceStoredFile,
  signedInUploadUrl,
} from './lib/storedFiles'

/**
 * Loyalty cards: a Group's store cards (APP-140, APP-141).
 *
 * Every card function is Group-scoped and authorises through the Group the
 * caller names (ADR-0031). A card in another Group and a card that does not
 * exist answer alike (ADR-0009): reads return null, `update` refuses with
 * `loyalty:notFound`, and `remove` and `markUsed` return quietly, because
 * deleting or showing a card that has gone lands where the caller wanted.
 *
 * The Retailer catalog is a picker (ADR-0043): `create` copies a retailer's
 * name, colour and domain onto the card, and nothing reads the Catalog row
 * for that card again.
 */

// ---------------------------------------------------------------------------
// Shapes the client reads
// ---------------------------------------------------------------------------

export interface LoyaltyCardSummary {
  _id: Id<'loyaltyCards'>
  storeName: string
  catalogKey?: string
  brandColor?: string
  domain?: string
  cardNumber: string
  barcodeFormat: BarcodeFormat
  holder?: string
  note?: string
  lastUsedAt?: number
  hasPhotos: boolean
}

export interface LoyaltyCardDetail extends LoyaltyCardSummary {
  frontPhotoId?: Id<'_storage'>
  backPhotoId?: Id<'_storage'>
  frontPhotoUrl: string | null
  backPhotoUrl: string | null
}

export interface RetailerSuggestion {
  seedKey: string
  name: string
  aliases: string[]
  category: RetailerCategory
  brandColor: string
  domain: string
  barcodeFormat: BarcodeFormat
  formatConfidence: FormatConfidence
  numberLength?: number
  numberPrefix?: string
}

function summarize(card: Doc<'loyaltyCards'>): LoyaltyCardSummary {
  return {
    _id: card._id,
    storeName: card.storeName,
    catalogKey: card.catalogKey,
    brandColor: card.brandColor,
    domain: card.domain,
    cardNumber: card.cardNumber,
    barcodeFormat: card.barcodeFormat,
    holder: card.holder,
    note: card.note,
    lastUsedAt: card.lastUsedAt,
    hasPhotos: Boolean(card.frontPhotoId || card.backPhotoId),
  }
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/** The Group's cards, last used first, then by name. */
export const list = query({
  args: { groupSlug: v.string() },
  handler: async (ctx, args): Promise<LoyaltyCardSummary[]> => {
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    const cards = await ctx.db
      .query('loyaltyCards')
      .withIndex('by_group', (q) => q.eq('groupId', group._id))
      .collect()
    return cards.map(summarize).sort(compareLoyaltyCards)
  },
})

/** One card with its photos, or null for a card this Group does not have. */
export const get = query({
  args: { groupSlug: v.string(), id: v.id('loyaltyCards') },
  handler: async (ctx, args): Promise<LoyaltyCardDetail | null> => {
    const found = await findInGroup(ctx, args.groupSlug, args.id)
    if (!found) return null
    const card = found.doc
    return {
      ...summarize(card),
      frontPhotoId: card.frontPhotoId,
      backPhotoId: card.backPhotoId,
      frontPhotoUrl: card.frontPhotoId
        ? await ctx.storage.getUrl(card.frontPhotoId)
        : null,
      backPhotoUrl: card.backPhotoId
        ? await ctx.storage.getUrl(card.backPhotoId)
        : null,
    }
  },
})

/** Every Catalog row, as the picker reads it. ~100 rows, read whole. */
async function catalogRows(ctx: QueryCtx): Promise<RetailerSuggestion[]> {
  const rows = await ctx.db.query('retailerCatalog').collect()
  return rows.map((row) => ({
    seedKey: row.seedKey,
    name: row.name,
    aliases: row.aliases,
    category: row.category,
    brandColor: row.brandColor,
    domain: row.domain,
    barcodeFormat: row.barcodeFormat,
    formatConfidence: row.formatConfidence,
    numberLength: row.numberLength,
    numberPrefix: row.numberPrefix,
  }))
}

/**
 * Search the Retailer catalog by name and aliases, ignoring case and accents.
 *
 * Signed-in only and not Group-scoped: the Catalog is the same for everyone.
 * An empty query lists every retailer by name, which is the picker's opening
 * state. Uncached, like the tasting Catalog (ADR-0024).
 */
export const searchCatalog = query({
  args: { query: v.string() },
  handler: async (ctx, args): Promise<RetailerSuggestion[]> => {
    const user = await getCurrentUser(ctx)
    if (!user) return []
    return searchRetailers(await catalogRows(ctx), args.query)
  },
})

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

export const generateUploadUrl = mutation({
  args: {},
  handler: signedInUploadUrl,
})

/**
 * Add a card, picked from the Catalog or typed as "Other store".
 *
 * With a `catalogKey`, the retailer's colour and domain are copied from the
 * Catalog row, not trusted from the client; the store name and barcode format
 * arrive from the form, which prefilled them from the same row and lets the
 * person correct either. Without one, the colour is whatever the form chose.
 */
export const create = mutation({
  args: {
    groupSlug: v.string(),
    catalogKey: v.optional(v.string()),
    storeName: v.string(),
    brandColor: v.optional(v.string()),
    cardNumber: v.string(),
    barcodeFormat: barcodeFormatValidator,
    holder: v.optional(v.string()),
    note: v.optional(v.string()),
    frontPhotoId: v.optional(v.id('_storage')),
    backPhotoId: v.optional(v.id('_storage')),
  },
  handler: async (ctx, args): Promise<Id<'loyaltyCards'>> => {
    const { group, user } = await requireGroupBySlug(ctx, args.groupSlug)

    let brandColor = checkedBrandColor(args.brandColor)
    let domain: string | undefined
    if (args.catalogKey) {
      const retailer = await ctx.db
        .query('retailerCatalog')
        .withIndex('by_seedKey', (q) =>
          q.eq('seedKey', args.catalogKey as string),
        )
        .first()
      if (!retailer) {
        throw new ConvexError(loyaltyCardRefusal('unknownRetailer'))
      }
      brandColor = retailer.brandColor.toLowerCase()
      domain = retailer.domain
    }

    return await ctx.db.insert('loyaltyCards', {
      groupId: group._id,
      storeName: checkedStoreName(args.storeName),
      catalogKey: args.catalogKey,
      brandColor,
      domain,
      cardNumber: checkedCardNumber(args.barcodeFormat, args.cardNumber),
      barcodeFormat: args.barcodeFormat,
      holder: checkedOptionalText(args.holder, LOYALTY_CARD_LIMITS.holder),
      note: checkedOptionalText(args.note, LOYALTY_CARD_LIMITS.note),
      frontPhotoId: args.frontPhotoId,
      backPhotoId: args.backPhotoId,
      createdByUserId: user._id,
    })
  },
})

const photoChange = v.optional(v.union(v.id('_storage'), v.null()))

/**
 * Correct a card. Any Member may: the card is the Group's.
 *
 * `catalogKey` and `domain` are never touched — they are Provenance. The
 * colour may change, so a household can recolour a custom store. For each
 * photo, absent leaves it alone and `null` takes it off.
 */
export const update = mutation({
  args: {
    groupSlug: v.string(),
    id: v.id('loyaltyCards'),
    storeName: v.string(),
    brandColor: v.optional(v.string()),
    cardNumber: v.string(),
    barcodeFormat: barcodeFormatValidator,
    holder: v.optional(v.string()),
    note: v.optional(v.string()),
    frontPhotoId: photoChange,
    backPhotoId: photoChange,
  },
  handler: async (ctx, args) => {
    const found = await findInGroup(ctx, args.groupSlug, args.id)
    if (!found) throw new ConvexError(loyaltyCardRefusal('notFound'))
    const card = found.doc
    const { frontPhotoId, backPhotoId } = args

    await ctx.db.patch(card._id, {
      storeName: checkedStoreName(args.storeName),
      brandColor: checkedBrandColor(args.brandColor) ?? card.brandColor,
      cardNumber: checkedCardNumber(args.barcodeFormat, args.cardNumber),
      barcodeFormat: args.barcodeFormat,
      holder: checkedOptionalText(args.holder, LOYALTY_CARD_LIMITS.holder),
      note: checkedOptionalText(args.note, LOYALTY_CARD_LIMITS.note),
      ...(frontPhotoId !== undefined
        ? { frontPhotoId: frontPhotoId ?? undefined }
        : {}),
      ...(backPhotoId !== undefined
        ? { backPhotoId: backPhotoId ?? undefined }
        : {}),
    })
    // After the row has let go of the old blobs, behind the access check.
    await replaceStoredFile(ctx, card.frontPhotoId, frontPhotoId)
    await replaceStoredFile(ctx, card.backPhotoId, backPhotoId)
  },
})

/** Delete a card and its photos. A card already gone is not an error. */
export const remove = mutation({
  args: { groupSlug: v.string(), id: v.id('loyaltyCards') },
  handler: async (ctx, args) => {
    const found = await findInGroup(ctx, args.groupSlug, args.id)
    if (!found) return
    const card = found.doc
    await ctx.db.delete(card._id)
    await deleteStoredFile(ctx, card.frontPhotoId)
    await deleteStoredFile(ctx, card.backPhotoId)
  },
})

/**
 * The card was shown at a till: it moves to the top of the list.
 *
 * Quiet for a card that has gone, since nothing is left to sort.
 */
export const markUsed = mutation({
  args: { groupSlug: v.string(), id: v.id('loyaltyCards') },
  handler: async (ctx, args) => {
    const found = await findInGroup(ctx, args.groupSlug, args.id)
    if (!found) return
    await ctx.db.patch(found.doc._id, { lastUsedAt: Date.now() })
  },
})
