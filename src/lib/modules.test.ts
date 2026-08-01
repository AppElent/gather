import { describe, expect, test } from 'vitest'
import { MODULE_GROUPS, MODULES, modulesByGroup } from './modules'

describe('module registry', () => {
  test('every module has a unique id', () => {
    const ids = new Set(MODULES.map((m) => m.id))
    expect(ids.size).toBe(MODULES.length)
  })

  test('every module group is a declared group', () => {
    for (const m of MODULES) expect(MODULE_GROUPS).toContain(m.group)
  })

  test('recipes, nutrition, tasks, and baby-log are the live modules', () => {
    const live = MODULES.filter((m) => m.status === 'live').map((m) => m.id)
    expect(live).toEqual(['recipes', 'nutrition', 'tasks', 'baby-log'])
  })

  test('modulesByGroup buckets every module', () => {
    const total = Object.values(modulesByGroup()).reduce(
      (n, arr) => n + arr.length,
      0,
    )
    expect(total).toBe(MODULES.length)
  })
})
