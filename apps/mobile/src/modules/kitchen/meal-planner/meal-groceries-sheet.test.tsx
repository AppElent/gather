// @vitest-environment jsdom
/**
 * The meal sheet's "Groceries for this recipe" loads the meal's Recipe by id,
 * so a meal just moved to another week still opens the add-to-groceries sheet
 * (APP-435), at the meal's servings.
 */
import { createElement } from 'react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { mount } from '../../../testing/dom'
import { MealGroceriesSheet } from './meal-groceries-sheet'

const state = vi.hoisted(() => ({
  recipe: undefined as unknown,
  calls: [] as { query: unknown; args: unknown }[],
}))

vi.mock('../../../convex/api', () => ({
  api: {
    recipes: { get: 'recipes.get' },
    mealPlan: { weekIngredients: 'mealPlan.weekIngredients' },
  },
}))
vi.mock('../../../convex/queries', () => ({
  useQuery: (query: unknown, args: unknown) => {
    state.calls.push({ query, args })
    return state.recipe
  },
}))
vi.mock('../../../group/GroupProvider', () => ({
  useGroup: () => ({ group: { slug: 'home' } }),
}))
vi.mock('../add-to-groceries/recipe-sheet', () => ({
  RecipeToGroceriesSheet: ({
    recipe,
    startServings,
  }: {
    recipe: { title: string }
    startServings?: number
  }) =>
    createElement(
      'div',
      { 'data-testid': 'sheet', 'data-servings': String(startServings) },
      recipe.title,
    ),
}))

const recipe = {
  _id: 'recipe_1',
  title: 'Lasagne',
  servings: 4,
  ingredients: ['500 g gehakt'],
}

afterEach(() => {
  state.recipe = undefined
  state.calls = []
  document.body.innerHTML = ''
})

describe('MealGroceriesSheet', () => {
  test('loads the Recipe by id, not from the visible week', () => {
    state.recipe = recipe
    const { container } = mount(
      createElement(MealGroceriesSheet, {
        recipeId: 'recipe_1',
        servings: 3,
        onClose: () => {},
      }),
    )
    expect(state.calls.at(-1)).toEqual({
      query: 'recipes.get',
      args: { id: 'recipe_1', groupSlug: 'home' },
    })
    const sheet = container.querySelector('[data-testid="sheet"]')
    expect(sheet?.textContent).toBe('Lasagne')
    expect(sheet?.getAttribute('data-servings')).toBe('3')
  })

  test('renders nothing while loading or when the Recipe is gone', () => {
    for (const value of [undefined, null]) {
      state.recipe = value
      const { container, unmount } = mount(
        createElement(MealGroceriesSheet, {
          recipeId: 'recipe_1',
          servings: 2,
          onClose: () => {},
        }),
      )
      expect(container.querySelector('[data-testid="sheet"]')).toBeNull()
      unmount()
    }
  })
})
