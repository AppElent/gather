import { describe, expect, test } from 'vitest'
import { checkEnergySiteName, ENERGY_LIMITS, primaryEnergySite } from './energy'

describe('checkEnergySiteName', () => {
  test('trims, and refuses empty or too long', () => {
    expect(checkEnergySiteName('  Thuis ')).toEqual({ name: 'Thuis' })
    expect(checkEnergySiteName('   ')).toEqual({ problem: 'needsName' })
    expect(checkEnergySiteName('x'.repeat(ENERGY_LIMITS.siteName))).toEqual({
      name: 'x'.repeat(ENERGY_LIMITS.siteName),
    })
    expect(
      checkEnergySiteName('x'.repeat(ENERGY_LIMITS.siteName + 1)),
    ).toEqual({ problem: 'tooLong' })
  })
})

describe('primaryEnergySite', () => {
  test('the first by order, then the oldest; none for none', () => {
    const a = { id: 'a', order: 1, _creationTime: 1 }
    const b = { id: 'b', order: 0, _creationTime: 3 }
    const c = { id: 'c', order: 0, _creationTime: 2 }
    expect(primaryEnergySite([a, b, c])?.id).toBe('c')
    expect(primaryEnergySite([])).toBeUndefined()
  })
})
