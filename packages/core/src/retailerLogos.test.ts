import { describe, expect, test } from 'vitest'
import {
  RETAILER_LOGOS,
  RETAILERS_WITHOUT_LOGO,
  retailerLogoFileName,
  retailerLogoKey,
} from './retailerLogos'

describe('retailerLogoKey', () => {
  test('finds a shipped logo by the Catalog key', () => {
    expect(retailerLogoKey('albert-heijn')).toBe('albert-heijn')
  })

  test('answers null for the monogram', () => {
    // A custom store has no key; a dangling Provenance names a retired entry.
    expect(retailerLogoKey(undefined)).toBeNull()
    expect(retailerLogoKey(null)).toBeNull()
    expect(retailerLogoKey('')).toBeNull()
    expect(retailerLogoKey('a-store-that-closed')).toBeNull()
  })

  test('answers null for a Catalog entry without a logo', () => {
    const [key] = Object.keys(RETAILERS_WITHOUT_LOGO)
    expect(retailerLogoKey(key)).toBeNull()
  })

  test('never mistakes an object property for a logo', () => {
    expect(retailerLogoKey('constructor')).toBeNull()
    expect(retailerLogoKey('__proto__')).toBeNull()
    expect(retailerLogoKey('toString')).toBeNull()
  })

  test('the two lists never share a key', () => {
    for (const key of Object.keys(RETAILERS_WITHOUT_LOGO)) {
      expect(key in RETAILER_LOGOS, key).toBe(false)
    }
  })
})

test('a logo file is named after its key and size', () => {
  expect(retailerLogoFileName('hema', 96)).toBe('hema-96.webp')
})
