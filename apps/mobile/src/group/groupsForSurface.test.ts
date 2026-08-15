import { describe, expect, test } from 'vitest'

import { groupsForSurface } from './groupsForSurface'

const retained = [{ slug: 'home', name: 'Home' }]

describe('groupsForSurface', () => {
  test('keeps the last resolved groups while the live query is unavailable', () => {
    expect(groupsForSurface(undefined, retained)).toBe(retained)
  })

  test('uses a newly resolved group list when service recovers', () => {
    const current = [{ slug: 'new', name: 'New' }]
    expect(groupsForSurface(current, retained)).toBe(current)
  })
})
