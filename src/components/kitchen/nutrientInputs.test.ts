import { describe, expect, test } from 'vitest'
import { nutrientInputsToFacts, toNutrientInputs } from './nutrientInputs'

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
  test('builds a NutritionFacts object from parseable inputs, dropping empty, invalid and negative ones', () => {
    const inputs = toNutrientInputs({ calories: 520 })
    inputs.protein = '12,5'
    inputs.fat = 'oops'
    inputs.salt = '-1'
    expect(nutrientInputsToFacts(inputs)).toEqual({
      calories: 520,
      protein: 12.5,
    })
  })
  test('returns an empty object when nothing parses', () => {
    expect(nutrientInputsToFacts(toNutrientInputs(undefined))).toEqual({})
  })
})
