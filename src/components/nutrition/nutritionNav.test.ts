import { expect, test } from 'vitest'
import { groupNutritionNav } from './nutritionNav'

/**
 * Where Nutrition points *out* of itself.
 *
 * The Foods Catalog belongs to nobody and a Combo belongs to a person, so
 * neither destination's content depends on the Group in the URL — but both
 * addresses do, because a link that dropped the slug would quietly take
 * whoever followed it out of the Group they were reading (ADR-0002).
 */

test('the Foods catalog keeps the Group that was open', () => {
  expect(groupNutritionNav('jansen-household').foods).toEqual({
    to: '/foods',
    params: {},
  })
})

test('the Combos library keeps it too, though a Combo belongs to no Group', () => {
  expect(groupNutritionNav('me-alice').combos).toEqual({
    to: '/combos',
    params: {},
  })
})

test('the diary is what the Combos library comes back to', () => {
  expect(groupNutritionNav('me-alice').diary).toEqual({
    to: '/nutrition',
    params: {},
  })
})
