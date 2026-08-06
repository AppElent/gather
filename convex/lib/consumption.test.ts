import { expect, test } from 'vitest'
import {
  computeFoodEntryNutrition,
  computeRecipeEntryNutrition,
  scaleFacts,
  sumFacts,
} from './consumption'

test('scaleFacts multiplies present nutrients by the factor and rounds to 2 decimals', () => {
  expect(scaleFacts({ calories: 100, protein: 3.333 }, 1.5)).toEqual({
    calories: 150,
    protein: 5,
  })
})

test('scaleFacts omits nutrients absent from the input', () => {
  expect(scaleFacts({ calories: 200 }, 2)).toEqual({ calories: 400 })
})

test('sumFacts sums nutrients present in at least one entry, treating absence as zero', () => {
  expect(
    sumFacts([{ calories: 100, protein: 5 }, { calories: 50 }, { fiber: 2 }]),
  ).toEqual({ calories: 150, protein: 5, fiber: 2 })
})

test('sumFacts returns an empty object for an empty list', () => {
  expect(sumFacts([])).toEqual({})
})

test('computeRecipeEntryNutrition scales per-serving nutrition by quantity in servings', () => {
  expect(computeRecipeEntryNutrition({ calories: 400, protein: 20 }, 2)).toEqual({
    calories: 800,
    protein: 40,
  })
})

test('computeFoodEntryNutrition scales per-100 nutrition directly for g/ml quantities', () => {
  const food = { nutritionPer100: { calories: 250, fat: 10 } }
  expect(computeFoodEntryNutrition(food, 150, 'g')).toEqual({
    calories: 375,
    fat: 15,
  })
})

test('computeFoodEntryNutrition counts the food’s own portion for piece quantities', () => {
  // A 'piece' is one of the food's first named serving — what the single
  // `servingSize` field became (#68/#71). 2 × 30 g = 60 g → 300 kcal.
  const food = {
    nutritionPer100: { calories: 500 },
    servings: [{ label: '1 piece', amount: 30 }],
  }
  expect(computeFoodEntryNutrition(food, 2, 'piece')).toEqual({ calories: 300 })
})

test('computeFoodEntryNutrition has nothing to count when a food declares no serving', () => {
  const food = { nutritionPer100: { calories: 500 } }
  expect(computeFoodEntryNutrition(food, 3, 'piece')).toEqual({ calories: 0 })
})
