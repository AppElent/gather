import { describe, expect, test } from 'vitest'
import { type BabyNav, groupBabyNav } from '../components/baby/babyNav'
import { type FoodNav, groupFoodNav } from '../components/foods/foodNav'
import { groupRecipeNav, type RecipeNav } from '../components/recipes/recipeNav'
import { groupTaskNav, type TaskNav } from '../components/tasks/taskNav'
import type { AppLink } from './appLink'

/**
 * The regression these guard against: a link inside a page written without the
 * Group, so following it leaves the Group the reader opened — which, now that
 * the flat routes are gone, means leaving for an address that no longer exists.
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
    expect(paramsOf(groupBabyNav(SLUG).detail('b1')).babyId).toBe('b1')
    expect(paramsOf(groupBabyNav(SLUG).edit('b1')).babyId).toBe('b1')
  })

  // The OAuth round-trip cannot carry link options through sessionStorage and
  // a full page load, so Tasks hands out a plain path. It still has to name the
  // Group, or connecting Notion lands the reader outside the Group they left.
  test('the OAuth return path names the Group too', () => {
    expect(groupTaskNav(SLUG).returnTo).toBe(`/g/${SLUG}/tasks`)
  })

  test('a search param survives being given the Group treatment', () => {
    expect(
      groupFoodNav(SLUG).create({ barcode: '3017620422003' }).search,
    ).toEqual({ barcode: '3017620422003' })
  })
})
