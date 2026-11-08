import { describe, expect, test } from 'vitest'
import { hrefTo, indexSurfaceOf, linkTo, moduleLink } from './links'

describe('in-app links', () => {
  test('a link is the route and its params', () => {
    expect(linkTo('home')).toEqual({ to: '/home', params: {} })
    expect(linkTo('recipe', { recipeId: 'r1' })).toEqual({
      to: '/recipes/$recipeId',
      params: { recipeId: 'r1' },
    })
    expect(moduleLink({ id: 'recipes' })).toEqual({
      to: '/recipes',
      params: {},
    })
  })

  test('a plain href fills in and encodes the params', () => {
    expect(hrefTo('recipe', { recipeId: 'r 1' })).toBe('/recipes/r%201')
  })

  test('finds the module index from a detail route', () => {
    expect(indexSurfaceOf('/recipes/r1/edit')).toBe('recipes')
    expect(indexSurfaceOf('/nutrition')).toBe('nutrition')
    expect(indexSurfaceOf('/settings')).toBeNull()
    expect(indexSurfaceOf('/g/old-group/recipes')).toBeNull()
  })
})
