import { describe, expect, test } from 'vitest'
import { MODULES, modulesByGroup } from '../modules'

describe('module registry', () => {
  test('every module has a unique id', () => {
    const ids = new Set(MODULES.map((m) => m.id))
    expect(ids.size).toBe(MODULES.length)
  })

  test('modulesByGroup buckets every module', () => {
    const total = Object.values(modulesByGroup()).reduce(
      (n, arr) => n + arr.length,
      0,
    )
    expect(total).toBe(MODULES.length)
  })
})
