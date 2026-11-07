import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { MODULES } from '@gather/core/modules'
import { describe, expect, test } from 'vitest'
import { moduleSegment } from './groupPaths'

/**
 * Every Module is reachable at its one top-level address (ADR-0031).
 *
 * `moduleLink` builds a Module's destination from a table `Record<ModuleId, …>`
 * checked against the generated route tree by TypeScript. What TypeScript cannot
 * check is the route file being on disk at all, so that is asserted here.
 */
describe('every Module at its ambient address', () => {
  const base = join(process.cwd(), 'src/routes/_app')

  for (const module of MODULES) {
    test(`${module.id} has a route file under _app`, () => {
      const segment = moduleSegment(module.id)
      expect(segment).not.toBe('')
      const candidates = [
        join(base, `${segment}.tsx`),
        join(base, segment, 'index.tsx'),
      ]
      expect(candidates.some((path) => existsSync(path))).toBe(true)
    })
  }

  // The `/g/<slug>/…` routes are gone and old URLs 404 rather than redirect,
  // so there is no second place a Module could live and no way for the two to
  // disagree about which one is current.
  test('no Module has a route under a Group slug', () => {
    expect(existsSync(join(base, 'g'))).toBe(false)
  })
})
