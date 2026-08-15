import { describe, expect, test } from 'vitest'

import { resolveAvailability } from './state'

describe('resolveAvailability', () => {
  test('holds the splash during an unresolved cold start', () => {
    expect(
      resolveAvailability({
        clerkLoaded: false,
        clerkStatus: 'loading',
        signedIn: undefined,
        splashExpired: false,
        serviceConnected: false,
        serviceEverConnected: false,
      }),
    ).toBe('splash')
  })

  test('opens the unavailable gate after an unresolved cold start expires', () => {
    expect(
      resolveAvailability({
        clerkLoaded: false,
        clerkStatus: 'loading',
        signedIn: undefined,
        splashExpired: true,
        serviceConnected: false,
        serviceEverConnected: false,
      }),
    ).toBe('unavailable')
  })

  test('never treats a retained signed-in session as signed out during service loss', () => {
    expect(
      resolveAvailability({
        clerkLoaded: true,
        clerkStatus: 'ready',
        signedIn: true,
        splashExpired: true,
        serviceConnected: false,
        serviceEverConnected: true,
      }),
    ).toBe('connection-lost')
  })

  test('keeps the shell visible when retained Clerk connectivity degrades', () => {
    expect(
      resolveAvailability({
        clerkLoaded: true,
        clerkStatus: 'error',
        signedIn: true,
        splashExpired: true,
        serviceConnected: true,
        serviceEverConnected: true,
      }),
    ).toBe('connection-lost')
  })

  test('returns to the connected shell when service recovers', () => {
    expect(
      resolveAvailability({
        clerkLoaded: true,
        clerkStatus: 'ready',
        signedIn: true,
        splashExpired: true,
        serviceConnected: true,
        serviceEverConnected: true,
      }),
    ).toBe('connected')
  })

  test('allows a positively signed-out person to reach the front door', () => {
    expect(
      resolveAvailability({
        clerkLoaded: true,
        clerkStatus: 'ready',
        signedIn: false,
        splashExpired: true,
        serviceConnected: false,
        serviceEverConnected: false,
      }),
    ).toBe('signed-out')
  })
})
