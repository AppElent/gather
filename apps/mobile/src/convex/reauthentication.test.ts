import { describe, expect, test } from 'vitest'

import {
  needsReauthentication,
  REAUTH_BACKOFF_MS,
  reauthDelay,
} from './reauthentication'

const gaveUp = {
  signedIn: true,
  tokenFetchFailed: true,
  convexAuthenticated: false,
  socketConnected: true,
}

describe('needsReauthentication', () => {
  test('asks again when Clerk holds a session Convex has given up on and the socket is up', () => {
    expect(needsReauthentication(gaveUp)).toBe(true)
  })

  test('leaves the sign-in handshake alone: not authenticated yet is not given up', () => {
    expect(needsReauthentication({ ...gaveUp, tokenFetchFailed: false })).toBe(
      false,
    )
  })

  test('waits for the connection rather than retrying offline', () => {
    expect(needsReauthentication({ ...gaveUp, socketConnected: false })).toBe(
      false,
    )
  })

  test('leaves a working session and a signed-out phone alone', () => {
    expect(
      needsReauthentication({ ...gaveUp, convexAuthenticated: true }),
    ).toBe(false)
    expect(needsReauthentication({ ...gaveUp, signedIn: false })).toBe(false)
  })
})

describe('reauthDelay', () => {
  test('retries a reconnect at once, then backs off to a ceiling', () => {
    expect(reauthDelay(0)).toBe(0)
    expect(reauthDelay(1)).toBe(REAUTH_BACKOFF_MS[1])
    expect(reauthDelay(99)).toBe(REAUTH_BACKOFF_MS.at(-1))
  })
})
