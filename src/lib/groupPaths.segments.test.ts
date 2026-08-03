import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { RESERVED_SLUGS } from '../../convex/lib/slugs'
import {
  GROUP_SURFACES,
  groupHref,
  groupSurfaceSegment,
  moduleSegment,
} from './groupPaths'
import { MODULES } from './modules'

/**
 * Under `/g/<slug>/` there is one flat namespace of segments, and two things
 * write into it: the Module registry, and the Group shell's own routes (Home,
 * and whatever #22 adds beside it). `RESERVED_SLUGS` is the list the shell has
 * claimed. If the two ever overlap, one route silently shadows the other.
 *
 * These assert the property rather than the current contents, so adding a
 * Module called "settings" — or a Group-level route called "recipes" — fails
 * here instead of at runtime.
 */

const MODULE_SEGMENTS = new Set(MODULES.map((m) => moduleSegment(m.id)))

describe('Group-level route segments', () => {
  test('no Module can take a segment the shell has reserved', () => {
    const collisions = [...MODULE_SEGMENTS].filter((s) => RESERVED_SLUGS.has(s))
    expect(collisions).toEqual([])
  })

  test('every Group-scoped surface is either a Module or a reserved segment', () => {
    // A shell-owned surface has to be reserved, and — by the test above — a
    // reserved segment can never be a Module. So the only way for a Group-level
    // route to take a Module's name is for it to *be* that Module.
    const unclaimed = GROUP_SURFACES.map(groupSurfaceSegment)
      .filter((segment) => segment !== '')
      .filter(
        (segment) =>
          !MODULE_SEGMENTS.has(segment) && !RESERVED_SLUGS.has(segment),
      )
    expect(unclaimed).toEqual([])
  })

  test('a slug can never be mistaken for the Group prefix itself', () => {
    expect(RESERVED_SLUGS.has('g')).toBe(true)
  })
})

describe('Group-scoped routes', () => {
  // The same safety net as modules.routes.test.ts, for the path builders: every
  // destination they can produce must be a route file that exists.
  for (const surface of GROUP_SURFACES) {
    test(`${surface} (${groupHref(surface, 'slug')}) resolves to a route file`, () => {
      const base = join(process.cwd(), 'src/routes/_app/g/$groupSlug')
      const segment = groupSurfaceSegment(surface)
      const candidates =
        segment === ''
          ? [join(base, 'index.tsx')]
          : [join(base, `${segment}.tsx`), join(base, segment, 'index.tsx')]
      expect(candidates.some((p) => existsSync(p))).toBe(true)
    })
  }
})
