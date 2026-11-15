import { describe, expect, test } from 'vitest'

import {
  type CardDraft,
  cardNumberCapitals,
  cardNumberKeyboard,
  cardNumberMaxLength,
  checkCardDraft,
} from './loyalty-card-draft'

const draft = (over: Partial<CardDraft> = {}): CardDraft => ({
  storeName: 'Albert Heijn',
  cardNumber: '2620000000008',
  barcodeFormat: 'EAN_13',
  holder: '',
  note: '',
  ...over,
})

describe('checkCardDraft', () => {
  test('passes a valid draft, trimmed, with empty extras left out', () => {
    expect(
      checkCardDraft(
        draft({ storeName: '  Albert Heijn ', cardNumber: '262 0000 000008' }),
      ),
    ).toEqual({
      ok: true,
      values: {
        storeName: 'Albert Heijn',
        cardNumber: '2620000000008',
        barcodeFormat: 'EAN_13',
        holder: undefined,
        note: undefined,
      },
    })
  })

  test('keeps a holder and a note', () => {
    const check = checkCardDraft(draft({ holder: ' Eric ', note: ' kids ' }))
    expect(check.ok && check.values.holder).toBe('Eric')
    expect(check.ok && check.values.note).toBe('kids')
  })

  test('names a missing store and a wrong number together', () => {
    expect(
      checkCardDraft(draft({ storeName: ' ', cardNumber: '2620000000009' })),
    ).toEqual({ ok: false, storeMissing: true, numberProblem: 'checkDigit' })
  })

  test('names an empty number', () => {
    expect(checkCardDraft(draft({ cardNumber: '' }))).toEqual({
      ok: false,
      storeMissing: false,
      numberProblem: 'empty',
    })
  })
})

describe('number field', () => {
  test('offers a number pad for digit formats only', () => {
    expect(cardNumberKeyboard('EAN_13')).toBe('number-pad')
    expect(cardNumberKeyboard('CODE_128')).toBe('default')
    expect(cardNumberKeyboard('QR')).toBe('default')
  })

  test('types capitals for the formats without lower case', () => {
    expect(cardNumberCapitals('CODE_39')).toBe('characters')
    expect(cardNumberCapitals('CODABAR')).toBe('characters')
    expect(cardNumberCapitals('CODE_128')).toBe('none')
  })

  test('leaves room for typed spaces in a linear code', () => {
    expect(cardNumberMaxLength('EAN_13')).toBe(160)
    expect(cardNumberMaxLength('QR')).toBe(512)
  })
})
