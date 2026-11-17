/**
 * The cards the auth gate's offline fallback may draw: the saved copy of
 * `loyaltyCards:list` for the account Clerk restored locally, but only when
 * Convex last confirmed that same account on this phone (`lastKnown.ts`).
 *
 * The copy's key (bundle, account, function, arguments) is what makes it the
 * right shape; this only drops entries that could not be drawn at all, so a
 * damaged copy reads as a missing one instead of throwing in render.
 */
import { type BarcodeFormat, isBarcodeFormat } from '@gather/core/barcodes'

import {
  readOfflineEntries,
  readOfflineEntry,
} from '../../../convex/lastKnown'
import { isOfflineReadable } from '../../../convex/queries'

const LIST = 'loyaltyCards:list'

/** What an offline card draws: `DRAWN_CARD_FIELDS` in `convex/queries.ts`. */
export interface OfflineCard {
  _id: string
  storeName: string
  catalogKey?: string
  brandColor?: string
  cardNumber: string
  barcodeFormat: BarcodeFormat
  holder?: string
}

const optionalString = (value: unknown) =>
  value === undefined || typeof value === 'string'

function isOfflineCard(value: unknown): value is OfflineCard {
  if (typeof value !== 'object' || value === null) return false
  const card = value as Record<string, unknown>
  return (
    typeof card._id === 'string' &&
    typeof card.storeName === 'string' &&
    typeof card.cardNumber === 'string' &&
    card.cardNumber.length > 0 &&
    typeof card.barcodeFormat === 'string' &&
    isBarcodeFormat(card.barcodeFormat) &&
    optionalString(card.catalogKey) &&
    optionalString(card.brandColor) &&
    optionalString(card.holder)
  )
}

/**
 * Every saved card of every Group this account opened Loyalty cards in, once
 * each, in the server's order. Empty means: show nothing, wait for Gather.
 */
export function offlineCards(account: string | null | undefined): OfflineCard[] {
  if (!account || !isOfflineReadable(LIST)) return []
  try {
    const seen = new Set<string>()
    const cards: OfflineCard[] = []
    for (const list of readOfflineEntries(account, LIST)) {
      if (!Array.isArray(list)) continue
      for (const card of list) {
        if (!isOfflineCard(card) || seen.has(card._id)) continue
        seen.add(card._id)
        cards.push(card)
      }
    }
    return cards
  } catch {
    return []
  }
}

/**
 * One Group's saved cards, in the server's order, for a signed-in screen that
 * opens while Convex cannot answer (APP-206's quick-actions sheet). The same
 * account rule as `offlineCards`. `undefined` means there is no usable copy for
 * this Group, which includes a copy none of whose cards can be drawn; an empty
 * list means the copy says it has no cards.
 */
export function offlineGroupCards(
  account: string | null | undefined,
  groupSlug: string,
): OfflineCard[] | undefined {
  if (!account || !isOfflineReadable(LIST)) return undefined
  try {
    const list = readOfflineEntry(account, LIST, { groupSlug })
    if (!Array.isArray(list)) return undefined
    const cards = list.filter((card) => isOfflineCard(card))
    return list.length > 0 && cards.length === 0 ? undefined : cards
  } catch {
    return undefined
  }
}

/**
 * One saved card of a Group, for the card's screen while Convex has not
 * answered (APP-206): a card the quick-actions sheet drew from the copy can
 * still show its barcode at the till. Same rules as `offlineGroupCards`.
 */
export function offlineGroupCard(
  account: string | null | undefined,
  groupSlug: string,
  cardId: string,
): OfflineCard | undefined {
  return offlineGroupCards(account, groupSlug)?.find(
    (card) => card._id === cardId,
  )
}
