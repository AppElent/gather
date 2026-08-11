import { expect, test } from 'vitest'
import { roundKcal, sumKcal } from './kcal'

test('rounds to the nearest whole kcal', () => {
  expect(roundKcal(221.34)).toBe(221)
  expect(roundKcal(397.5)).toBe(398)
  expect(roundKcal(0.4)).toBe(0)
})

test('leaves a figure that is already whole alone', () => {
  expect(roundKcal(300)).toBe(300)
  expect(roundKcal(0)).toBe(0)
})

test('adds up the figures it shows, not the ones it hides', () => {
  // Each 97.5 shows as 98, so the total that sits above them must be 196.
  // Rounding the sum instead would print 195 over two visible 98s.
  expect(sumKcal([{ calories: 97.5 }, { calories: 97.5 }])).toBe(196)
})

test('a meal is its rows added up, and a day is its meals added up', () => {
  const breakfast = [{ calories: 97.5 }, { calories: 12.4 }]
  const lunch = [{ calories: 250.5 }]
  const day = [...breakfast, ...lunch]

  const perMeal = [sumKcal(breakfast), sumKcal(lunch)]
  expect(perMeal).toEqual([110, 251])
  // The figure at the top of the page equals the figures down it, exactly.
  expect(sumKcal(day)).toBe(perMeal[0]! + perMeal[1]!)
})

test('skips entries with no calories rather than counting them as zero', () => {
  expect(sumKcal([{ calories: 100 }, { protein: 3 }])).toBe(100)
})

test('is undefined when nothing carries calories at all', () => {
  expect(sumKcal([])).toBeUndefined()
  expect(sumKcal([{ protein: 3 }])).toBeUndefined()
})
