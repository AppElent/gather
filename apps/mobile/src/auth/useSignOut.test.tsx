// @vitest-environment jsdom
/**
 * What leaving clears on this phone, through the real hooks and the real
 * stores over an in-memory `expo-sqlite/kv-store` (APP-798).
 */
import { act } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import {
  confirmAccount,
  diskScope,
  entryKey,
  setStoreForTests,
  writeEntry,
} from '../convex/lastKnown'
import {
  readOpenCard,
  recordOpenCard,
} from '../features/loyalty-cards/card/open-card-store'
import {
  pendingPushRelease,
  registeredPush,
  rememberRegisteredPush,
} from '../features/notifications/push/push-device'
import { readRetainedGroup, writeRetainedGroup } from '../group/retainedGroup'
import { mount, settle } from '../testing/dom'
import { useEndSession, useForgetAccount, useSignOut } from './useSignOut'

const state = vi.hoisted(() => ({
  map: new Map<string, string>(),
  released: [] as unknown[],
  release: (): Promise<void> => Promise.resolve(),
  // What was still on the phone at each call of Clerk's `signOut`.
  signedOutWith: [] as string[][],
  // What Clerk's `signOut` and `setActive` were told, and how `signOut` went.
  signOutArgs: [] as unknown[],
  signOut: (): Promise<void> => Promise.resolve(),
  activated: [] as unknown[],
  // `undefined` is Clerk between sessions; `null` is nobody signed in.
  sessionId: 'sess_1' as string | null | undefined,
}))

const store = vi.hoisted(() => ({
  getItemSync: (key: string) => state.map.get(key) ?? null,
  setItemSync: (key: string, value: string) => {
    state.map.set(key, value)
  },
  removeItemSync: (key: string) => {
    state.map.delete(key)
  },
  getAllKeysSync: () => [...state.map.keys()],
}))

// One object, read live, as Clerk's is.
const clerk = vi.hoisted(() => ({
  get session() {
    return state.sessionId ? { id: state.sessionId } : state.sessionId
  },
  signOut: (options: unknown) => {
    state.signedOutWith.push([...state.map.keys()])
    state.signOutArgs.push(options)
    return state.signOut()
  },
  setActive: (options: unknown) => {
    state.activated.push(options)
    return Promise.resolve()
  },
}))

vi.mock('expo-sqlite/kv-store', () => ({ default: store }))
vi.mock('@clerk/expo', () => ({
  useClerk: () => clerk,
}))
vi.mock('convex/react', () => ({
  useMutation: (name: string) => (args: unknown) => {
    state.released.push([name, args])
    return state.release()
  },
}))
vi.mock('../convex/api', () => ({
  api: { notifications: { releaseDevice: 'notifications:releaseDevice' } },
}))
vi.mock('react-native', () => ({
  AppState: { addEventListener: () => ({ remove: () => {} }) },
  Platform: { OS: 'ios' },
}))
vi.mock('expo-constants', () => ({ default: { expoConfig: null } }))
vi.mock('expo-notifications', () => ({ setNotificationHandler: () => {} }))

const registration = { token: 'ExponentPushToken[1]', sessionId: 'sess_1' }
const RELEASE_KEY = 'gather:push:release'
const entry = entryKey(diskScope('user_alex'), 'loyaltyCards:list', {}) ?? ''

const hooks = { useForgetAccount, useSignOut }
let view: ReturnType<typeof mount> | undefined

function leave(hook: keyof typeof hooks) {
  const useHook = hooks[hook]
  let run = () => {}
  function Leave() {
    run = useHook()
    return null
  }
  view = mount(<Leave />)
  act(() => run())
}

beforeEach(() => {
  state.map.clear()
  state.released = []
  state.release = () => Promise.resolve()
  state.signedOutWith = []
  state.signOutArgs = []
  state.signOut = () => Promise.resolve()
  state.activated = []
  state.sessionId = 'sess_1'
  setStoreForTests(store as never)
  writeRetainedGroup('group_1')
  recordOpenCard({ cardId: 'card_1', groupId: 'group_1', groupSlug: 'home' })
  confirmAccount('user_alex')
  writeEntry(entry, [])
  rememberRegisteredPush(registration)
})

afterEach(() => {
  view?.unmount()
  view = undefined
  setStoreForTests(undefined)
})

test.each(['useForgetAccount', 'useSignOut'] as const)(
  '%s clears the retained Group, the open card and the saved query copy, and releases the push registration',
  async (hook) => {
    expect(readRetainedGroup()).toBe('group_1')
    expect(readOpenCard()?.cardId).toBe('card_1')
    expect(state.map.has(entry)).toBe(true)
    expect(registeredPush()).toEqual(registration)

    leave(hook)

    // Everything goes at once; the release stays until the server confirms.
    expect([...state.map.keys()]).toEqual([RELEASE_KEY])
    expect(pendingPushRelease()).toEqual(registration)
    expect(state.released).toEqual([
      ['notifications:releaseDevice', registration],
    ])

    await settle()
    expect(pendingPushRelease()).toBeNull()
  },
)

test.each(['useForgetAccount', 'useSignOut'] as const)(
  '%s keeps a release that did not reach the server, to send again',
  async (hook) => {
    state.release = () => Promise.reject(new Error('offline'))
    leave(hook)
    await settle()
    expect(pendingPushRelease()).toEqual(registration)
  },
)

test.each(['useForgetAccount', 'useSignOut'] as const)(
  '%s releases nothing when this phone registered nothing',
  (hook) => {
    state.map.delete('gather:push:registration')
    leave(hook)
    expect(state.released).toEqual([])
  },
)

test('useSignOut ends the Clerk session once, after the clears', () => {
  leave('useSignOut')
  expect(state.signedOutWith).toEqual([[RELEASE_KEY]])
})

test('useSignOut ends only the session that is current when it runs (APP-824)', async () => {
  function Leave() {
    run = useSignOut()
    return null
  }
  let run = () => {}
  view = mount(<Leave />)
  state.sessionId = 'sess_2'
  act(() => run())
  await settle()
  expect(state.signOutArgs).toEqual([{ sessionId: 'sess_2' }])
  expect(state.activated).toEqual([])
})

test('useEndSession ends only the named session (APP-824)', () => {
  function Leave() {
    run = useEndSession()
    return null
  }
  let run: (sessionId: string) => void = () => {}
  view = mount(<Leave />)
  state.sessionId = null
  act(() => run('sess_1'))
  expect(state.signOutArgs).toEqual([{ sessionId: 'sess_1' }])
  expect(state.signedOutWith).toEqual([[RELEASE_KEY]])
})

test.each([null, undefined])(
  'useSignOut with no current session (%s) clears the phone and ends no other one (APP-824)',
  (sessionId) => {
    state.sessionId = sessionId
    leave('useSignOut')
    expect(state.signOutArgs).toEqual([])
    expect([...state.map.keys()]).toEqual([RELEASE_KEY])
  },
)

test('a sign-out Clerk refuses still leaves the account (APP-824)', async () => {
  state.signOut = () => {
    state.sessionId = undefined
    return Promise.reject(new Error('refused'))
  }
  leave('useSignOut')
  await settle()
  expect(state.activated).toEqual([{ session: null }])
})

test('a refused sign-out leaves a session that became current meanwhile alone (APP-824)', async () => {
  state.signOut = () => {
    state.sessionId = 'sess_2'
    return Promise.reject(new Error('refused'))
  }
  leave('useSignOut')
  await settle()
  expect(state.activated).toEqual([])
})

test('useForgetAccount leaves the Clerk session alone', async () => {
  leave('useForgetAccount')
  await settle()
  expect(state.signedOutWith).toEqual([])
})
