import { describe, expect, test } from 'vitest'
import {
  formatGroceryAmount,
  GROCERY_QUANTITY_MAX,
  type GroceryUnitWords,
  groceryAddFields,
  groceryLineText,
  stepGroceryQuantity,
} from './amount'
import { recogniseGroceryLine } from './index'
import { GROCERY_UNITS, parseGroceryLine } from './parse'

const WORDS = Object.fromEntries(
  GROCERY_UNITS.map((unit) => [unit, { one: unit, other: `${unit}s` }]),
) as GroceryUnitWords

describe('groceryAddFields', () => {
  test.each([
    ['2 pakken melk', { title: 'melk', quantity: 2, unit: 'pak' }],
    ['500g gehakt', { title: 'gehakt', quantity: 500, unit: 'g' }],
    ['melk 2', { title: 'melk', quantity: 2 }],
    ['6 eieren', { title: 'eieren', quantity: 6 }],
    ['zak sla', { title: 'sla', quantity: 1, unit: 'zak' }],
    ['½ kilo uien', { title: 'uien', quantity: 0.5, unit: 'kg' }],
    ['1/3 l room', { title: 'room', quantity: 0.333, unit: 'l' }],
    ['bananen', { title: 'bananen' }],
    ['  appels  ', { title: 'appels' }],
    ['luiers maat 4', { title: 'luiers maat 4' }],
    ['7up', { title: '7up' }],
  ])('%s', (line, fields) => {
    expect(groceryAddFields(line)).toEqual(fields)
  })

  test('an amount past the largest one keeps the name and drops the amount', () => {
    expect(groceryAddFields(`${GROCERY_QUANTITY_MAX + 1} rijst`)).toEqual({
      title: 'rijst',
    })
  })

  test('ten common Dutch items get their amount and aisle', () => {
    const lines = [
      '2 pakken melk',
      '500g gehakt',
      '6 eieren',
      '1 brood',
      'kipfilet 400 gram',
      '3 bananen',
      'zak sla',
      '2 blikken tomaten',
      '1,5 l cola',
      'wc papier',
    ]
    expect(
      lines.map((line) => {
        const fields = groceryAddFields(line)
        return [
          fields.title,
          fields.quantity,
          fields.unit,
          // The server recognises the item as a line again, so "2 blikken
          // tomaten" stays in tins even though its title is "tomaten".
          recogniseGroceryLine(
            groceryLineText(fields.title, fields.quantity, fields.unit),
          ).aisle,
        ]
      }),
    ).toEqual([
      ['melk', 2, 'pak', 'dairy'],
      ['gehakt', 500, 'g', 'meat_fish'],
      ['eieren', 6, undefined, 'dairy'],
      ['brood', 1, undefined, 'bakery'],
      ['kipfilet', 400, 'g', 'meat_fish'],
      ['bananen', 3, undefined, 'produce'],
      ['sla', 1, 'zak', 'produce'],
      ['tomaten', 2, 'blik', 'tins_sauces'],
      ['cola', 1.5, 'l', 'drinks'],
      ['wc papier', undefined, undefined, 'household'],
    ])
  })
})

describe('groceryLineText', () => {
  test.each([
    ['melk', 2, 'pak', '2 pak melk'],
    ['gehakt', 500, 'g', '500 g gehakt'],
    ['eieren', 6, undefined, '6 eieren'],
    ['cola', 1.5, 'l', '1.5 l cola'],
    ['sla', undefined, 'zak', '1 zak sla'],
    ['bananen', undefined, undefined, 'bananen'],
  ] as const)('%s', (title, quantity, unit, line) => {
    expect(groceryLineText(title, quantity, unit)).toBe(line)
  })

  test('reads back as the same amount, unit and name', () => {
    for (const unit of GROCERY_UNITS) {
      const parsed = parseGroceryLine(groceryLineText('appels', 3, unit))
      expect(parsed.name).toBe('appels')
      expect(parsed.quantity).toBe(3)
      expect(parsed.unit ?? 'stuks').toBe(unit)
    }
  })
})

describe('formatGroceryAmount', () => {
  test.each([
    [2, 'pak', 'nl', '2 paks'],
    [1, 'pak', 'nl', '1 pak'],
    [500, 'g', 'nl', '500 gs'],
    [1.5, 'l', 'nl', '1,5 ls'],
    [1.5, 'l', 'en', '1.5 ls'],
    [3, undefined, 'nl', '3'],
    [3, 'stuks', 'nl', '3'],
    [1, undefined, 'nl', null],
    [1, 'stuks', 'nl', null],
    [undefined, undefined, 'nl', null],
    [undefined, 'zak', 'nl', '1 zak'],
    [1500, 'g', 'nl', '1500 gs'],
  ] as const)('%s %s (%s)', (quantity, unit, locale, shown) => {
    expect(formatGroceryAmount(quantity, unit, locale, WORDS)).toBe(shown)
  })
})

describe('stepGroceryQuantity', () => {
  test.each([
    [2, 'pak', 1, 3],
    [2, 'pak', -1, 1],
    [1, 'pak', -1, null],
    [undefined, undefined, 1, 2],
    [500, 'g', 1, 550],
    [250, 'g', -1, 200],
    [1.5, 'kg', 1, 2],
    [1.2, 'kg', 1, 1.5],
    [1.2, 'kg', -1, 1],
    [0.5, 'l', -1, null],
    [2.5, undefined, 1, 3],
    [2.5, undefined, -1, 2],
    [GROCERY_QUANTITY_MAX, undefined, 1, GROCERY_QUANTITY_MAX],
  ] as const)('%s %s %s', (quantity, unit, direction, next) => {
    expect(stepGroceryQuantity(quantity, unit, direction)).toBe(next)
  })
})
