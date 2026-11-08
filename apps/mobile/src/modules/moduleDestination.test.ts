// Vitest lists the route files with Vite's `import.meta.glob`. Not eager:
// nothing is imported, only named.
/// <reference types="vite/client" />
import { MODULES } from '@gather/core/modules'
import type { Href } from 'expo-router'
import { describe, expect, test } from 'vitest'

import { isNativeModule, moduleDestination } from './moduleDestination'

const TABS = '../../app/(app)/(tabs)/'

/** Every route file in the tab navigator, relative to it: `all/[moduleId].tsx`. */
const ROUTE_FILES = new Set(
  Object.keys(import.meta.glob('../../app/**/*.tsx'))
    .filter((file) => file.startsWith(TABS))
    .map((file) => file.slice(TABS.length)),
)

function pathOf(href: Href): string {
  return typeof href === 'string' ? href : href.pathname
}

/** The names directly inside `dir` (`''` is the tab navigator itself). */
function entriesOf(dir: string): string[] {
  const prefix = dir ? `${dir}/` : ''
  const names = new Set<string>()
  for (const file of ROUTE_FILES) {
    if (file.startsWith(prefix))
      names.add(file.slice(prefix.length).split('/')[0] ?? '')
  }
  return [...names]
}

/**
 * The route file expo-router would match for a path, or null.
 *
 * A static segment wins over a dynamic one, as it does in the router; a
 * dynamic `[name]` directory or file stands in for any segment.
 */
function routeFileFor(path: string): string | null {
  let dir = ''
  const join = (name: string) => (dir ? `${dir}/${name}` : name)
  const segments = path.split('/').filter(Boolean)
  for (const [index, segment] of segments.entries()) {
    const last = index === segments.length - 1
    const entries = entriesOf(dir)
    const dynamic = entries.find((entry) => /^\[[^.]+\](\.tsx)?$/.test(entry))
    if (last) {
      for (const candidate of [`${segment}.tsx`, `${segment}/index.tsx`]) {
        if (ROUTE_FILES.has(join(candidate))) return join(candidate)
      }
      if (dynamic?.endsWith('.tsx')) return join(dynamic)
      if (dynamic && ROUTE_FILES.has(join(`${dynamic}/index.tsx`))) {
        return join(`${dynamic}/index.tsx`)
      }
      return null
    }
    if (entries.includes(segment)) dir = join(segment)
    else if (dynamic && !dynamic.endsWith('.tsx')) dir = join(dynamic)
    else return null
  }
  return null
}

describe('moduleDestination', () => {
  test.each(MODULES.map((module) => module.id))(
    '%s opens its own screens when it has them, and the placeholder when not',
    (moduleId) => {
      const path = pathOf(moduleDestination(moduleId))
      const file = routeFileFor(path)
      expect(file, path).not.toBeNull()
      // A native Module that resolved to the dynamic route would be sent by
      // `ModuleRoute` straight back to `moduleDestination` — a loop.
      expect(file?.endsWith('[moduleId].tsx'), path).toBe(
        !isNativeModule(moduleId),
      )
      // A Module with its own route files that is missing from
      // `NATIVE_MODULES` would keep opening the placeholder.
      const own = routeFileFor(`/all/${moduleId}`)
      if (!own?.endsWith('[moduleId].tsx')) {
        expect(isNativeModule(moduleId), own ?? '').toBe(true)
      }
    },
  )

  test('a tasting Module lands on its Kind segment, not its Module id', () => {
    expect(moduleDestination('cheeses')).toBe('/all/tasting/cheese')
    expect(moduleDestination('wines')).toBe('/all/tasting/wine')
    expect(moduleDestination('beers')).toBe('/all/tasting/beer')
  })

  test('a Module without screens lands on the placeholder', () => {
    expect(moduleDestination('nutrition')).toEqual({
      pathname: '/all/[moduleId]',
      params: { moduleId: 'nutrition' },
    })
  })
})
