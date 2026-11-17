import { describe, expect, it } from 'vitest'
import { scaleIngredient } from './scale'

const format = (value: number) =>
  new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(value)

describe('scaleIngredient', () => {
  it('scales a leading number, decimal, fraction and mixed number', () => {
    expect(scaleIngredient('2 eggs', 2, format)).toBe('4 eggs')
    expect(scaleIngredient('1,5 dl melk', 2, format)).toBe('3 dl melk')
    expect(scaleIngredient('1/2 cup sugar', 3, format)).toBe('1.5 cup sugar')
    expect(scaleIngredient('2 1/2 cups flour', 2, format)).toBe('5 cups flour')
    expect(scaleIngredient('½ lemon', 2, format)).toBe('1 lemon')
  })

  it('scales both ends of a range', () => {
    expect(scaleIngredient('2-3 cloves garlic', 2, format)).toBe(
      '4–6 cloves garlic',
    )
  })

  it('leaves a line without a leading quantity alone', () => {
    expect(scaleIngredient('Salt and pepper', 2, format)).toBe(
      'Salt and pepper',
    )
    expect(scaleIngredient('Juice of 1 lemon', 2, format)).toBe(
      'Juice of 1 lemon',
    )
  })

  it('changes nothing at factor 1', () => {
    expect(scaleIngredient('1,5 dl melk', 1, format)).toBe('1,5 dl melk')
  })
})
