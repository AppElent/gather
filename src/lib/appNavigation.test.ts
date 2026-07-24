import { describe, expect, test } from 'vitest'
import {
  getModulesByStatus,
  getRouteContext,
  isDockItemActive,
  isPrimaryAreaActive,
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

  test('computes mobile dock active states by full location signal', () => {
    const home = MOBILE_DOCK_ITEMS[0]
    const tasks = MOBILE_DOCK_ITEMS[1]
    const modules = MOBILE_DOCK_ITEMS[3]

    expect(isDockItemActive('/dashboard', home)).toBe(true)
    expect(isDockItemActive('/dashboard#modules', home)).toBe(false)
    expect(isDockItemActive('/dashboard#modules', modules)).toBe(true)
    const routerDashboardModules = { pathname: '/dashboard', hash: 'modules' }
    expect(isDockItemActive(routerDashboardModules, home)).toBe(false)
    expect(isDockItemActive(routerDashboardModules, modules)).toBe(true)
    expect(
      MOBILE_DOCK_ITEMS.filter((item) =>
        isDockItemActive(routerDashboardModules, item),
      ),
    ).toEqual([modules])
    expect(isDockItemActive('/tasks', tasks)).toBe(true)
    expect(isDockItemActive('/tasks', modules)).toBe(false)
    expect(isDockItemActive('/recipes', modules)).toBe(true)
    expect(isDockItemActive('/recipes/new', modules)).toBe(true)
  })

  test('keeps Command Center and Modules primary activation exclusive', () => {
    const commandCenter = PRIMARY_AREAS[0]
    const modules = PRIMARY_AREAS[3]

    expect(
      isPrimaryAreaActive({ pathname: '/dashboard', hash: '' }, commandCenter),
    ).toBe(true)
    expect(
      isPrimaryAreaActive({ pathname: '/dashboard', hash: '' }, modules),
    ).toBe(false)
    expect(
      isPrimaryAreaActive(
        { pathname: '/dashboard', hash: 'modules' },
        commandCenter,
      ),
    ).toBe(false)
    expect(
      isPrimaryAreaActive({ pathname: '/dashboard', hash: 'modules' }, modules),
    ).toBe(true)
  })

  test('splits modules by live and placeholder status', () => {
    const byStatus = getModulesByStatus()
    expect(byStatus.live.map((module) => module.id)).toEqual([
      'recipes',
      'nutrition',
      'tasks',
      'baby-log',
    ])
    expect(byStatus.placeholder.length).toBeGreaterThan(0)
  })
})
