import { describe, expect, test } from 'vitest'
import {
  type FoodNav,
  flatFoodNav,
  groupFoodNav,
} from '../components/foods/foodNav'
import {
  flatRecipeNav,
  groupRecipeNav,
  type RecipeNav,
} from '../components/recipes/recipeNav'
import type { AppLink } from './appLink'

/**
 * The regression this ticket most plausibly causes: a link inside a page that
 * both route trees render, written against the flat path, so following it drops
 * you out of the Group you were in.
 *
 * The pages take every destination as props, so the mistake can only be made in
 * a nav builder — which means it can be caught here, off the built link options,
 * without rendering anything or crawling markup for anchors.
 */

const SLUG = 'jansen-household'

function recipeDestinations(nav: RecipeNav): AppLink[] {
  return [nav.list, nav.create, nav.detail('r1'), nav.edit('r1')]
}

function foodDestinations(nav: FoodNav): AppLink[] {
  return [
    nav.list,
    nav.create(),
    nav.create('3017620422003'),
    nav.detail('f1'),
    nav.edit('f1'),
  ]
}

/** One row per Module, holding every destination its two navs can produce. */
const MODULES: Array<{
  module: string
  flatPrefix: string
  flat: AppLink[]
  group: AppLink[]
}> = [
  {
    module: 'Recipes',
    flatPrefix: '/recipes',
    flat: recipeDestinations(flatRecipeNav),
    group: recipeDestinations(groupRecipeNav(SLUG)),
  },
  {
    module: 'Foods',
    flatPrefix: '/foods',
    flat: foodDestinations(flatFoodNav),
    group: foodDestinations(groupFoodNav(SLUG)),
  },
]

function paramsOf(link: AppLink): Record<string, unknown> {
  return typeof link.params === 'object' && link.params !== null
    ? link.params
    : {}
}

describe('links built for a Group', () => {
  test.each(MODULES)('every $module destination carries it', ({ group }) => {
    expect(group.length).toBeGreaterThan(0)
    for (const link of group) {
      expect(String(link.to).startsWith('/g/$groupSlug/')).toBe(true)
      expect(paramsOf(link).groupSlug).toBe(SLUG)
    }
  })

  test('a record id reaches the destination alongside the Group', () => {
    expect(paramsOf(groupRecipeNav(SLUG).detail('r1')).recipeId).toBe('r1')
    expect(paramsOf(groupRecipeNav(SLUG).edit('r1')).recipeId).toBe('r1')
    expect(paramsOf(groupFoodNav(SLUG).detail('f1')).foodId).toBe('f1')
    expect(paramsOf(groupFoodNav(SLUG).edit('f1')).foodId).toBe('f1')
  })

  test('a search param survives being given the Group treatment', () => {
    expect(groupFoodNav(SLUG).create('3017620422003').search).toEqual({
      barcode: '3017620422003',
    })
  })
})

describe('links built outside any Group', () => {
  test.each(MODULES)('every $module destination stays flat', ({
    flat,
    flatPrefix,
  }) => {
    for (const link of flat) {
      expect(String(link.to).startsWith(flatPrefix)).toBe(true)
      expect(paramsOf(link).groupSlug).toBeUndefined()
    }
  })
})
