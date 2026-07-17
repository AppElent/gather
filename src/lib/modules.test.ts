import { describe, expect, test } from 'vitest'
import { MODULE_GROUPS, MODULES, modulesByGroup } from './modules'

describe('module registry', () => {
  test('every module has a unique id and path', () => {
    const ids = new Set(MODULES.map((m) => m.id))
    const paths = new Set(MODULES.map((m) => m.path))
    expect(ids.size).toBe(MODULES.length)
    expect(paths.size).toBe(MODULES.length)
  })

  test('every module path starts with a slash', () => {
    for (const m of MODULES) expect(m.path.startsWith('/')).toBe(true)
  })

  test('every module group is a declared group', () => {
    for (const m of MODULES) expect(MODULE_GROUPS).toContain(m.group)
  })

  test('recipes and tasks are the live modules initially', () => {
    const live = MODULES.filter((m) => m.status === 'live').map((m) => m.id)
    expect(live).toEqual(['recipes', 'tasks'])
  })

  test('modulesByGroup buckets every module', () => {
    const total = Object.values(modulesByGroup()).reduce(
      (n, arr) => n + arr.length,
      0,
    )
    expect(total).toBe(MODULES.length)
  })
})
