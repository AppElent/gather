import { expect, test } from 'vitest'
import {
  authoredServings,
  offeredServings,
  parseServingAmount,
  rankLoggedAmounts,
  resolveAmount,
} from './servings'

const bread = {
  baseUnit: 'g' as const,
  nutritionPer100: { calories: 250, protein: 9 },
  servings: [
    { label: '1 slice', amount: 35 },
    { label: '2 slices', amount: 70 },
  ],
}

test('a food with a servings list simply has it', () => {
  expect(authoredServings(bread)).toEqual(bread.servings)
})

test('a food with no list has nothing to offer, and says so with an empty one', () => {
  // The single `servingSize`/`servingLabel` pair this used to read as well is
  // gone (#71); a row that had one was carried into the list by
  // maintenance:backfillFoodServings before the fields were dropped.
  expect(authoredServings({})).toEqual([])
  expect(authoredServings({ servings: [] })).toEqual([])
})

test('choosing a serving resolves to its amount, its name and its nutrients', () => {
  expect(
    resolveAmount(bread, { kind: 'serving', serving: bread.servings[1] }),
  ).toEqual({
    amount: 70,
    label: '2 slices',
    nutrition: { calories: 175, protein: 6.3 },
  })
})

test('a custom amount in the base unit is that amount', () => {
  expect(
    resolveAmount(bread, { kind: 'custom', value: 42, unit: 'base' }),
  ).toEqual({
    amount: 42,
    label: '42 g',
    nutrition: { calories: 105, protein: 3.78 },
  })
})

test('a custom amount in the food’s own serving unit multiplies that serving', () => {
  expect(
    resolveAmount(bread, {
      kind: 'custom',
      value: 1.5,
      unit: 'serving',
      serving: bread.servings[0],
    }),
  ).toEqual({
    amount: 52.5,
    label: '1.5 × 1 slice',
    nutrition: { calories: 131.25, protein: 4.73 },
  })
})

test('nothing that is not a positive amount resolves to anything', () => {
  expect(
    resolveAmount(bread, { kind: 'custom', value: 0, unit: 'base' }),
  ).toBeUndefined()
  expect(
    resolveAmount(bread, { kind: 'custom', value: -5, unit: 'base' }),
  ).toBeUndefined()
  expect(
    resolveAmount(bread, {
      kind: 'serving',
      serving: { label: 'nothing', amount: 0 },
    }),
  ).toBeUndefined()
})

test('a typed amount accepts a Dutch decimal comma and refuses the rest', () => {
  expect(parseServingAmount('42')).toBe(42)
  expect(parseServingAmount(' 1,5 ')).toBe(1.5)
  expect(parseServingAmount('')).toBeUndefined()
  expect(parseServingAmount('0')).toBeUndefined()
  expect(parseServingAmount('-3')).toBeUndefined()
  expect(parseServingAmount('two slices')).toBeUndefined()
})

test('your own amounts come back most-used first', () => {
  const logged = rankLoggedAmounts(
    [
      { quantity: 150, quantityUnit: 'g' },
      { quantity: 30, quantityUnit: 'g' },
      { quantity: 150, quantityUnit: 'g' },
      { quantity: 200, quantityUnit: 'g' },
      { quantity: 200, quantityUnit: 'g' },
      { quantity: 200, quantityUnit: 'g' },
    ],
    'g',
  )
  expect(logged).toEqual([
    { label: '200 g', amount: 200 },
    { label: '150 g', amount: 150 },
    { label: '30 g', amount: 30 },
  ])
})

test('an amount logged in something other than the base unit is not an amount of it', () => {
  expect(
    rankLoggedAmounts(
      [
        { quantity: 2, quantityUnit: 'serving' },
        { quantity: 1, quantityUnit: 'piece' },
        { quantity: 250, quantityUnit: 'ml' },
      ],
      'ml',
    ),
  ).toEqual([{ label: '250 ml', amount: 250 }])
})

test('only a few of your own amounts are offered, not every one you ever used', () => {
  const entries = [10, 20, 30, 40, 50].map((quantity) => ({
    quantity,
    quantityUnit: 'g',
  }))
  expect(rankLoggedAmounts(entries, 'g')).toHaveLength(3)
})

test('what is offered is the food’s own servings, then yours, without repeats', () => {
  expect(
    offeredServings(bread, [
      { label: '70 g', amount: 70 },
      { label: '120 g', amount: 120 },
    ]),
  ).toEqual([
    { label: '1 slice', amount: 35, own: false },
    { label: '2 slices', amount: 70, own: false },
    { label: '120 g', amount: 120, own: true },
  ])
})

test('a Catalog food nobody may edit still gets your own amounts', () => {
  expect(offeredServings({}, [{ label: '90 g', amount: 90 }])).toEqual([
    { label: '90 g', amount: 90, own: true },
  ])
})
