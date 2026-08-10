import { describe, expect, test } from 'vitest'
import {
  GROUP_MODULE_INDEX_SURFACES,
  groupHref,
  groupIndexSurfaceOf,
  groupLink,
  groupSlugOf,
  groupSurfaceForModule,
  moduleLink,
} from './groupPaths'
import { MODULES } from './modules'

describe('building a Group URL', () => {
  test('gives link options the router can check the route of', () => {
    expect(groupLink('home', 'jansen-household')).toEqual({
      to: '/g/$groupSlug',
      params: { groupSlug: 'jansen-household' },
    })
    expect(groupLink('nutrition', 'me-alice')).toEqual({
      to: '/g/$groupSlug/nutrition',
      params: { groupSlug: 'me-alice' },
    })
  })

  test('carries the Group alongside a record id, never instead of it', () => {
    expect(groupLink('recipe', 'jansen-household', { recipeId: 'r1' })).toEqual(
      {
        to: '/g/$groupSlug/recipes/$recipeId',
        params: { groupSlug: 'jansen-household', recipeId: 'r1' },
      },
    )
    expect(
      groupLink('editRecipe', 'jansen-household', { recipeId: 'r1' }),
    ).toEqual({
      to: '/g/$groupSlug/recipes/$recipeId/edit',
      params: { groupSlug: 'jansen-household', recipeId: 'r1' },
    })
  })

  test('gives the same destination as a string', () => {
    expect(groupHref('home', 'jansen-household')).toBe('/g/jansen-household')
    expect(groupHref('nutrition', 'me-alice')).toBe('/g/me-alice/nutrition')
    expect(groupHref('recipe', 'me-alice', { recipeId: 'r1' })).toBe(
      '/g/me-alice/recipes/r1',
    )
    expect(groupHref('editRecipe', 'me-alice', { recipeId: 'r1' })).toBe(
      '/g/me-alice/recipes/r1/edit',
    )
  })

  // Both destinations Nutrition points at are Group-scoped addresses holding
  // content that is not the Group's: the Catalog belongs to nobody and a Combo
  // belongs to a person. The slug rides along so following the link cannot
  // move anybody between Groups (ADR-0002).
  test('gives the Combos library and the Catalog addresses inside the Group', () => {
    expect(groupHref('combos', 'me-alice')).toBe('/g/me-alice/combos')
    expect(groupHref('foods', 'me-alice')).toBe('/g/me-alice/foods')
  })

  test('escapes every param on its way into a string path', () => {
    expect(groupHref('nutrition', 'a b')).toBe('/g/a%20b/nutrition')
    expect(groupHref('recipe', 'a b', { recipeId: 'r 1' })).toBe(
      '/g/a%20b/recipes/r%201',
    )
  })

  test('every Module index produces a path under the Group prefix', () => {
    for (const surface of GROUP_MODULE_INDEX_SURFACES) {
      const href = groupHref(surface, 'wine-club')
      expect(href.startsWith('/g/wine-club')).toBe(true)
      expect(href).not.toContain('$')
    }
  })

  // A Module index is a front page, so it is one segment deep and no more.
  // `/recipes/new` also needs no parameter, and listing it here would make the
  // switcher land people on a blank form when they change Group.
  test('a Module index is never deeper than its Module', () => {
    for (const surface of GROUP_MODULE_INDEX_SURFACES) {
      const suffix = groupHref(surface, 'wine-club').replace('/g/wine-club', '')
      expect(suffix.split('/').filter(Boolean).length).toBeLessThanOrEqual(1)
    }
  })
})

describe('reading a Group URL', () => {
  test('finds the Group a path is in', () => {
    expect(groupSlugOf('/g/jansen-household')).toBe('jansen-household')
    expect(groupSlugOf('/g/jansen-household/nutrition')).toBe(
      'jansen-household',
    )
    expect(groupSlugOf('/g/a%20b/nutrition')).toBe('a b')
  })

  test('says nothing for a path with no Group in it', () => {
    for (const path of ['/', '/nutrition', '/settings', '/g', '/g/']) {
      expect(groupSlugOf(path)).toBeNull()
      expect(groupIndexSurfaceOf(path)).toBeNull()
    }
  })

  test('finds the Module a path is in, whichever Group it is in', () => {
    expect(groupIndexSurfaceOf('/g/jansen-household')).toBe('home')
    expect(groupIndexSurfaceOf('/g/jansen-household/')).toBe('home')
    expect(groupIndexSurfaceOf('/g/me-alice/nutrition')).toBe('nutrition')
    expect(groupIndexSurfaceOf('/g/me-alice/nutrition/')).toBe('nutrition')
    expect(groupIndexSurfaceOf('/g/me-alice/recipes')).toBe('recipes')
  })

  // Switching Groups from a detail page must not carry the id across: a recipe
  // id names something in one Group, so asking another Group for it is a dead
  // end at best.
  test('answers with the Module index, never the page you were on', () => {
    expect(groupIndexSurfaceOf('/g/me-alice/recipes/r1')).toBe('recipes')
    expect(groupIndexSurfaceOf('/g/me-alice/recipes/r1/edit')).toBe('recipes')
    expect(groupIndexSurfaceOf('/g/me-alice/recipes/new')).toBe('recipes')
  })

  test('finds a placeholder Module the same way as a built one', () => {
    expect(groupIndexSurfaceOf('/g/jansen-household/wines')).toBe('wines')
    expect(groupIndexSurfaceOf('/g/jansen-household/meal-planner')).toBe(
      'mealPlanner',
    )
  })

  test('says nothing for a Group page that is nobody’s Module', () => {
    expect(groupIndexSurfaceOf('/g/jansen-household/seances')).toBeNull()
  })

  // What the switcher relies on: read the Module off one Group's URL, write it
  // back out for another, and land on the same Module in the new Group.
  test('round-trips a Module from one Group to another', () => {
    for (const surface of GROUP_MODULE_INDEX_SURFACES) {
      const here = groupHref(surface, 'jansen-household')
      const there = groupHref(groupIndexSurfaceOf(here) ?? 'home', 'wine-club')
      expect(there).toBe(groupHref(surface, 'wine-club'))
    }
  })
})

/**
 * The shell's Module links are the ones a route cannot build, because the
 * sidebar and the command palette are on screen whichever page is showing.
 * They are therefore the likeliest place for a Group to be dropped, and the
 * cheapest place to catch it.
 */
describe('a Module link from the shell', () => {
  const recipes = { id: 'recipes' }
  const wines = { id: 'wines' }

  test('stays in the Group you are already in', () => {
    expect(moduleLink(recipes, 'jansen-household')).toEqual({
      to: '/g/$groupSlug/recipes',
      params: { groupSlug: 'jansen-household' },
    })
  })

  test('keeps a placeholder Module in the Group too', () => {
    expect(moduleLink(wines, 'jansen-household')).toEqual({
      to: '/g/$groupSlug/wines',
      params: { groupSlug: 'jansen-household' },
    })
  })

  // An id no Module declares cannot be a page, so it goes to the one page that
  // lists every Module there is rather than to a route that does not exist.
  test('sends an id nothing declares to All', () => {
    expect(moduleLink({ id: 'seances' }, 'jansen-household')).toEqual({
      to: '/g/$groupSlug/all',
      params: { groupSlug: 'jansen-household' },
    })
  })

  // The totality `moduleLink` now depends on: there is no flat surface left to
  // fall back to, so a Module with no Group destination would be a Module the
  // sidebar and the palette cannot link to at all.
  test('every Module has somewhere to go inside a Group', () => {
    const homeless = MODULES.filter((m) => groupSurfaceForModule(m.id) === null)
    expect(homeless.map((m) => m.id)).toEqual([])
  })
})
