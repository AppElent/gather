import { describe, expect, test } from 'vitest'
import {
  nextNutritionStale,
  parseNutritionValue,
  parseServings,
  sanitizeNutrition,
} from './nutrition'

describe('parseNutritionValue', () => {
  test('accepts plain non-negative numbers', () => {
    expect(parseNutritionValue(250)).toBe(250)
    expect(parseNutritionValue(0)).toBe(0)
  })
  test('rejects negative and non-finite numbers', () => {
    expect(parseNutritionValue(-5)).toBeUndefined()
    expect(parseNutritionValue(Number.NaN)).toBeUndefined()
  })
  test('parses unit-suffixed strings', () => {
    expect(parseNutritionValue('250 kcal')).toBe(250)
    expect(parseNutritionValue('31g')).toBe(31)
  })
  test('parses Dutch comma decimals', () => {
    expect(parseNutritionValue('12,5 g')).toBe(12.5)
  })
  test('treats comma before exactly three digits as thousands separator', () => {
    expect(parseNutritionValue('1,200 kcal')).toBe(1200)
  })
  test('converts kJ to kcal', () => {
    expect(parseNutritionValue('1046 kJ')).toBe(250)
  })
  test('converts mg to g', () => {
    expect(parseNutritionValue('740 mg')).toBe(0.74)
  })
  test('rejects garbage, empty, and negative strings', () => {
    expect(parseNutritionValue('trace')).toBeUndefined()
    expect(parseNutritionValue('')).toBeUndefined()
    expect(parseNutritionValue('-5 g')).toBeUndefined()
    expect(parseNutritionValue(null)).toBeUndefined()
    expect(parseNutritionValue(undefined)).toBeUndefined()
  })
})

describe('parseServings', () => {
  test('accepts positive numbers, rounding to integer', () => {
    expect(parseServings(4)).toBe(4)
    expect(parseServings(4.5)).toBe(5)
  })
  test('parses numeric strings and "4 personen"', () => {
    expect(parseServings('4')).toBe(4)
    expect(parseServings('4 personen')).toBe(4)
    expect(parseServings('12 stuks')).toBe(12)
  })
  test('takes the lower bound of a range', () => {
    expect(parseServings('4-6')).toBe(4)
  })
  test('takes the first parseable entry of an array', () => {
    expect(parseServings(['4 servings', '1 pie'])).toBe(4)
  })
  test('rejects zero, huge values, and garbage', () => {
    expect(parseServings(0)).toBeUndefined()
    expect(parseServings('1000 ml')).toBeUndefined()
    expect(parseServings('een taart')).toBeUndefined()
    expect(parseServings(undefined)).toBeUndefined()
  })
})

describe('sanitizeNutrition', () => {
  test('keeps known keys with valid numbers', () => {
    expect(sanitizeNutrition({ calories: 520, protein: 31.5 })).toEqual({
      calories: 520,
      protein: 31.5,
    })
  })
  test('drops negatives, strings, and unknown keys', () => {
    expect(
      sanitizeNutrition({ calories: -1, protein: '31', bogus: 5, fat: 10 }),
    ).toEqual({ fat: 10 })
  })
  test('returns undefined for empty or non-object input', () => {
    expect(sanitizeNutrition({})).toBeUndefined()
    expect(sanitizeNutrition({ calories: 'x' })).toBeUndefined()
    expect(sanitizeNutrition(null)).toBeUndefined()
    expect(sanitizeNutrition('food')).toBeUndefined()
  })
})

describe('nextNutritionStale', () => {
  const base = {
    ingredients: ['200 g flour', '2 eggs'],
    servings: 4,
    nutrition: { calories: 300 },
  }
  test('false when the recipe has no nutrition', () => {
    expect(
      nextNutritionStale(
        { ...base, nutrition: undefined },
        { ...base, ingredients: ['bread'], nutrition: undefined },
      ),
    ).toBe(false)
  })
  test('true when ingredients change and nutrition does not', () => {
    expect(
      nextNutritionStale(base, { ...base, ingredients: ['300 g flour'] }),
    ).toBe(true)
  })
  test('true when servings change and nutrition does not', () => {
    expect(nextNutritionStale(base, { ...base, servings: 6 })).toBe(true)
  })
  test('false when nothing relevant changes', () => {
    expect(nextNutritionStale(base, { ...base })).toBe(false)
  })
  test('false (clears) when nutrition changes in the same save', () => {
    expect(
      nextNutritionStale(
        { ...base, nutritionStale: true },
        {
          ...base,
          ingredients: ['300 g flour'],
          nutrition: { calories: 400 },
        },
      ),
    ).toBe(false)
  })
  test('false (clears) when nutrition is removed', () => {
    expect(
      nextNutritionStale({ ...base, nutritionStale: true }, { ...base, nutrition: undefined }),
    ).toBe(false)
  })
  test('stays true while stale and nutrition untouched', () => {
    expect(nextNutritionStale({ ...base, nutritionStale: true }, { ...base })).toBe(
      true,
    )
  })
})
