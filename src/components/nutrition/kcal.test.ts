import { expect, test } from 'vitest'
import { roundKcal } from './kcal'

test('rounds to the nearest whole kcal', () => {
  expect(roundKcal(221.34)).toBe(221)
  expect(roundKcal(397.5)).toBe(398)
  expect(roundKcal(0.4)).toBe(0)
})

test('leaves a figure that is already whole alone', () => {
  expect(roundKcal(300)).toBe(300)
  expect(roundKcal(0)).toBe(0)
})
