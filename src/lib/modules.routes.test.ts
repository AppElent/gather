import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { MODULES } from './modules'

describe('module registry routes', () => {
  for (const module of MODULES.filter((item) => item.availability === 'live')) {
    test(`${module.id} resolves beneath the Space route boundary`, () => {
      const candidates = [
        join(
          process.cwd(),
          'src/routes/_app/s/$spaceSlug',
          `${module.pathSegment}.tsx`,
        ),
        join(
          process.cwd(),
          'src/routes/_app/s/$spaceSlug',
          module.pathSegment,
          'index.tsx',
        ),
      ]
      expect(candidates.some((path) => existsSync(path))).toBe(true)
    })
  }
})
