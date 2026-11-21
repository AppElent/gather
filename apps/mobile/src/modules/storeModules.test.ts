/**
 * What the store build shows with the real catalogue (APP-374). The gate's
 * mechanics are tested in `moduleVisibility.test.ts`.
 */
import { MODULES, type ModuleId } from '@gather/core/modules'
import { TASTING_KIND_SPECS } from '@gather/core/tastings'
import { describe, expect, test } from 'vitest'

import { isNativeModule } from './moduleDestination'
import { isModuleShown } from './moduleVisibility'

/**
 * Every Module the welcome pitch names (`shell.about.subtitle`, shared with
 * the web's About page): recipes, plans, lists, tasks, notes and tasting logs.
 * App Review 2.3.1: the store build must show each of them.
 */
const PITCHED: readonly ModuleId[] = [
  'recipes',
  'meal-planner',
  'groceries',
  'tasks',
  'notes',
  'cheeses',
  'wines',
  'beers',
]

describe('the store build, with the real catalogue', () => {
  test('a Module is live on the phone only when it has phone screens', () => {
    for (const module of MODULES) {
      if (module.mobileStatus === 'live') {
        expect(isNativeModule(module.id), module.id).toBe(true)
      }
    }
  })

  test('a Module with phone screens is not left marked a placeholder there', () => {
    // The reverse of the check above: a Module that gains screens in
    // `NATIVE_MODULES` must also flip `mobileStatus`, or the store build hides it.
    for (const module of MODULES) {
      if (isNativeModule(module.id)) {
        expect(module.mobileStatus, module.id).toBe('live')
      }
    }
  })

  test('shows every Module with a working phone screen', () => {
    // The verdict per Module, checked against the screens in APP-374.
    expect(
      MODULES.filter((module) => !isModuleShown(module.id, true)).map(
        (module) => module.id,
      ),
    ).toEqual([])
  })

  test('shows every Module the welcome pitch names', () => {
    for (const id of PITCHED) expect(isModuleShown(id, true), id).toBe(true)
  })

  test('shows every tasting Module, which share one route', () => {
    // `isRouteShown` leaves the `tasting` segment alone on this promise.
    for (const spec of Object.values(TASTING_KIND_SPECS)) {
      expect(isModuleShown(spec.moduleId, true), spec.moduleId).toBe(true)
    }
  })
})
