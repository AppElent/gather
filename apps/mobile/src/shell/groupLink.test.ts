import { describe, expect, test } from 'vitest'

import { nativeDestinationForGroupLink } from './groupLink'

describe('nativeDestinationForGroupLink', () => {
  test.each([
    'recipes',
    'tasks',
    'nutrition',
  ] as const)('opens legacy %s links through the All module route', (moduleId) => {
    expect(nativeDestinationForGroupLink([moduleId])).toEqual({
      pathname: '/all/[moduleId]',
      params: { moduleId },
    })
  })
})
