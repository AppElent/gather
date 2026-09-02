import { MODULES } from '@gather/core/modules'
import { describe, expect, test } from 'vitest'
import {
  GROUP_MODULE_INDEX_SURFACES,
  groupHref,
  groupIndexSurfaceOf,
  groupLink,
  groupSurfaceForModule,
  moduleLink,
} from './groupPaths'

describe('ambient Group routes', () => {
  test('does not encode a Group identity into any route', () => {
    expect(groupLink('home', 'ignored')).toEqual({ to: '/home', params: {} })
    expect(groupLink('recipe', 'ignored', { recipeId: 'r1' })).toEqual({
      to: '/recipes/$recipeId',
      params: { recipeId: 'r1' },
    })
    expect(groupHref('recipe', 'ignored', { recipeId: 'r 1' })).toBe('/recipes/r%201')
  })

  test('finds the module index from an ambient detail route', () => {
    expect(groupIndexSurfaceOf('/recipes/r1/edit')).toBe('recipes')
    expect(groupIndexSurfaceOf('/nutrition')).toBe('nutrition')
    expect(groupIndexSurfaceOf('/settings')).toBeNull()
    expect(groupIndexSurfaceOf('/g/old-group/recipes')).toBeNull()
  })

  test('all module links are top-level routes', () => {
    for (const surface of GROUP_MODULE_INDEX_SURFACES) {
      expect(groupHref(surface, 'ignored')).not.toContain('/g/')
    }
    expect(moduleLink({ id: 'recipes' }, 'ignored')).toEqual({
      to: '/recipes',
      params: {},
    })
    expect(MODULES.filter((m) => groupSurfaceForModule(m.id) === null)).toEqual([])
  })
})
