import { expect, test } from 'vitest'
import {
  authoredServings,
  MAX_MEAL_SUGGESTIONS,
  offeredServings,
  parseServingAmount,
  rankLoggedAmounts,
  rankMealChoices,
  resolveAmount,
  suggestionWindowStart,
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

/**
 * What the add sheet opens on: the things you usually have at *this* meal.
 *
 * Breakfast opens on breakfast things — the whole point of the empty state is
 * that the common case needs no typing, and what somebody has every morning is
 * a far better guess than whatever they logged last night (#76, #73).
 */
const entry = (
  meal: string,
  date: string,
  ref: { foodId?: string; recipeId?: string },
) => ({ meal, date, ...ref })

test('the things you have most often at a meal come first', () => {
  expect(
    rankMealChoices(
      [
        entry('breakfast', '2026-08-01', { foodId: 'oats' }),
        entry('breakfast', '2026-08-02', { foodId: 'oats' }),
        entry('breakfast', '2026-08-03', { foodId: 'toast' }),
        entry('breakfast', '2026-08-04', { foodId: 'oats' }),
      ],
      { meal: 'breakfast' },
    ),
  ).toEqual({ foodIds: ['oats', 'toast'], recipeIds: [] })
})

test('a habit is per meal — dinner is not asked about breakfast', () => {
  const entries = [
    entry('breakfast', '2026-08-01', { foodId: 'oats' }),
    entry('breakfast', '2026-08-02', { foodId: 'oats' }),
    entry('dinner', '2026-08-01', { foodId: 'rice' }),
  ]
  expect(rankMealChoices(entries, { meal: 'dinner' })).toEqual({
    foodIds: ['rice'],
    recipeIds: [],
  })
})

test('a tie goes to the newer habit, so a change of routine overtakes', () => {
  expect(
    rankMealChoices(
      [
        entry('lunch', '2026-06-01', { foodId: 'soup' }),
        entry('lunch', '2026-06-02', { foodId: 'soup' }),
        entry('lunch', '2026-07-20', { foodId: 'salad' }),
        entry('lunch', '2026-07-21', { foodId: 'salad' }),
      ],
      { meal: 'lunch' },
    ).foodIds,
  ).toEqual(['salad', 'soup'])
})

test('foods and recipes are counted apart — they are two sections', () => {
  expect(
    rankMealChoices(
      [
        entry('dinner', '2026-08-01', { recipeId: 'curry' }),
        entry('dinner', '2026-08-02', { recipeId: 'curry' }),
        entry('dinner', '2026-08-02', { foodId: 'rice' }),
        // A one-off references neither, and there is nothing to offer back.
        entry('dinner', '2026-08-03', {}),
      ],
      { meal: 'dinner' },
    ),
  ).toEqual({ foodIds: ['rice'], recipeIds: ['curry'] })
})

test('a habit older than the window is not still the first thing offered', () => {
  expect(
    rankMealChoices(
      [
        entry('breakfast', '2026-01-01', { foodId: 'pancakes' }),
        entry('breakfast', '2026-01-02', { foodId: 'pancakes' }),
        entry('breakfast', '2026-08-01', { foodId: 'oats' }),
      ],
      { meal: 'breakfast', since: '2026-06-10' },
    ).foodIds,
  ).toEqual(['oats'])
})

test('a day after the one being logged is not a habit of it', () => {
  // The window has two ends. Opening the sheet on a day last month must ask
  // about the habits of that month — if what came *after* counted, a historical
  // day would be ranked by a routine its owner had not started yet, and the
  // caller's newest-first scan cap would spend itself on those rows first.
  expect(
    rankMealChoices(
      [
        entry('breakfast', '2026-08-20', { foodId: 'granola' }),
        entry('breakfast', '2026-08-21', { foodId: 'granola' }),
        entry('breakfast', '2026-07-04', { foodId: 'oats' }),
      ],
      { meal: 'breakfast', since: '2026-05-06', until: '2026-07-05' },
    ).foodIds,
  ).toEqual(['oats'])
})

test('the day being logged counts, so this morning is part of this morning', () => {
  expect(
    rankMealChoices([entry('breakfast', '2026-07-05', { foodId: 'oats' })], {
      meal: 'breakfast',
      until: '2026-07-05',
    }).foodIds,
  ).toEqual(['oats'])
})

test('the window is measured back from the day being logged', () => {
  expect(suggestionWindowStart('2026-08-09', 60)).toBe('2026-06-10')
  // Across a year boundary, because a diary does not stop on the 1st.
  expect(suggestionWindowStart('2026-01-05', 60)).toBe('2025-11-06')
  // A date this cannot parse narrows to the day itself rather than quietly
  // widening the scan to the whole diary.
  expect(suggestionWindowStart('not a date')).toBe('not a date')
})

test('everything in the window is ranked, because a slot must not be spent early', () => {
  // Only a handful is ever *offered* (`MAX_MEAL_SUGGESTIONS`), but that cut is
  // the caller's to make once it has read the rows and dropped the ones that
  // cannot be logged. Cutting here would spend a slot on every deleted food
  // and never reach the good one behind it.
  const entries = Array.from({ length: 20 }, (_, i) =>
    entry('snack', '2026-08-01', { foodId: `food${i}` }),
  )
  expect(rankMealChoices(entries, { meal: 'snack' }).foodIds).toHaveLength(20)
  expect(MAX_MEAL_SUGGESTIONS).toBe(8)
})
