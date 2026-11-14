import {
  type BarcodeFormat,
  type BarcodeProblem,
  barcodeShape,
  checkCardNumber,
  isDigitsOnlyFormat,
  MAX_CARD_NUMBER_LENGTH,
  MAX_LINEAR_CARD_NUMBER_LENGTH,
} from '@gather/core/barcodes'
import { LOYALTY_CARD_LIMITS } from '@gather/core/loyalty-cards'

/** What the form holds while somebody types. */
export interface CardDraft {
  storeName: string
  cardNumber: string
  barcodeFormat: BarcodeFormat
  holder: string
  note: string
}

/** What a valid draft saves: trimmed, with the number as its format reads it. */
export interface CardValues {
  storeName: string
  cardNumber: string
  barcodeFormat: BarcodeFormat
  holder?: string
  note?: string
}

export type DraftCheck =
  | { ok: true; values: CardValues }
  | { ok: false; storeMissing: boolean; numberProblem: BarcodeProblem | null }

/**
 * Whether a draft can be saved, by the rules Convex applies
 * (`@gather/core/barcodes` and `LOYALTY_CARD_LIMITS`), so the Save button is
 * only enabled for something the server will take. A validator answers with a
 * problem key, never a sentence (`apps/mobile/DESIGN_SYSTEM.md`).
 */
export function checkCardDraft(draft: CardDraft): DraftCheck {
  const storeName = draft.storeName.trim()
  const number = checkCardNumber(draft.barcodeFormat, draft.cardNumber)
  if (!storeName || !number.ok) {
    return {
      ok: false,
      storeMissing: !storeName,
      numberProblem: number.ok ? null : number.problem,
    }
  }
  const holder = draft.holder.trim()
  const note = draft.note.trim()
  return {
    ok: true,
    values: {
      storeName,
      cardNumber: number.value,
      barcodeFormat: draft.barcodeFormat,
      holder: holder || undefined,
      note: note || undefined,
    },
  }
}

/** The keyboard for typing a card number in this format. */
export function cardNumberKeyboard(
  format: BarcodeFormat,
): 'number-pad' | 'default' {
  return isDigitsOnlyFormat(format) ? 'number-pad' : 'default'
}

/** Code 39, Code 93 and Codabar have no lower case: type in capitals. */
export function cardNumberCapitals(
  format: BarcodeFormat,
): 'characters' | 'none' {
  return format === 'CODE_39' || format === 'CODE_93' || format === 'CODABAR'
    ? 'characters'
    : 'none'
}

/** The longest a card number field lets you type, by the format's shape. */
export function cardNumberMaxLength(format: BarcodeFormat): number {
  // Room for the spaces people type between digit groups, which the check
  // drops before it measures.
  return barcodeShape(format) === 'linear'
    ? MAX_LINEAR_CARD_NUMBER_LENGTH * 2
    : MAX_CARD_NUMBER_LENGTH
}

export const FIELD_LIMITS = LOYALTY_CARD_LIMITS
