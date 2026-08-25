import { describe, expect, test } from 'vitest'
import { MODULE_GROUPS, MODULES, modulesByGroup } from '../modules'

describe('module registry', () => {
  test('every module has a unique id', () => {
    const ids = new Set(MODULES.map((m) => m.id))
    expect(ids.size).toBe(MODULES.length)
  })

  test('every module group is a declared group', () => {
    for (const m of MODULES) expect(MODULE_GROUPS).toContain(m.group)
  })

  test('recipes, nutrition, finances, tasks and baby-log are live', () => {
    const live = MODULES.filter((m) => m.status === 'live').map((m) => m.id)
    expect(live).toEqual([
      'recipes',
      'nutrition',
      'finances',
      'tasks',
      'baby-log',
    ])
  })

  // Bills & subscriptions folded into Finances as Recurring costs (ADR-0025).
  // A Module the catalogue no longer names is one nothing can navigate to.
  test('no longer offers a Bills module', () => {
    expect(MODULES.map((m) => m.id)).not.toContain('bills')
  })

  test('modulesByGroup buckets every module', () => {
    const total = Object.values(modulesByGroup()).reduce(
      (n, arr) => n + arr.length,
      0,
    )
    expect(total).toBe(MODULES.length)
  })
})
