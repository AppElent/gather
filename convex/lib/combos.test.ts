import { expect, test } from 'vitest'
import {
  type ComboComponent,
  comboEntries,
  countOf,
  isModified,
} from './combos'

const bread: ComboComponent = {
  id: 'item-bread',
  label: 'Wholemeal bread',
  quantity: 70,
  quantityUnit: 'g',
  foodId: 'food-bread',
  food: { baseUnit: 'g', nutritionPer100: { calories: 250, protein: 9 } },
  available: true,
}

const granola: ComboComponent = {
  id: 'item-granola',
  label: 'Nora’s granola',
  quantity: 1,
  quantityUnit: 'serving',
  recipeId: 'recipe-granola',
  recipe: { nutrition: { calories: 400 } },
  available: true,
}

const coffee: ComboComponent = {
  id: 'item-coffee',
  label: 'Flat white from the corner',
  quantity: 1,
  quantityUnit: 'piece',
  nutrition: { calories: 120 },
  available: true,
}

const lunch = [bread, granola, coffee]

test('a Combo logged as saved writes one entry per component', () => {
  expect(comboEntries(lunch)).toEqual([
    {
      foodId: 'food-bread',
      recipeId: undefined,
      label: 'Wholemeal bread',
      quantity: 70,
      quantityUnit: 'g',
      nutrition: { calories: 175, protein: 6.3 },
    },
    {
      foodId: undefined,
      recipeId: 'recipe-granola',
      label: 'Nora’s granola',
      quantity: 1,
      quantityUnit: 'serving',
      nutrition: { calories: 400 },
    },
    {
      foodId: undefined,
      recipeId: undefined,
      label: 'Flat white from the corner',
      quantity: 1,
      quantityUnit: 'piece',
      nutrition: { calories: 120 },
    },
  ])
})

test('a component stepped up counts its own serving again', () => {
  const [entry] = comboEntries([bread], { 'item-bread': 2 })
  expect(entry).toMatchObject({
    quantity: 140,
    nutrition: { calories: 350, protein: 12.6 },
  })
})

test('stepping a component to zero is how it is dropped', () => {
  expect(comboEntries(lunch, { 'item-coffee': 0 }).map((e) => e.label)).toEqual(
    ['Wholemeal bread', 'Nora’s granola'],
  )
})

test('a one-off scales from its own saved figures', () => {
  const [entry] = comboEntries([coffee], { 'item-coffee': 3 })
  expect(entry).toMatchObject({ quantity: 3, nutrition: { calories: 360 } })
})

test('nutrition comes from the food as it is now, not from what was saved', () => {
  // The reference is the point: correcting a food's figures corrects every
  // future log of every Combo containing it.
  const corrected = {
    ...bread,
    food: { baseUnit: 'g' as const, nutritionPer100: { calories: 300 } },
  }
  expect(comboEntries([corrected])[0].nutrition).toEqual({ calories: 210 })
})

test('a component nobody can reach any more logs nothing, and the rest still log', () => {
  const lostRecipe: ComboComponent = {
    ...granola,
    recipe: undefined,
    available: false,
  }
  expect(comboEntries([bread, lostRecipe, coffee]).map((e) => e.label)).toEqual(
    ['Wholemeal bread', 'Flat white from the corner'],
  )
})

test('a component with nothing behind it and no figures of its own is not logged', () => {
  const empty: ComboComponent = {
    id: 'item-empty',
    label: 'Something',
    quantity: 1,
    quantityUnit: 'piece',
    available: true,
  }
  expect(comboEntries([empty])).toEqual([])
})

test('a missing count means as saved', () => {
  expect(countOf({}, 'item-bread')).toBe(1)
  expect(countOf({ 'item-bread': 0 }, 'item-bread')).toBe(0)
})

test('a Combo is modified when any component is not as saved', () => {
  expect(isModified(lunch, {})).toBe(false)
  expect(isModified(lunch, { 'item-bread': 1 })).toBe(false)
  expect(isModified(lunch, { 'item-coffee': 0 })).toBe(true)
  expect(isModified(lunch, { 'item-bread': 2 })).toBe(true)
})
