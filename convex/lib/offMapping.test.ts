// Read fixtures via a plain file:// URL relative to this file. The default
// jsdom test environment runs modules through Vite's client transform, which
// intercepts `new URL(relative, import.meta.url)` as an asset-URL reference
// and resolves it against a fake http://localhost origin instead of disk —
// force the Node environment for this file so it resolves to a real path
// (same fix as recipeParsingFixtures.test.ts).
// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { mapOffProduct } from './offMapping'

function fixture(name: string): unknown {
  return JSON.parse(
    readFileSync(
      new URL(`./__fixtures__/off/${name}.json`, import.meta.url),
      'utf8',
    ),
  )
}

describe('mapOffProduct — real captures', () => {
  test('nutella.json: full nutriments, no fiber published; product_name_nl is present but (as of capture) identical to product_name since "Nutella" is unchanged across languages', () => {
    const mapped = mapOffProduct(fixture('nutella'))
    expect(mapped?.nutritionPer100).toEqual({
      calories: 539,
      protein: 6.3,
      carbs: 57.5,
      sugars: 56.3,
      fat: 30.9,
      saturatedFat: 10.6,
      salt: 0.107,
    })
    expect(mapped?.brand).toBe('Nutella')
    expect(mapped?.name).toBe('Nutella')
    // This product publishes neither serving_size nor serving_quantity.
    expect(mapped?.servingSize).toBeUndefined()
    expect(mapped?.servingLabel).toBeUndefined()
  })

  test('hagelslag.json (AH Puur Hagelslag, barcode 8718906716223): publishes fiber, Dutch name path, string+number serving info', () => {
    const mapped = mapOffProduct(fixture('hagelslag'))
    expect(mapped?.nutritionPer100).toEqual({
      calories: 446,
      protein: 5.2,
      carbs: 67,
      sugars: 64,
      fat: 16,
      saturatedFat: 9,
      fiber: 7,
      salt: 0.3,
    })
    expect(mapped?.brand).toBe('Albert Heijn')
    expect(mapped?.name).toBe('Puur Hagelslag')
    expect(mapped?.servingSize).toBe(20)
    expect(mapped?.servingLabel).toBe('20 gram')
  })
})

describe('mapOffProduct — synthetic edge cases', () => {
  test('returns null when status is not 1 (product not found)', () => {
    expect(mapOffProduct({ status: 0 })).toBeNull()
  })

  test('returns null for malformed or non-object input', () => {
    expect(mapOffProduct(null)).toBeNull()
    expect(mapOffProduct('nope')).toBeNull()
    expect(mapOffProduct({ status: 1 })).toBeNull() // no `product` field
  })

  test('handles partial nutriments — only calories present', () => {
    const mapped = mapOffProduct({
      status: 1,
      product: {
        product_name: 'Basic Item',
        nutriments: { 'energy-kcal_100g': 100 },
      },
    })
    expect(mapped).toEqual({
      name: 'Basic Item',
      brand: undefined,
      nutritionPer100: { calories: 100 },
      servingSize: undefined,
      servingLabel: undefined,
    })
  })

  test('prefers the Dutch product name when present', () => {
    const mapped = mapOffProduct({
      status: 1,
      product: {
        product_name: 'Generic Name',
        product_name_nl: 'Nederlandse Naam',
        nutriments: {},
      },
    })
    expect(mapped?.name).toBe('Nederlandse Naam')
  })

  test('falls back to an empty name when neither name field is present', () => {
    const mapped = mapOffProduct({ status: 1, product: { nutriments: {} } })
    expect(mapped?.name).toBe('')
  })

  test('parses serving_quantity as servingSize and serving_size string as servingLabel', () => {
    const mapped = mapOffProduct({
      status: 1,
      product: {
        product_name: 'Cereal',
        nutriments: {},
        serving_quantity: 30,
        serving_size: '30 g (1 bowl)',
      },
    })
    expect(mapped?.servingSize).toBe(30)
    expect(mapped?.servingLabel).toBe('30 g (1 bowl)')
  })

  test('falls back to parsing a leading number out of serving_size when serving_quantity is absent', () => {
    const mapped = mapOffProduct({
      status: 1,
      product: {
        product_name: 'Cereal',
        nutriments: {},
        serving_size: '45g',
      },
    })
    expect(mapped?.servingSize).toBe(45)
  })
})
