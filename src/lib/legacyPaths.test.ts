import { describe, expect, test } from 'vitest'
import { groupSurfaceForModule } from './groupPaths'
import { legacyTarget } from './legacyPaths'
import { MODULES } from './modules'

/**
 * Every address the app used to answer to, and where it answers from now.
 *
 * This table is the record of what the flat routes were: the route files are
 * deleted, so nothing else in the repo remembers. It is exhaustive on purpose —
 * a path missing from here is a bookmark that silently lands on Home instead of
 * where it used to.
 */
const SLUG = 'jansen-household'

const INDEXES: Array<[string, string]> = [
  ['/dashboard', 'home'],
  ['/recipes', 'recipes'],
  ['/recipes/new', 'newRecipe'],
  ['/foods', 'foods'],
  ['/foods/new', 'newFood'],
  ['/baby', 'baby'],
  ['/baby/new', 'newChild'],
  ['/nutrition', 'nutrition'],
  ['/tasks', 'tasks'],
  ['/meal-planner', 'mealPlanner'],
  ['/groceries', 'groceries'],
  ['/pantry', 'pantry'],
  ['/finances', 'finances'],
  ['/bills', 'bills'],
  ['/calendar', 'calendar'],
  ['/notes', 'notes'],
  ['/cheeses', 'cheeses'],
  ['/wines', 'wines'],
]

describe('an old address with a Group-scoped equivalent', () => {
  test.each(INDEXES)('%s becomes %s', (path, surface) => {
    expect(legacyTarget(path)?.surface).toBe(surface)
  })

  test.each(INDEXES)('%s survives a trailing slash', (path, surface) => {
    expect(legacyTarget(`${path}/`)?.surface).toBe(surface)
  })

  test('lands inside the Group it is given, and nowhere else', () => {
    for (const [path] of INDEXES) {
      const link = legacyTarget(path)?.link(SLUG)
      expect(String(link?.to).startsWith('/g/$groupSlug')).toBe(true)
      expect(link?.params).toMatchObject({ groupSlug: SLUG })
    }
  })

  // The half of the address that names a record, which is the half a hand-built
  // redirect drops.
  test('carries a record id across with the Group', () => {
    expect(legacyTarget('/recipes/r1')?.link(SLUG)).toEqual({
      to: '/g/$groupSlug/recipes/$recipeId',
      params: { groupSlug: SLUG, recipeId: 'r1' },
    })
    expect(legacyTarget('/recipes/r1/edit')?.link(SLUG)).toEqual({
      to: '/g/$groupSlug/recipes/$recipeId/edit',
      params: { groupSlug: SLUG, recipeId: 'r1' },
    })
    expect(legacyTarget('/foods/f1')?.link(SLUG)).toEqual({
      to: '/g/$groupSlug/foods/$foodId',
      params: { groupSlug: SLUG, foodId: 'f1' },
    })
    expect(legacyTarget('/foods/f1/edit')?.link(SLUG)).toEqual({
      to: '/g/$groupSlug/foods/$foodId/edit',
      params: { groupSlug: SLUG, foodId: 'f1' },
    })
    expect(legacyTarget('/baby/b1')?.link(SLUG)).toEqual({
      to: '/g/$groupSlug/baby/$babyId',
      params: { groupSlug: SLUG, babyId: 'b1' },
    })
    expect(legacyTarget('/baby/b1/edit')?.link(SLUG)).toEqual({
      to: '/g/$groupSlug/baby/$babyId/edit',
      params: { groupSlug: SLUG, babyId: 'b1' },
    })
  })

  test('reads a record id back out of its encoded form once', () => {
    expect(legacyTarget('/recipes/r%201')?.link(SLUG).params).toMatchObject({
      recipeId: 'r 1',
    })
  })

  test('a record id survives a trailing slash too', () => {
    expect(legacyTarget('/recipes/r1/')?.link(SLUG).params).toMatchObject({
      recipeId: 'r1',
    })
  })

  // `new` is a create form, not a record called "new".
  test('tells a create form apart from a record', () => {
    expect(legacyTarget('/recipes/new')?.surface).toBe('newRecipe')
    expect(legacyTarget('/foods/new')?.surface).toBe('newFood')
    expect(legacyTarget('/baby/new')?.surface).toBe('newChild')
  })

  /**
   * The criterion in full: not "these paths work" but "no Module was left
   * behind". Every Module's front page had a flat address, and every one of
   * those addresses has to reach the same Module's Group surface.
   */
  test('leaves no Module without a way back to it', () => {
    const reached = new Set(
      INDEXES.map(([path]) => legacyTarget(path)?.surface),
    )
    const missing = MODULES.filter((module) => {
      const surface = groupSurfaceForModule(module.id)
      return surface === null || !reached.has(surface)
    })
    expect(missing.map((module) => module.id)).toEqual([])
  })
})

describe('an old address with no equivalent', () => {
  // Null is the answer the caller turns into Home. Erroring on a link somebody
  // kept is the one outcome that helps nobody.
  test.each([
    '/',
    '',
    '/seances',
    '/recipes/r1/edit/twice',
    '/recipes/r1/notes',
    '/baby/b1/weigh',
    '/dashboard/extra',
    '/nutrition/today',
    '/wines/w1',
  ])('%s has nothing to redirect to', (path) => {
    expect(legacyTarget(path)).toBeNull()
  })

  test('does not mistake a Group address for a legacy one', () => {
    expect(legacyTarget(`/g/${SLUG}`)).toBeNull()
    expect(legacyTarget(`/g/${SLUG}/recipes`)).toBeNull()
  })

  // The shell's own pages stayed flat and unscoped, so the splat must never see
  // them — but if it somehow does, sending them to Home is better than a loop.
  test('claims none of the pages that are still flat', () => {
    for (const path of ['/settings', '/account', '/groups']) {
      expect(legacyTarget(path)).toBeNull()
    }
  })
})
