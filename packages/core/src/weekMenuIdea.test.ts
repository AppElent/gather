import { expect, test } from 'vitest'
import { GROCERY_UNITS } from './groceries'
import { ideaRows } from './weekMenuIdea'

const units = Object.fromEntries(
  GROCERY_UNITS.map((unit) => [unit, { one: unit, other: unit }]),
) as unknown as Parameters<typeof ideaRows>[0]['units']

const rows = (servings: number) =>
  ideaRows({
    idea: {
      servings: 2,
      ingredients: [
        { name: 'rijst', quantity: 200, unit: 'g' },
        { name: 'knoflook', quantity: 2, unit: 'teentje' },
        { name: 'zout' },
      ],
    },
    servings,
    stockNames: ['Rijst'],
    locale: 'nl',
    units,
  })

test('amounts scale to the servings chosen', () => {
  expect(rows(4)[0].line).toContain('400')
  expect(rows(2)[0].line).toContain('200')
})

test('a unit the grocery list does not know is kept as text', () => {
  expect(rows(4)[1]).toMatchObject({
    amount: '4 teentje',
    line: '4 teentje knoflook',
  })
})

test('no amount stays without one, and stock is marked', () => {
  expect(rows(2)[2]).toEqual({
    name: 'zout',
    amount: null,
    line: 'zout',
    inStock: false,
  })
  expect(rows(2)[0].inStock).toBe(true)
})
