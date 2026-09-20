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

  test('offers the three Money Modules instead of a Finances umbrella', () => {
    const money = MODULES.filter((m) => m.group === 'money').map((m) => ({
      id: m.id,
      status: m.status,
    }))
    expect(money).toEqual([
      { id: 'recurring-costs', status: 'placeholder' },
      { id: 'shared-costs', status: 'placeholder' },
      { id: 'savings-goals', status: 'placeholder' },
    ])
    expect(MODULES.map((m) => m.id)).not.toContain('finances')
  })

  test('keeps the implemented web Modules live', () => {
    const live = MODULES.filter((m) => m.status === 'live').map((m) => m.id)
    expect(live).toEqual(['recipes', 'nutrition', 'tasks', 'baby-log'])
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
