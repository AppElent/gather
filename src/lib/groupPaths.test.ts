import { describe, expect, test } from 'vitest'
import {
  GROUP_SURFACES,
  groupHref,
  groupLink,
  groupSlugOf,
  groupSurfaceOf,
} from './groupPaths'

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

  test('gives the same destination as a string', () => {
    expect(groupHref('home', 'jansen-household')).toBe('/g/jansen-household')
    expect(groupHref('nutrition', 'me-alice')).toBe('/g/me-alice/nutrition')
  })

  test('escapes a slug on its way into a string path', () => {
    expect(groupHref('nutrition', 'a b')).toBe('/g/a%20b/nutrition')
  })

  test('every surface produces a path under the Group prefix', () => {
    for (const surface of GROUP_SURFACES) {
      expect(groupHref(surface, 'wine-club').startsWith('/g/wine-club')).toBe(
        true,
      )
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
    for (const path of ['/', '/nutrition', '/dashboard', '/g', '/g/']) {
      expect(groupSlugOf(path)).toBeNull()
      expect(groupSurfaceOf(path)).toBeNull()
    }
  })

  test('finds the surface a path is on, whichever Group it is in', () => {
    expect(groupSurfaceOf('/g/jansen-household')).toBe('home')
    expect(groupSurfaceOf('/g/jansen-household/')).toBe('home')
    expect(groupSurfaceOf('/g/me-alice/nutrition')).toBe('nutrition')
    expect(groupSurfaceOf('/g/me-alice/nutrition/')).toBe('nutrition')
  })

  test('says nothing for a Group page that has no Group-scoped route yet', () => {
    expect(groupSurfaceOf('/g/jansen-household/recipes')).toBeNull()
  })

  // What the switcher relies on: read the surface off one Group's URL, write it
  // back out for another, and land on the same page in the new Group.
  test('round-trips a surface from one Group to another', () => {
    for (const surface of GROUP_SURFACES) {
      const here = groupHref(surface, 'jansen-household')
      const there = groupHref(groupSurfaceOf(here) ?? 'home', 'wine-club')
      expect(there).toBe(groupHref(surface, 'wine-club'))
    }
  })
})
