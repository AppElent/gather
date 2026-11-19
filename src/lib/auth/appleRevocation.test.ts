import { ConvexError } from 'convex/values'
import { beforeEach, expect, test, vi } from 'vitest'
import { type AppleIdAuth, revokeAppleSignIn } from './appleRevocation'

/**
 * The web's Apple step before the whole account is deleted (APP-388):
 * nothing is deleted unless it answers `continue`.
 */

const mocks = vi.hoisted(() => ({ report: vi.fn() }))
vi.mock('../observability/report', () => ({ reportError: mocks.report }))

const ORIGIN = 'https://gather.appelent.nl'
const RETURN_URL = `${ORIGIN}/account`
const SUBJECT = 'user_alice'
const appleUser = {
  externalAccounts: [{ provider: 'oauth_apple', providerUserId: 'apple-sub' }],
}

function idToken(sub: string) {
  const part = (value: object) =>
    btoa(JSON.stringify(value))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
  return `${part({ alg: 'RS256' })}.${part({ sub })}.signature`
}

function apple(
  result: (state: string) => Promise<{
    authorization: { code?: string; id_token?: string; state?: string }
  }>,
) {
  let state = ''
  const auth: AppleIdAuth = {
    init: vi.fn((config) => {
      state = config.state
    }),
    signIn: vi.fn(() => result(state)),
  }
  return auth
}

const signedIn = (sub = 'apple-sub', code: string | undefined = 'code') =>
  apple(async (state) => ({
    authorization: { code, id_token: idToken(sub), state },
  }))

function run(
  auth: AppleIdAuth | (() => Promise<AppleIdAuth>),
  {
    user = appleUser,
    returnUrls = [RETURN_URL],
    revoke = vi.fn().mockResolvedValue(null),
  } = {},
) {
  const result = revokeAppleSignIn(user, revoke, {
    expectedSubject: SUBJECT,
    origin: ORIGIN,
    returnUrls,
    loadApple: typeof auth === 'function' ? auth : async () => auth,
  })
  return { revoke, result }
}

beforeEach(() => vi.clearAllMocks())

test("sends the popup's code with the Services ID, return URL and account", async () => {
  const auth = signedIn()
  const { revoke, result } = run(auth)
  await expect(result).resolves.toBe('continue')
  expect(auth.init).toHaveBeenCalledWith(
    expect.objectContaining({
      clientId: 'nl.appelent.web',
      redirectURI: RETURN_URL,
      usePopup: true,
    }),
  )
  expect(revoke).toHaveBeenCalledWith({
    authorizationCode: 'code',
    bundleId: 'nl.appelent.web',
    redirectUri: RETURN_URL,
    expectedSubject: SUBJECT,
  })
})

test('skips accounts without Apple and origins Apple does not know', async () => {
  const auth = signedIn()
  const noApple = run(auth, { user: { externalAccounts: [] } })
  await expect(noApple.result).resolves.toBe('continue')
  const unregistered = run(auth, { returnUrls: [] })
  await expect(unregistered.result).resolves.toBe('continue')
  expect(auth.signIn).not.toHaveBeenCalled()
  expect(noApple.revoke).not.toHaveBeenCalled()
  expect(unregistered.revoke).not.toHaveBeenCalled()
})

test('cancels when the popup is closed', async () => {
  for (const error of ['popup_closed_by_user', 'user_cancelled_authorize']) {
    const { revoke, result } = run(apple(() => Promise.reject({ error })))
    await expect(result).resolves.toBe('cancelled')
    expect(revoke).not.toHaveBeenCalled()
  }
  expect(mocks.report).not.toHaveBeenCalled()
})

test('stops when the browser blocks the popup', async () => {
  const { revoke, result } = run(
    apple(() => Promise.reject({ error: 'popup_blocked_by_browser' })),
  )
  await expect(result).resolves.toBe('popupBlocked')
  expect(revoke).not.toHaveBeenCalled()
  expect(mocks.report).not.toHaveBeenCalled()
})

test('stops, and reports, when the popup fails before there is a code', async () => {
  for (const auth of [
    () => Promise.reject(new Error('Apple JS could not be loaded')),
    apple(() => Promise.reject({ error: 'invalid_request' })),
    // An answer for another request.
    apple(async () => ({
      authorization: { code: 'code', id_token: idToken('apple-sub'), state: 'x' },
    })),
    // An answer without a code.
    signedIn('apple-sub', ''),
  ]) {
    const { revoke, result } = run(auth)
    await expect(result).resolves.toBe('failed')
    expect(revoke).not.toHaveBeenCalled()
  }
  expect(mocks.report).toHaveBeenCalledTimes(4)
})

test("never sends another Apple Account's code", async () => {
  const { revoke, result } = run(signedIn('someone-else'))
  await expect(result).resolves.toBe('appleMismatch')
  expect(revoke).not.toHaveBeenCalled()
})

test('stops when Convex finds the code is for another Apple Account', async () => {
  const { result } = run(signedIn(), {
    revoke: vi.fn().mockRejectedValue(new ConvexError('Apple account mismatch')),
  })
  await expect(result).resolves.toBe('appleMismatch')
  expect(mocks.report).not.toHaveBeenCalled()
})

test('reports a failed revocation and lets the deletion go ahead', async () => {
  const { result } = run(signedIn(), {
    revoke: vi.fn().mockRejectedValue(new ConvexError('Apple revocation failed')),
  })
  await expect(result).resolves.toBe('continue')
  expect(mocks.report).toHaveBeenCalledOnce()
})

test('reads the Apple user from a base64url ID token', async () => {
  // "~~~" and "???" encode to "-" and "_" in base64url.
  const sub = '001234.~~~???.0001'
  const { revoke, result } = run(signedIn(sub), {
    user: {
      externalAccounts: [{ provider: 'oauth_apple', providerUserId: sub }],
    },
  })
  await expect(result).resolves.toBe('continue')
  expect(revoke).toHaveBeenCalledOnce()
})
