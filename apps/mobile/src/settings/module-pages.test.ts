// Vitest lists the route files with Vite's `import.meta.glob`. Not eager:
// nothing is imported, only named.
/// <reference types="vite/client" />
import { describe, expect, test } from 'vitest'

import {
  hasModuleSettings,
  MODULE_SETTINGS_PAGES,
  moduleSettingsHref,
} from './module-pages'

const TABS = '../../app/(app)/(tabs)'

const ROUTE_FILES = new Set(
  Object.keys(import.meta.glob('../../app/**/*.tsx'))
    .filter((file) => file.startsWith(TABS))
    .map((file) => file.slice(TABS.length)),
)

/** A static path's route file, as `file.tsx` or `file/index.tsx`. */
const hasRoute = (path: string) =>
  ROUTE_FILES.has(`${path}.tsx`) || ROUTE_FILES.has(`${path}/index.tsx`)

describe('Module settings pages (APP-611)', () => {
  test.each(MODULE_SETTINGS_PAGES)('%s has a page behind both doors', (id) => {
    expect(hasRoute(moduleSettingsHref(id, 'all'))).toBe(true)
    expect(hasRoute(moduleSettingsHref(id, 'settings'))).toBe(true)
  })

  test('a Module with nothing to set has no page', () => {
    for (const id of ['notes', 'recipes', 'loyalty-cards', 'energy']) {
      expect(hasModuleSettings(id)).toBe(false)
    }
    expect(hasModuleSettings('tasks')).toBe(true)
  })

  test('the gear pushes inside All, the Settings row inside Settings', () => {
    expect(moduleSettingsHref('groceries', 'all')).toBe(
      '/all/groceries/settings',
    )
    expect(moduleSettingsHref('groceries', 'settings')).toBe(
      '/settings/groceries',
    )
  })
})
