import { describe, expect, test } from 'vitest'

import { nativeDestinationForGroupLink } from './groupLink'

describe('nativeDestinationForGroupLink', () => {
  test.each([
    'recipes',
    'nutrition',
  ] as const)('opens legacy %s links through the All module route', (moduleId) => {
    expect(nativeDestinationForGroupLink([moduleId])).toEqual({
      pathname: '/all/[moduleId]',
      params: { moduleId },
    })
  })

  test.each([
    'tasks',
    'notes',
  ] as const)('opens native %s links at their real route', (moduleId) => {
    expect(nativeDestinationForGroupLink([moduleId])).toBe(`/all/${moduleId}`)
  })
})
