import { beforeEach, expect, test, vi } from 'vitest'

const store = new Map<string, string>()

vi.mock('../../../prefs/localPreference', () => ({
  PREFERENCE_KEYS: {
    pushRegistration: 'gather:push:registration',
    pushRelease: 'gather:push:release',
  },
  readPreference: (key: string) => store.get(key) ?? null,
  writePreference: (key: string, value: string) => store.set(key, value),
  clearPreference: (key: string) => store.delete(key),
}))
vi.mock('expo-notifications', () => ({ setNotificationHandler: () => {} }))
vi.mock('expo-constants', () => ({ default: {} }))
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }))

const {
  confirmPushRelease,
  moveRegistrationToRelease,
  pendingPushRelease,
  registeredPush,
  rememberRegisteredPush,
} = await import('./push-device')

const alice = { token: 'ExponentPushToken[a]', sessionId: 'sess_alice' }

beforeEach(() => store.clear())

test('a registration survives a relaunch, so a sign-out right after one still releases it', () => {
  rememberRegisteredPush(alice)
  expect(registeredPush()).toEqual(alice)

  expect(moveRegistrationToRelease()).toEqual(alice)
  expect(registeredPush()).toBeNull()
  expect(pendingPushRelease()).toEqual(alice)
})

test('a release stays pending until the server confirms that same release', () => {
  rememberRegisteredPush(alice)
  moveRegistrationToRelease()

  confirmPushRelease({ ...alice, sessionId: 'sess_other' })
  expect(pendingPushRelease()).toEqual(alice)

  confirmPushRelease(alice)
  expect(pendingPushRelease()).toBeNull()
})

test('signing out with nothing registered releases nothing', () => {
  expect(moveRegistrationToRelease()).toBeNull()
  expect(pendingPushRelease()).toBeNull()
})

test('a damaged saved value reads as nothing', () => {
  store.set('gather:push:registration', '{not json')
  store.set('gather:push:release', JSON.stringify({ token: 1 }))
  expect(registeredPush()).toBeNull()
  expect(pendingPushRelease()).toBeNull()
})
