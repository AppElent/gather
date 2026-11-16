/**
 * The add flow's steps and how they move (APP-160), apart from the screen so
 * the rules are testable without one.
 */
import type { StoreSeed } from '../components/loyalty-card-form'
import type { Retailer } from '../loyalty-card-types'
import type { ScannedCard } from './card-scan'

export type AddStep =
  | { step: 'scan' }
  | { step: 'store'; scanned: ScannedCard | null }
  | { step: 'fields' }

/** The store a filled-in form belongs to, and the scan it started from. */
export interface ChosenStore {
  scanned: ScannedCard | null
  retailer: Retailer | null
}

/**
 * One step back, as Android's back does: fields to store, store to scan.
 * `null` at the first step, where back leaves the flow.
 */
export function stepBefore(
  current: AddStep,
  chosen: ChosenStore | null,
): AddStep | null {
  switch (current.step) {
    case 'fields':
      return { step: 'store', scanned: chosen?.scanned ?? null }
    case 'store':
      return { step: 'scan' }
    default:
      return null
  }
}

/**
 * What a form already filled in takes over when its store changes: the new
 * store's name, and a new scan's number and type. Whatever was typed for the
 * rest — the holder, the note, the photos, and a number typed by hand — stays.
 */
export function reseedFor(
  previous: ChosenStore,
  next: ChosenStore,
  key: number,
): StoreSeed {
  const rescanned = next.scanned !== null && next.scanned !== previous.scanned
  return {
    key,
    // "Other store" after a Catalog one starts from an empty name rather than
    // the old store's; from "Other store" to "Other store" keeps what was typed.
    storeName: next.retailer
      ? next.retailer.name
      : previous.retailer
        ? ''
        : undefined,
    cardNumber: rescanned ? next.scanned?.cardNumber : undefined,
    // A scanned code says what it is; without one, the store's usual type.
    barcodeFormat: rescanned
      ? next.scanned?.barcodeFormat
      : next.scanned
        ? undefined
        : next.retailer?.barcodeFormat,
  }
}
