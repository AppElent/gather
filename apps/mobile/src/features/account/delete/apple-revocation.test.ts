import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { revokeAppleSignIn } from './apple-revocation'

const mocks = vi.hoisted(() => ({
  os: 'ios' as 'ios' | 'android',
  bundleId: 'com.appelent.gather.preview' as string | undefined,
  signIn: vi.fn(),
  reportError: vi.fn(),
}))

vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mocks.os
    },
  },
}))
vi.mock('expo-constants', () => ({
  default: {
    get expoConfig() {
      return { ios: { bundleIdentifier: mocks.bundleId } }
    },
  },
}))
vi.mock('expo-apple-authentication', () => ({ signInAsync: mocks.signIn }))
vi.mock('../../../observability/report', () => ({
  reportError: mocks.reportError,
}))

const appleUser = {
  externalAccounts: [
    { provider: 'oauth_apple', providerUserId: 'apple-alex' },
  ],
}

beforeEach(() => {
  mocks.os = 'ios'
  mocks.bundleId = 'com.appelent.gather.preview'
})
afterEach(() => {
  vi.resetAllMocks()
})

describe('revoking Sign in with Apple before deletion', () => {
  test('sends the fresh code with this build’s bundle ID', async () => {
    mocks.signIn.mockResolvedValue({
      user: 'apple-alex',
      authorizationCode: 'apple-code',
    })
    const revoke = vi.fn().mockResolvedValue(null)
    expect(await revokeAppleSignIn(appleUser, revoke)).toBe('continue')
    expect(revoke).toHaveBeenCalledWith({
      authorizationCode: 'apple-code',
      bundleId: 'com.appelent.gather.preview',
    })
    expect(mocks.reportError).not.toHaveBeenCalled()
  })

  test('dismissing the Apple sheet cancels the deletion', async () => {
    mocks.signIn.mockRejectedValue(
      Object.assign(new Error('canceled'), { code: 'ERR_REQUEST_CANCELED' }),
    )
    const revoke = vi.fn()
    expect(await revokeAppleSignIn(appleUser, revoke)).toBe('cancelled')
    expect(revoke).not.toHaveBeenCalled()
    expect(mocks.reportError).not.toHaveBeenCalled()
  })

  test('a failed revoke is reported and the deletion continues', async () => {
    mocks.signIn.mockResolvedValue({
      user: 'apple-alex',
      authorizationCode: 'apple-code',
    })
    const failure = new Error('Apple revocation failed')
    const revoke = vi.fn().mockRejectedValue(failure)
    expect(await revokeAppleSignIn(appleUser, revoke)).toBe('continue')
    expect(mocks.reportError).toHaveBeenCalledWith(failure)
  })

  test('never revokes a different Apple Account’s grant', async () => {
    mocks.signIn.mockResolvedValue({
      user: 'apple-someone-else',
      authorizationCode: 'other-code',
    })
    const revoke = vi.fn()
    expect(await revokeAppleSignIn(appleUser, revoke)).toBe('continue')
    expect(revoke).not.toHaveBeenCalled()
    expect(mocks.reportError).toHaveBeenCalled()
  })

  test('a build without a bundle ID never opens the sheet', async () => {
    mocks.bundleId = undefined
    const revoke = vi.fn()
    expect(await revokeAppleSignIn(appleUser, revoke)).toBe('continue')
    expect(mocks.signIn).not.toHaveBeenCalled()
    expect(mocks.reportError).toHaveBeenCalled()
  })

  test('an account without Apple never sees the sheet', async () => {
    const revoke = vi.fn()
    const emailOnly = { externalAccounts: [] }
    const microsoft = {
      externalAccounts: [{ provider: 'microsoft', providerUserId: 'ms-1' }],
    }
    expect(await revokeAppleSignIn(emailOnly, revoke)).toBe('continue')
    expect(await revokeAppleSignIn(microsoft, revoke)).toBe('continue')
    expect(mocks.signIn).not.toHaveBeenCalled()
  })

  test('Android has no native sheet and skips straight to deletion', async () => {
    mocks.os = 'android'
    const revoke = vi.fn()
    expect(await revokeAppleSignIn(appleUser, revoke)).toBe('continue')
    expect(mocks.signIn).not.toHaveBeenCalled()
    expect(mocks.reportError).not.toHaveBeenCalled()
  })
})
