import { describe, expect, test } from 'vitest'
import { aisleOrder, GROCERY_AISLES, isDefaultAisleOrder } from './aisles'

describe('aisleOrder', () => {
  test('no saved order is the default walking order', () => {
    expect(aisleOrder(undefined)).toEqual([...GROCERY_AISLES])
    expect(aisleOrder(null)).toEqual([...GROCERY_AISLES])
    expect(aisleOrder([])).toEqual([...GROCERY_AISLES])
  })

  test('a saved order leads, and aisles it does not name follow in default order', () => {
    const order = aisleOrder(['frozen', 'produce', 'drinks'])
    expect(order.slice(0, 3)).toEqual(['frozen', 'produce', 'drinks'])
    expect(order.slice(3)).toEqual(
      GROCERY_AISLES.filter((a) => !['frozen', 'produce', 'drinks'].includes(a)),
    )
    expect(order).toHaveLength(GROCERY_AISLES.length)
  })

  test('unknown ids and repeats are dropped', () => {
    expect(aisleOrder(['bakery', 'spaceships', 'bakery']).slice(0, 2)).toEqual([
      'bakery',
      'produce',
    ])
  })
})

describe('isDefaultAisleOrder', () => {
  test('tells a custom order from the default one', () => {
    expect(isDefaultAisleOrder(undefined)).toBe(true)
    expect(isDefaultAisleOrder([...GROCERY_AISLES])).toBe(true)
    expect(isDefaultAisleOrder(['produce'])).toBe(true)
    expect(isDefaultAisleOrder(['bakery', 'produce'])).toBe(false)
  })
})
