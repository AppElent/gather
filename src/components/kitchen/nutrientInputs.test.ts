import { describe, expect, test } from 'vitest'
import {
  nutrientInputsToFacts,
  parseDecimal,
  toNutrientInputs,
} from './nutrientInputs'

describe('parseDecimal', () => {
  test('parses plain and Dutch-comma decimals', () => {
    expect(parseDecimal('12.5')).toBe(12.5)
    expect(parseDecimal('12,5')).toBe(12.5)
  })
  test('rejects empty, whitespace-only, negative, and garbage input', () => {
    expect(parseDecimal('')).toBeUndefined()
    expect(parseDecimal('   ')).toBeUndefined()
    expect(parseDecimal('-1')).toBeUndefined()
    expect(parseDecimal('abc')).toBeUndefined()
  })
})

describe('toNutrientInputs', () => {
  test('stringifies present values and leaves absent ones as empty strings', () => {
    expect(toNutrientInputs({ calories: 520, protein: 12.5 })).toEqual({
      calories: '520',
      protein: '12.5',
      carbs: '',
      sugars: '',
      fat: '',
      saturatedFat: '',
      fiber: '',
      salt: '',
    })
  })
  test('returns all-empty strings for undefined input', () => {
    expect(toNutrientInputs(undefined)).toEqual({
      calories: '',
      protein: '',
      carbs: '',
      sugars: '',
      fat: '',
      saturatedFat: '',
      fiber: '',
      salt: '',
    })
  })
})

describe('nutrientInputsToFacts', () => {
  test('builds a NutritionFacts object from parseable inputs, dropping empty/invalid ones', () => {
    const inputs = toNutrientInputs({ calories: 520 })
    inputs.protein = '12,5'
    inputs.fat = 'oops'
    expect(nutrientInputsToFacts(inputs)).toEqual({
      calories: 520,
      protein: 12.5,
    })
  })
  test('returns an empty object when nothing parses', () => {
    expect(nutrientInputsToFacts(toNutrientInputs(undefined))).toEqual({})
  })
})
