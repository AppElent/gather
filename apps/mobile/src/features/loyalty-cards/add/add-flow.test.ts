import { describe, expect, test } from 'vitest'

import type { Retailer } from '../loyalty-card-types'
import { reseedFor, stepBefore } from './add-flow'

const AH = {
  seedKey: 'albert-heijn',
  name: 'Albert Heijn',
  barcodeFormat: 'EAN_13',
} as Retailer
const KRUIDVAT = {
  seedKey: 'kruidvat',
  name: 'Kruidvat',
  barcodeFormat: 'CODE_128',
} as Retailer
const SCAN = { cardNumber: '2620000000008', barcodeFormat: 'EAN_13' as const }

describe('stepBefore', () => {
  test('goes fields, store, scan, and then has nothing left', () => {
    const chosen = { scanned: SCAN, retailer: AH }
    expect(stepBefore({ step: 'fields' }, chosen)).toEqual({
      step: 'store',
      scanned: SCAN,
    })
    expect(stepBefore({ step: 'store', scanned: SCAN }, chosen)).toEqual({
      step: 'scan',
    })
    expect(stepBefore({ step: 'scan' }, chosen)).toBeNull()
  })
})

describe('reseedFor', () => {
  test('another Catalog store takes its name and keeps the scanned number', () => {
    expect(
      reseedFor(
        { scanned: SCAN, retailer: AH },
        { scanned: SCAN, retailer: KRUIDVAT },
        2,
      ),
    ).toEqual({
      key: 2,
      storeName: 'Kruidvat',
      cardNumber: undefined,
      barcodeFormat: undefined,
    })
  })

  test('without a scan, the new store brings its usual barcode type', () => {
    expect(
      reseedFor(
        { scanned: null, retailer: AH },
        { scanned: null, retailer: KRUIDVAT },
        1,
      ),
    ).toMatchObject({ storeName: 'Kruidvat', barcodeFormat: 'CODE_128' })
  })

  test('"Other store" after a Catalog one starts from an empty name', () => {
    expect(
      reseedFor(
        { scanned: null, retailer: AH },
        { scanned: null, retailer: null },
        1,
      ),
    ).toMatchObject({ storeName: '', barcodeFormat: undefined })
    expect(
      reseedFor(
        { scanned: null, retailer: null },
        { scanned: null, retailer: null },
        1,
      ).storeName,
    ).toBeUndefined()
  })

  test('a new scan replaces the number and its type', () => {
    const rescan = { cardNumber: 'ABC-1', barcodeFormat: 'CODE_128' as const }
    expect(
      reseedFor(
        { scanned: SCAN, retailer: AH },
        { scanned: rescan, retailer: null },
        3,
      ),
    ).toMatchObject({ cardNumber: 'ABC-1', barcodeFormat: 'CODE_128' })
  })
})
