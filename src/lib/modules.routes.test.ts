import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { MODULES } from './modules'

// A Module's path is a plain string in the registry, so wherever one is handed
// to a link it bypasses TanStack Router's compile-time route validation. This
// test restores that safety net: every registry path must map to a real route
// file, so a typo'd or removed path is caught in CI rather than as a runtime
// 404. `moduleLink` covers the Group-scoped side; this covers the flat paths it
// falls back to.
describe('module registry routes', () => {
  for (const m of MODULES) {
    test(`${m.id} (${m.path}) resolves to a route file`, () => {
      const seg = m.path.replace(/^\//, '')
      const candidates = [
        join(process.cwd(), 'src/routes/_app', `${seg}.tsx`),
        join(process.cwd(), 'src/routes/_app', seg, 'index.tsx'),
      ]
      expect(candidates.some((p) => existsSync(p))).toBe(true)
    })
  }
})
