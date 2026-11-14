/**
 * The database's side of Loyalty cards (APP-141): validators built from the
 * core tuples, and the checks every write runs. The rules themselves live in
 * `@gather/core/barcodes` and `@gather/core/loyalty-cards`, because the
 * clients validate against the same ones before they send (ADR-0016).
 */

import { BARCODE_FORMATS, type BarcodeFormat, checkCardNumber, FORMAT_CONFIDENCES } from '@gather/core/barcodes'
import {
  isHexColor,
  LOYALTY_CARD_LIMITS,
  RETAILER_CATEGORIES,
} from '@gather/core/loyalty-cards'
import { loyaltyCardRefusal } from '@gather/core/refusals'
import { ConvexError } from 'convex/values'
import { literals } from './validators'

export const barcodeFormatValidator = literals(BARCODE_FORMATS)
export const formatConfidenceValidator = literals(FORMAT_CONFIDENCES)
export const retailerCategoryValidator = literals(RETAILER_CATEGORIES)

/** The card number as stored, or a keyed refusal naming what is wrong. */
export function checkedCardNumber(format: BarcodeFormat, raw: string): string {
  const check = checkCardNumber(format, raw)
  if (!check.ok) {
    throw new ConvexError(loyaltyCardRefusal(`cardNumber:${check.problem}`))
  }
  return check.value
}

export function checkedStoreName(raw: string): string {
  const name = raw.trim()
  if (!name) throw new ConvexError(loyaltyCardRefusal('needsStore'))
  if (name.length > LOYALTY_CARD_LIMITS.storeName) {
    throw new ConvexError(loyaltyCardRefusal('tooLong'))
  }
  return name
}

/** Trimmed, `undefined` when empty, refused when longer than `limit`. */
export function checkedOptionalText(
  raw: string | undefined,
  limit: number,
): string | undefined {
  const text = raw?.trim()
  if (!text) return undefined
  if (text.length > limit) throw new ConvexError(loyaltyCardRefusal('tooLong'))
  return text
}

export function checkedBrandColor(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined
  if (!isHexColor(raw)) throw new ConvexError(loyaltyCardRefusal('brandColor'))
  return raw.toLowerCase()
}
