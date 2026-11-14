import { BARCODE_FORMATS } from '@gather/core/barcodes'
import { describe, expect, test } from 'vitest'

import {
  cardFromScan,
  formatFromScanType,
  SCAN_TYPES,
  suggestedRetailer,
} from './card-scan'

describe('formatFromScanType', () => {
  test('asks the scanner for one type per format', () => {
    expect(SCAN_TYPES).toHaveLength(BARCODE_FORMATS.length)
    expect(new Set(SCAN_TYPES).size).toBe(SCAN_TYPES.length)
  })

  test('maps every type the scanner is asked for back to its format', () => {
    expect(SCAN_TYPES.map(formatFromScanType)).toEqual([...BARCODE_FORMATS])
  })

  test.each([
    ['ean13', 'EAN_13'],
    ['org.gs1.EAN-13', 'EAN_13'],
    ['VNBarcodeSymbologyEAN13', 'EAN_13'],
    ['upc_e', 'UPC_E'],
    ['interleaved2of5', 'ITF'],
    ['itf14', 'ITF'],
    ['code39mod43', 'CODE_39'],
    ['org.iso.QRCode', 'QR'],
    ['datamatrix', 'DATA_MATRIX'],
  ])('reads %s as %s', (type, format) => {
    expect(formatFromScanType(type)).toBe(format)
  })

  test('knows nothing of a type Gather does not draw', () => {
    expect(formatFromScanType('maxicode')).toBeNull()
    expect(formatFromScanType('')).toBeNull()
  })
})

describe('cardFromScan (a mocked scanner result)', () => {
  test('prefills an Albert Heijn Bonuskaart as scanned', () => {
    expect(cardFromScan({ type: 'ean13', data: '2620187342052' })).toEqual({
      barcodeFormat: 'EAN_13',
      cardNumber: '2620187342052',
    })
  })

  test('reads the twelve-digit "EAN-13" iOS reports as the UPC-A it is', () => {
    expect(cardFromScan({ type: 'ean13', data: '036000291452' })).toEqual({
      barcodeFormat: 'UPC_A',
      cardNumber: '036000291452',
    })
  })

  test('keeps a QR code’s text whole', () => {
    expect(
      cardFromScan({ type: 'qr', data: 'https://example.nl/kaart?id=1' }),
    ).toEqual({ barcodeFormat: 'QR', cardNumber: 'https://example.nl/kaart?id=1' })
  })

  test('normalizes what the format normalizes', () => {
    expect(cardFromScan({ type: 'code39', data: ' dg-4217 ' })).toEqual({
      barcodeFormat: 'CODE_39',
      cardNumber: 'DG-4217',
    })
  })

  test('hands over a number its format refuses, for the form to name', () => {
    expect(cardFromScan({ type: 'ean13', data: '2620187342053' })).toEqual({
      barcodeFormat: 'EAN_13',
      cardNumber: '2620187342053',
    })
  })

  test('ignores an unknown type or an empty code', () => {
    expect(cardFromScan({ type: 'maxicode', data: '123' })).toBeNull()
    expect(cardFromScan({ type: 'ean13', data: '  ' })).toBeNull()
  })
})

describe('suggestedRetailer', () => {
  const CATALOG = [
    { seedKey: 'albert-heijn', numberPrefix: '262', numberLength: 13 },
    { seedKey: 'jumbo', numberLength: 13 },
  ]

  test('suggests the retailer whose pattern the scanned number fits', () => {
    expect(suggestedRetailer(CATALOG, '2620187342052')?.seedKey).toBe(
      'albert-heijn',
    )
  })

  test('suggests nothing on a length alone', () => {
    expect(suggestedRetailer(CATALOG, '8710400000004')).toBeNull()
  })

  test('suggests nothing while the Catalog is loading', () => {
    expect(suggestedRetailer(undefined, '2620187342052')).toBeNull()
  })

  test('suggests nothing when two retailers fit', () => {
    const twins = [
      { seedKey: 'a', numberPrefix: '26' },
      { seedKey: 'b', numberPrefix: '262' },
    ]
    expect(suggestedRetailer(twins, '2620187342052')).toBeNull()
  })
})
