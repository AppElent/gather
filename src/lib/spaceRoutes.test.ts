import { describe, expect, test } from 'vitest'
import { MODULES } from './modules'
import { assertValidModulePathSegment, spacePath } from './spaceRoutes'

describe('Space route builders', () => {
  test('builds a Space-scoped module path', () => {
    expect(spacePath.module('wine-club', 'recipes')).toBe(
      '/s/wine-club/recipes',
    )
  })

  test('rejects reserved path segments', () => {
    expect(() => assertValidModulePathSegment('settings')).toThrow(
      'settings is reserved',
    )
  })

  test('all catalog path segments are valid and non-reserved', () => {
    for (const module of MODULES) {
      expect(() =>
        assertValidModulePathSegment(module.pathSegment),
      ).not.toThrow()
    }
  })
})
