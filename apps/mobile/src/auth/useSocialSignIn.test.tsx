// @vitest-environment jsdom
import { act } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { en } from '../i18n/messages/en'
import { mount } from '../testing/dom'
import { type SocialProvider, useSocialSignIn } from './useSocialSignIn'

const mocks = vi.hoisted(() => ({
  os: 'ios' as 'ios' | 'android',
  startSSOFlow: vi.fn(),
  startApple: vi.fn(),
  setActive: vi.fn(),
}))

vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mocks.os
    },
  },
}))
vi.mock('@clerk/expo/experimental', () => ({
  useSSO: () => ({ startSSOFlow: mocks.startSSOFlow }),
}))
vi.mock('@clerk/expo/apple', () => ({
  useSignInWithApple: () => ({
    startAppleAuthenticationFlow: mocks.startApple,
  }),
}))
vi.mock('../i18n', () => ({ useI18n: () => ({ t: en }) }))

type Hook = ReturnType<typeof useSocialSignIn>

async function run(provider: SocialProvider) {
  const result = { current: undefined as unknown as Hook }
  function Probe() {
    result.current = useSocialSignIn()
    return null
  }
  const view = mount(<Probe />)
  await act(() => result.current.start(provider))
  view.unmount()
  return result.current
}

beforeEach(() => {
  vi.stubGlobal('__DEV__', false)
  mocks.os = 'ios'
})
afterEach(() => {
  vi.resetAllMocks()
  vi.unstubAllGlobals()
})

test('Apple on iOS uses the native sheet and activates its session', async () => {
  mocks.startApple.mockResolvedValue({
    createdSessionId: 'sess_1',
    setActive: mocks.setActive,
  })
  const result = await run('apple')
  expect(mocks.startSSOFlow).not.toHaveBeenCalled()
  expect(mocks.setActive).toHaveBeenCalledWith({ session: 'sess_1' })
  expect(result.error).toBeNull()
})

test('cancelling the Apple sheet says nothing', async () => {
  // Clerk swallows ERR_REQUEST_CANCELED and returns a null session.
  mocks.startApple.mockResolvedValue({
    createdSessionId: null,
    setActive: mocks.setActive,
    signUp: { status: null },
  })
  const result = await run('apple')
  expect(result.error).toBeNull()
  expect(result.pending).toBeNull()
})

test('an Apple sign-up missing a field explains where to finish it', async () => {
  mocks.startApple.mockResolvedValue({
    createdSessionId: null,
    setActive: mocks.setActive,
    signUp: {
      status: 'missing_requirements',
      verifications: { externalAccount: { status: 'verified' } },
    },
  })
  const result = await run('apple')
  expect(result.error).toBe(en.social.incomplete)
})

test('cancelling Apple after an abandoned email sign-up still says nothing', async () => {
  mocks.startApple.mockResolvedValue({
    createdSessionId: null,
    setActive: mocks.setActive,
    signUp: {
      status: 'missing_requirements',
      verifications: { externalAccount: { status: null } },
    },
  })
  const result = await run('apple')
  expect(result.error).toBeNull()
})

test('Apple before Clerk has loaded says something went wrong', async () => {
  mocks.startApple.mockResolvedValue({ createdSessionId: null })
  const result = await run('apple')
  expect(result.error).toBe(en.errors.generic)
})

test('Apple on Android falls back to the browser flow', async () => {
  mocks.os = 'android'
  mocks.startSSOFlow.mockResolvedValue({
    createdSessionId: 'sess_2',
    authSessionResult: { type: 'success' },
  })
  await run('apple')
  expect(mocks.startApple).not.toHaveBeenCalled()
  expect(mocks.startSSOFlow).toHaveBeenCalledWith({ strategy: 'oauth_apple' })
})

test('Microsoft opens the browser flow', async () => {
  mocks.startSSOFlow.mockResolvedValue({
    createdSessionId: 'sess_3',
    authSessionResult: { type: 'success' },
  })
  const result = await run('microsoft')
  expect(mocks.startSSOFlow).toHaveBeenCalledWith({
    strategy: 'oauth_microsoft',
  })
  expect(result.error).toBeNull()
})

test('closing the browser says nothing and frees the buttons', async () => {
  mocks.startSSOFlow.mockResolvedValue({
    createdSessionId: null,
    authSessionResult: { type: 'dismiss' },
  })
  const result = await run('microsoft')
  expect(result.error).toBeNull()
  expect(result.pending).toBeNull()
})

test('an existing session counts as signed in', async () => {
  mocks.startSSOFlow.mockResolvedValue({
    createdSessionId: null,
    signIn: { existingSession: { sessionId: 'sess_4' } },
    authSessionResult: { type: 'success' },
  })
  const result = await run('microsoft')
  expect(result.error).toBeNull()
})

test('a browser sign-up that stops short explains where to finish it', async () => {
  mocks.startSSOFlow.mockResolvedValue({
    createdSessionId: null,
    signIn: { existingSession: undefined },
    authSessionResult: { type: 'success' },
  })
  const result = await run('microsoft')
  expect(result.error).toBe(en.social.incomplete)
})

test('a Clerk failure is put in gather words', async () => {
  mocks.startSSOFlow.mockRejectedValue({ errors: [{ code: 'network_error' }] })
  const result = await run('microsoft')
  expect(result.error).toBe(en.errors.network)
  expect(result.pending).toBeNull()
})

test('a thrown cancel says nothing', async () => {
  mocks.startApple.mockRejectedValue({ code: 'ERR_REQUEST_CANCELED' })
  const result = await run('apple')
  expect(result.error).toBeNull()
})
