import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { MODULES } from '@gather/core/modules'
import { describe, expect, test } from 'vitest'
import { groupSurfaceForModule, moduleSegment } from './groupPaths'

/**
 * Every Module is reachable inside a Group, and nowhere else.
 *
 * `moduleLink` builds a Module's destination from `groupSurfaceForModule`, and
 * that surface is checked against the generated route tree by TypeScript. What
 * TypeScript cannot check is the other direction — a Module that never claimed
 * a surface would quietly point at All instead of at itself — so that is
 * asserted here, along with the route file being on disk at all.
 */
describe('every Module inside a Group', () => {
  const base = join(process.cwd(), 'src/routes/_app')

  for (const module of MODULES) {
    test(`${module.id} claims a Group surface`, () => {
      expect(groupSurfaceForModule(module.id)).not.toBeNull()
    })

    test(`${module.id} has a route file under `, () => {
      const segment = moduleSegment(module.id)
      expect(segment).not.toBe('')
      const candidates = [
        join(base, `${segment}.tsx`),
        join(base, segment, 'index.tsx'),
      ]
      expect(candidates.some((path) => existsSync(path))).toBe(true)
    })
  }

  // The flat routes are gone, so there is no second place a Module could live
  // and no way for the two to disagree about which one is current.
  test('no Module has a route outside a Group', () => {
    const flatRoot = join(process.cwd(), 'src/routes/_app')
    const flat = MODULES.filter((module) => {
      const segment = moduleSegment(module.id)
      return [
        join(flatRoot, `${segment}.tsx`),
        join(flatRoot, segment, 'index.tsx'),
      ].some((path) => existsSync(path))
    })
    expect(flat.map((module) => module.id)).toEqual([])
  })
})
