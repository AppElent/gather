import { beforeEach, describe, expect, test } from 'vitest'
import { readLastUsed, writeLastUsed } from './lastUsed'

describe('lastUsed', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  test('returns null for a key that was never written', () => {
    expect(readLastUsed('temperatureMethod')).toBeNull()
  })

  test('round-trips a written value', () => {
    writeLastUsed('temperatureMethod', 'ear')
    expect(readLastUsed('temperatureMethod')).toBe('ear')
  })

  test('keys are namespaced so they cannot collide with unrelated storage', () => {
    writeLastUsed('diaperKind', 'wet')
    expect(window.localStorage.getItem('diaperKind')).toBeNull()
    expect(
      Object.keys(window.localStorage).some((k) =>
        k.startsWith('gather:baby:lastUsed:'),
      ),
    ).toBe(true)
  })
})
