import { describe, expect, test } from 'vitest'
import {
  addGroceryAmounts,
  type GroceryListItem,
  planGroceryAdds,
  readIngredientLine,
  scaleGroceryQuantity,
} from './addLines'

describe('readIngredientLine', () => {
  test.each([
    ['6 eieren', { name: 'Eieren', quantity: 6 }],
    ['2 blikken tomatenblokjes (400 g)', { name: 'Tomatenblokjes', quantity: 2, unit: 'blik' }],
    ["2 rode paprika's, in reepjes", { name: "Rode paprika's", quantity: 2 }],
    ['1 ui, gesnipperd', { name: 'Ui', quantity: 1 }],
    ['een ui', { name: 'Ui', quantity: 1 }],
    ['200 g feta', { name: 'Feta', quantity: 200, unit: 'g' }],
    ['1 bosje verse koriander', { name: 'Verse koriander', quantity: 1, unit: 'bos' }],
    ['snufje chilivlokken', { name: 'Chilivlokken', quantity: 1, unit: 'snuf' }],
    ['2 teentjes knoflook, fijngehakt', { name: 'Knoflook', quantity: 2, unit: 'teentje' }],
    ['2 el olijfolie', { name: 'Olijfolie', quantity: 2, unit: 'el' }],
    ['zout en peper naar smaak', { name: 'Zout en peper' }],
    ['olijfolie', { name: 'Olijfolie' }],
    ['2-3 tomaten', { name: 'Tomaten', quantity: 3 }],
    ['1 1/2 l melk', { name: 'Melk', quantity: 1.5, unit: 'l' }],
    ['1,5 l melk', { name: 'Melk', quantity: 1.5, unit: 'l' }],
    ['½ tl komijn', { name: 'Komijn', quantity: 0.5, unit: 'tl' }],
    ['250 ml slagroom (optioneel)', { name: 'Slagroom', quantity: 250, unit: 'ml' }],
  ])('%s', (line, read) => {
    expect(readIngredientLine(line)).toEqual(read)
  })

  test.each([
    'sap van 1 citroen',
    'een handje verse basilicum',
    'een flinke hand spinazie',
    '1 kopje rijst',
    'wat peterselie',
    '',
    '  ',
  ])('%s needs the AI', (line) => {
    expect(readIngredientLine(line)).toBeNull()
  })
})

describe('scaleGroceryQuantity', () => {
  test('the recipe’s own servings keep the amount as written', () => {
    expect(scaleGroceryQuantity(10, 'g', 1)).toBe(10)
    expect(scaleGroceryQuantity(2.5, undefined, 1)).toBe(2.5)
  })
  test('grams and millilitres round to a step that grows with the amount', () => {
    expect(scaleGroceryQuantity(200, 'g', 6 / 4)).toBe(300)
    expect(scaleGroceryQuantity(200, 'g', 5 / 4)).toBe(250)
    expect(scaleGroceryQuantity(330, 'ml', 3 / 4)).toBe(250)
    expect(scaleGroceryQuantity(10, 'g', 2 / 4)).toBe(5)
    expect(scaleGroceryQuantity(20, 'g', 2 / 4)).toBe(10)
    expect(scaleGroceryQuantity(5, 'g', 2)).toBe(10)
    expect(scaleGroceryQuantity(7, 'g', 3 / 4)).toBe(5)
    expect(scaleGroceryQuantity(150, 'g', 3 / 4)).toBe(115)
  })
  test('counts round up', () => {
    expect(scaleGroceryQuantity(6, undefined, 5 / 4)).toBe(8)
    expect(scaleGroceryQuantity(2, 'blik', 5 / 4)).toBe(3)
    expect(scaleGroceryQuantity(1, undefined, 1 / 4)).toBe(1)
  })
  test('spoons and kilos go in halves', () => {
    expect(scaleGroceryQuantity(2, 'el', 5 / 4)).toBe(2.5)
    expect(scaleGroceryQuantity(1, 'kg', 1 / 4)).toBe(0.25)
    expect(scaleGroceryQuantity(0.25, 'l', 2 / 4)).toBe(0.25)
  })
  test('fewer servings never ask for more than the recipe wrote', () => {
    const units = [undefined, 'g', 'ml', 'kg', 'l', 'el', 'tl', 'blik'] as const
    for (const unit of units)
      for (const quantity of [0.25, 0.5, 1, 2, 3, 5, 7, 10, 30, 49, 120, 330, 1000])
        for (const [wanted, written] of [[1, 2], [1, 4], [2, 4], [3, 4], [5, 6], [1, 8]])
          expect(scaleGroceryQuantity(quantity, unit, wanted / written)).toBeLessThanOrEqual(quantity)
  })
})

describe('addGroceryAmounts', () => {
  test('counts add up, with or without stuks', () => {
    expect(addGroceryAmounts({ quantity: 10 }, { quantity: 6 })).toEqual({ quantity: 16 })
    expect(addGroceryAmounts({ quantity: 2, unit: 'stuks' }, { quantity: 1 })).toEqual({
      quantity: 3,
      unit: 'stuks',
    })
  })
  test('an item without an amount is one of it', () => {
    expect(addGroceryAmounts({}, { quantity: 6 })).toEqual({ quantity: 7 })
  })
  test('the same unit adds up', () => {
    expect(addGroceryAmounts({ quantity: 1, unit: 'blik' }, { quantity: 2, unit: 'blik' })).toEqual({
      quantity: 3,
      unit: 'blik',
    })
  })
  test('weights and volumes add up in the item’s unit', () => {
    expect(addGroceryAmounts({ quantity: 1, unit: 'kg' }, { quantity: 500, unit: 'g' })).toEqual({
      quantity: 1.5,
      unit: 'kg',
    })
    expect(addGroceryAmounts({ quantity: 250, unit: 'ml' }, { quantity: 1, unit: 'l' })).toEqual({
      quantity: 1250,
      unit: 'ml',
    })
  })
  test('a line without an amount changes nothing', () => {
    expect(addGroceryAmounts({ quantity: 1, unit: 'fles' }, {})).toEqual({ quantity: 1, unit: 'fles' })
  })
  test('units that do not add up are refused', () => {
    expect(addGroceryAmounts({ quantity: 1, unit: 'blik' }, { quantity: 400, unit: 'g' })).toBeNull()
    expect(addGroceryAmounts({ quantity: 2 }, { quantity: 1, unit: 'l' })).toBeNull()
    expect(addGroceryAmounts({ quantity: 1, unit: 'g' }, { quantity: 1, unit: 'ml' })).toBeNull()
  })
})

describe('planGroceryAdds', () => {
  const item = (id: string, title: string, extra: Partial<GroceryListItem> = {}): GroceryListItem => ({
    id,
    title,
    done: false,
    ...extra,
  })

  test('the same name with a compatible unit merges; anything else is new', () => {
    const items = [item('a', 'eieren', { quantity: 10 }), item('b', 'Feta', { quantity: 1, unit: 'pak' })]
    expect(
      planGroceryAdds(items, [
        { title: 'Eieren', quantity: 6 },
        { title: 'Feta', quantity: 200, unit: 'g' },
        { title: 'Ui', quantity: 1 },
      ]),
    ).toEqual([
      { kind: 'merge', into: 'a', from: { quantity: 10 }, to: { quantity: 16 } },
      { kind: 'new' },
      { kind: 'new' },
    ])
  })

  test('names match on their stems: "ei" is "eieren", "tomaat" is "tomaten"', () => {
    const items = [item('a', 'ei', { quantity: 2 }), item('b', 'tomaat')]
    expect(
      planGroceryAdds(items, [
        { title: 'Eieren', quantity: 4 },
        { title: 'Tomaten', quantity: 3 },
      ]).map((plan) => plan.kind),
    ).toEqual(['merge', 'merge'])
  })

  test('a checked item is bought, so it is not merged into', () => {
    const items = [item('a', 'eieren', { quantity: 10, done: true })]
    expect(planGroceryAdds(items, [{ title: 'Eieren', quantity: 6 }])).toEqual([{ kind: 'new' }])
  })

  test('an item typed before amounts keeps its title and is not merged into ("2 pak melk")', () => {
    const items = [item('a', '2 pak melk')]
    expect(planGroceryAdds(items, [{ title: 'Melk', quantity: 1, unit: 'pak' }])).toEqual([{ kind: 'new' }])
  })

  test('a name twice in one add goes on the list once', () => {
    expect(
      planGroceryAdds(
        [],
        [
          { title: 'Eieren', quantity: 2 },
          { title: 'Ei', quantity: 1 },
        ],
      ),
    ).toEqual([{ kind: 'new' }, { kind: 'merge', into: 'pending:0', from: { quantity: 2 }, to: { quantity: 3 } }])
  })

  test('merges add up one after another', () => {
    const items = [item('a', 'Melk', { quantity: 1, unit: 'l' })]
    const plans = planGroceryAdds(items, [
      { title: 'melk', quantity: 500, unit: 'ml' },
      { title: 'melk', quantity: 250, unit: 'ml' },
    ])
    expect(plans[1]).toEqual({
      kind: 'merge',
      into: 'a',
      from: { quantity: 1.5, unit: 'l' },
      to: { quantity: 1.75, unit: 'l' },
    })
  })
})
