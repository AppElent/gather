import { describe, expect, test } from 'vitest'
import { type BabyNav, groupBabyNav } from '../components/baby/babyNav'
import { type FoodNav, groupFoodNav } from '../components/foods/foodNav'
import { groupRecipeNav, type RecipeNav } from '../components/recipes/recipeNav'
import { groupTaskNav, type TaskNav } from '../components/tasks/taskNav'
import type { AppLink } from './appLink'

/**
 * The regression these guard against: a link that still spells out a Group.
 * The Current Group is ambient (ADR-0031) and `/g/<slug>/…` addresses 404, so
 * a destination that names one leads nowhere.
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
    nav.create({ barcode: '3017620422003' }),
    nav.detail('f1'),
    nav.edit('f1'),
  ]
}

function babyDestinations(nav: BabyNav): AppLink[] {
  return [nav.list, nav.create, nav.detail('b1'), nav.edit('b1')]
}

function taskDestinations(nav: TaskNav): AppLink[] {
  return [nav.list]
}

/** One row per Module, holding every destination its nav can produce. */
const MODULES: Array<{ module: string; group: AppLink[] }> = [
  { module: 'Recipes', group: recipeDestinations(groupRecipeNav(SLUG)) },
  { module: 'Foods', group: foodDestinations(groupFoodNav(SLUG)) },
  { module: 'Baby log', group: babyDestinations(groupBabyNav(SLUG)) },
  { module: 'Tasks', group: taskDestinations(groupTaskNav(SLUG)) },
]

function paramsOf(link: AppLink): Record<string, unknown> {
  return typeof link.params === 'object' && link.params !== null
    ? link.params
    : {}
}

describe('links built for a Group', () => {
  test.each(MODULES)('no $module destination names it', ({ group }) => {
    expect(group.length).toBeGreaterThan(0)
    for (const link of group) {
      expect(String(link.to).startsWith('/')).toBe(true)
      expect(String(link.to)).not.toContain('/g/')
      expect(paramsOf(link)).not.toHaveProperty('groupSlug')
    }
  })

  test('a record id reaches the destination alongside the Group', () => {
    expect(paramsOf(groupRecipeNav(SLUG).detail('r1')).recipeId).toBe('r1')
    expect(paramsOf(groupRecipeNav(SLUG).edit('r1')).recipeId).toBe('r1')
    expect(paramsOf(groupFoodNav(SLUG).detail('f1')).foodId).toBe('f1')
    expect(paramsOf(groupFoodNav(SLUG).edit('f1')).foodId).toBe('f1')
    expect(paramsOf(groupBabyNav(SLUG).detail('b1')).babyId).toBe('b1')
    expect(paramsOf(groupBabyNav(SLUG).edit('b1')).babyId).toBe('b1')
  })

  // The OAuth round-trip cannot carry link options through sessionStorage and
  // a full page load, so Tasks hands out a plain path. The Group survives the
  // round-trip in client storage, not in that path.
  test('the OAuth return path is the ambient Tasks page', () => {
    expect(groupTaskNav(SLUG).returnTo).toBe('/tasks')
  })

  test('a search param survives being given the Group treatment', () => {
    expect(
      groupFoodNav(SLUG).create({ barcode: '3017620422003' }).search,
    ).toEqual({ barcode: '3017620422003' })
  })
})
