import { describe, expect, test } from 'vitest'
import { inStockOf } from './list'

describe('inStockOf', () => {
  test('a staple in stock answers for its name in any form', () => {
    const inStock = inStockOf([
      { name: 'Olijfolie', low: false },
      { name: 'Koffiebonen', low: true },
    ])
    expect(inStock('olijfolie')).toBe(true)
    expect(inStock('2 el olijfolie')).toBe(true)
    // Running low is not in stock: the sheet starts it ticked.
    expect(inStock('Koffiebonen')).toBe(false)
    expect(inStock('Rijst')).toBe(false)
  })

  test('nothing is in stock before the staples load', () => {
    expect(inStockOf(undefined)('Olijfolie')).toBe(false)
  })
})
