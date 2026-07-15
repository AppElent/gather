import { describe, expect, test } from 'vitest'
import {
  getModulesByStatus,
  getRouteContext,
  isDockItemActive,
  MOBILE_DOCK_ITEMS,
  PRIMARY_AREAS,
} from './appNavigation'

describe('app navigation metadata', () => {
  test('defines command-center primary areas without hard-coded household copy', () => {
    expect(PRIMARY_AREAS.map((item) => item.label)).toEqual([
      'Command Center',
      'Tasks',
      'Calendar',
      'Modules',
    ])
    expect(PRIMARY_AREAS.map((item) => item.path)).toEqual([
      '/dashboard',
      '/tasks',
      '/calendar',
      '/dashboard#modules',
    ])
  })

  test('defines the four stable mobile dock targets', () => {
    expect(MOBILE_DOCK_ITEMS.map((item) => item.label)).toEqual([
      'Home',
      'Tasks',
      'Calendar',
      'Modules',
    ])
  })

  test('derives route context for dashboard, module, and settings paths', () => {
    expect(getRouteContext('/dashboard')).toMatchObject({
      title: 'Command Center',
      subtitle: 'A shared view of group plans, modules, and next actions.',
    })
    expect(getRouteContext('/recipes')).toMatchObject({
      title: 'Recipes',
      subtitle: 'Keep and rate the dishes you cook.',
    })
    expect(getRouteContext('/settings')).toMatchObject({
      title: 'Settings',
    })
  })

  test('computes mobile dock active states by route family', () => {
    const home = MOBILE_DOCK_ITEMS[0]
    const tasks = MOBILE_DOCK_ITEMS[1]
    const modules = MOBILE_DOCK_ITEMS[3]

    expect(isDockItemActive('/dashboard', home)).toBe(true)
    expect(isDockItemActive('/tasks', tasks)).toBe(true)
    expect(isDockItemActive('/recipes', modules)).toBe(true)
    expect(isDockItemActive('/recipes/new', modules)).toBe(true)
  })

  test('splits modules by live and placeholder status', () => {
    const byStatus = getModulesByStatus()
    expect(byStatus.live.map((module) => module.id)).toEqual(['recipes'])
    expect(byStatus.placeholder.length).toBeGreaterThan(0)
  })
})
