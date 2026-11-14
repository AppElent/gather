import { describe, expect, test } from 'vitest'

import {
  BARCODE_FORMATS,
  barcodeShape,
  checkCardNumber,
  gs1CheckDigit,
  isBarcodeFormat,
  MAX_CARD_NUMBER_LENGTH,
} from './barcodes'

describe('the GS1 check digit', () => {
  test('matches published examples', () => {
    // EAN-13 4006381333931, EAN-8 96385074, UPC-A 036000291452.
    expect(gs1CheckDigit('400638133393')).toBe(1)
    expect(gs1CheckDigit('9638507')).toBe(4)
    expect(gs1CheckDigit('03600029145')).toBe(2)
  })
})

describe('checkCardNumber', () => {
  test('accepts valid EAN-13, EAN-8, UPC-A and UPC-E numbers', () => {
    expect(checkCardNumber('EAN_13', '4006381333931')).toEqual({
      ok: true,
      value: '4006381333931',
    })
    expect(checkCardNumber('EAN_8', '96385074').ok).toBe(true)
    expect(checkCardNumber('UPC_A', '036000291452').ok).toBe(true)
    // 01234565 expands to UPC-A 012345000065.
    expect(checkCardNumber('UPC_E', '01234565').ok).toBe(true)
  })

  test('drops the spaces and dashes people copy off a card', () => {
    expect(checkCardNumber('EAN_13', ' 4006 3813-3393 1 ')).toEqual({
      ok: true,
      value: '4006381333931',
    })
  })

  test('names what is wrong with a GS1 number', () => {
    expect(checkCardNumber('EAN_13', '4006381333932')).toEqual({
      ok: false,
      problem: 'checkDigit',
    })
    expect(checkCardNumber('EAN_13', '400638133393')).toEqual({
      ok: false,
      problem: 'length',
    })
    expect(checkCardNumber('EAN_13', '40063813339A1')).toEqual({
      ok: false,
      problem: 'characters',
    })
    expect(checkCardNumber('EAN_8', '96385075')).toEqual({
      ok: false,
      problem: 'checkDigit',
    })
    expect(checkCardNumber('UPC_E', '01234566')).toEqual({
      ok: false,
      problem: 'checkDigit',
    })
    // UPC-E's number system is 0 or 1.
    expect(checkCardNumber('UPC_E', '21234565')).toEqual({
      ok: false,
      problem: 'characters',
    })
  })

  test('refuses an empty number in every format', () => {
    for (const format of BARCODE_FORMATS) {
      expect(checkCardNumber(format, '   ')).toEqual({
        ok: false,
        problem: 'empty',
      })
    }
  })

  test('caps every format at the same length', () => {
    const long = '1'.repeat(MAX_CARD_NUMBER_LENGTH + 1)
    expect(checkCardNumber('QR', long)).toEqual({
      ok: false,
      problem: 'length',
    })
    expect(checkCardNumber('CODE_128', long)).toEqual({
      ok: false,
      problem: 'length',
    })
  })

  test('ITF needs pairs of digits, and checks ITF-14', () => {
    expect(checkCardNumber('ITF', '123456').ok).toBe(true)
    expect(checkCardNumber('ITF', '12345')).toEqual({
      ok: false,
      problem: 'length',
    })
    const body = '1540014128876'
    const valid = `${body}${gs1CheckDigit(body)}`
    expect(checkCardNumber('ITF', valid).ok).toBe(true)
    const wrong = `${body}${(gs1CheckDigit(body) + 1) % 10}`
    expect(checkCardNumber('ITF', wrong)).toEqual({
      ok: false,
      problem: 'checkDigit',
    })
  })

  test('CODE_39 and CODE_93 upper-case and keep to their character set', () => {
    expect(checkCardNumber('CODE_39', 'dg-4217')).toEqual({
      ok: true,
      value: 'DG-4217',
    })
    expect(checkCardNumber('CODE_93', 'AB 12.$/+%').ok).toBe(true)
    expect(checkCardNumber('CODE_39', 'AB_12')).toEqual({
      ok: false,
      problem: 'characters',
    })
  })

  test('Codabar allows A–D start and stop characters around its body', () => {
    expect(checkCardNumber('CODABAR', '12345-$').ok).toBe(true)
    expect(checkCardNumber('CODABAR', 'A12345B').ok).toBe(true)
    expect(checkCardNumber('CODABAR', 'AB')).toEqual({
      ok: false,
      problem: 'characters',
    })
    expect(checkCardNumber('CODABAR', '12E45')).toEqual({
      ok: false,
      problem: 'characters',
    })
  })

  test('CODE_128 takes printable ASCII and keeps case', () => {
    expect(checkCardNumber('CODE_128', 'Ab-12 #x')).toEqual({
      ok: true,
      value: 'Ab-12 #x',
    })
    expect(checkCardNumber('CODE_128', 'café')).toEqual({
      ok: false,
      problem: 'characters',
    })
  })

  test('matrix codes carry any text', () => {
    for (const format of ['QR', 'PDF417', 'AZTEC', 'DATA_MATRIX'] as const) {
      expect(checkCardNumber(format, 'https://example.nl/kaart?id=é').ok).toBe(
        true,
      )
    }
  })
})

describe('format helpers', () => {
  test('know the matrix codes from the linear ones', () => {
    expect(barcodeShape('QR')).toBe('matrix')
    expect(barcodeShape('DATA_MATRIX')).toBe('matrix')
    expect(barcodeShape('EAN_13')).toBe('linear')
    expect(barcodeShape('CODABAR')).toBe('linear')
  })

  test('recognise a format name', () => {
    expect(isBarcodeFormat('EAN_13')).toBe(true)
    expect(isBarcodeFormat('QR_CODE')).toBe(false)
  })
})
