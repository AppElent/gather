// @vitest-environment jsdom
/**
 * #233 at the place it was lost: the signed-in layout. The gates are stubbed
 * as what they do here — `GroupProvider` draws its no-Group screen instead of
 * the stack once the purge empties the Group list — and the real layout
 * decides whether a Clerk refusal survives that. Moving the deletion below
 * either gate fails this.
 */
import { act, type ReactNode, useEffect, useState } from 'react'
import { afterEach, expect, test, vi } from 'vitest'

import AppLayout from '../../../../app/(app)/_layout'
import { mount, settle } from '../../../testing/dom'
import {
  type AccountDeleteValue,
  useAccountDelete,
} from './account-delete-provider'

const state = vi.hoisted(() => ({
  alerts: [] as [string, string][],
  clerk: null as null | { reject: (cause: unknown) => void },
  purged: null as null | (() => void),
  emptyGroups: null as null | (() => void),
  // Clerk's session, as `useAuth` reports it: signing out re-renders every
  // reader, which unmounts the signed-in layout.
  signedIn: true,
  authListeners: new Set<() => void>(),
}))

function setSignedIn(signedIn: boolean) {
  state.signedIn = signedIn
  for (const listener of state.authListeners) listener()
}

vi.mock('@clerk/expo', () => ({
  useAuth: function useAuth() {
    const [isSignedIn, setIsSignedIn] = useState(state.signedIn)
    useEffect(() => {
      const listener = () => setIsSignedIn(state.signedIn)
      state.authListeners.add(listener)
      return () => {
        state.authListeners.delete(listener)
      }
    }, [])
    return { isSignedIn }
  },
  useUser: () => ({
    user: {
      deleteSelfEnabled: true,
      delete: () =>
        new Promise<void>((_, reject) => {
          state.clerk = { reject }
        }),
    },
  }),
}))
vi.mock('convex/react', () => ({
  useMutation: () => () =>
    new Promise<void>((resolve) => {
      state.purged = resolve
    }),
  useAction: () => () => Promise.resolve(null),
}))
// No Apple account here; the Apple step has its own tests.
vi.mock('./apple-revocation', () => ({
  revokeAppleSignIn: () => Promise.resolve('continue'),
}))
vi.mock('expo-router', () => {
  function Stack({ children }: { children: ReactNode }) {
    return (
      <>
        {children}
        <DeleteScreen />
      </>
    )
  }
  Stack.Screen = () => null
  return {
    Redirect: () => <p>redirect</p>,
    Stack,
    useNavigationContainerRef: () => ({}),
  }
})
vi.mock('../../../convex/api', () => ({
  api: { accounts: { deleteAccount: 'accounts:deleteAccount' } },
}))
vi.mock('../../../auth/useSignOut', () => ({
  useSignOut: () => () => setSignedIn(false),
}))
vi.mock('../../../auth/ConvexSessionGate', () => ({
  ConvexSessionGate: ({ children }: { children: ReactNode }) => children,
}))
vi.mock('../../../group/GroupProvider', () => ({
  GroupProvider: function GroupProvider({
    children,
    none,
  }: {
    children: ReactNode
    none: ReactNode
  }) {
    const [inAGroup, setInAGroup] = useState(true)
    state.emptyGroups = () => setInAGroup(false)
    return inAGroup ? children : none
  },
}))
vi.mock('../../../group/groupUnwind', () => ({ groupUnwindActions: () => [] }))
vi.mock('../../../components/GroupPending', () => ({
  GroupPending: () => null,
}))
vi.mock('../../../components/NoGroup', () => ({
  NoGroup: () => <p>no group</p>,
}))
vi.mock('../../../drop/DropGate', () => ({ DropGate: () => null }))
vi.mock('../../notifications/push/push-permission-provider', () => ({
  PushPermissionProvider: ({ children }: { children: ReactNode }) => children,
}))
vi.mock('react-native', () => ({
  Alert: {
    alert: (title: string, body: string) => state.alerts.push([title, body]),
  },
}))
vi.mock('../../../i18n', async () => {
  const { en } = await import('../../../i18n/messages/en')
  return { useI18n: () => ({ t: en }) }
})
vi.mock('../../../theme/tokens', () => ({ useTokens: () => ({ bg: '#fff' }) }))
vi.mock('./account-delete-underway-screen', () => ({
  AccountDeleteUnderwayScreen: ({
    state: current,
  }: Pick<AccountDeleteValue, 'state'>) => <p>underway: {current.step}</p>,
}))

let deletion: AccountDeleteValue
function DeleteScreen() {
  deletion = useAccountDelete()
  return <p>delete screen</p>
}

let view: ReturnType<typeof mount> | undefined
afterEach(() => {
  view?.unmount()
  state.alerts = []
  state.signedIn = true
  state.authListeners.clear()
})

test('a Clerk refusal after the purge empties the Group list is still on screen (#233)', async () => {
  view = render()
  expect(view.container.textContent).toBe('delete screen')

  act(() => deletion.start('wholeAccount'))
  // Past the Apple step (APP-213), so the purge has been asked for.
  await settle()
  // The scheduled purge empties `groups.myGroups` before the mutation's
  // answer is back, and `GroupProvider` swaps the delete screen out.
  act(() => {
    state.emptyGroups?.()
    state.purged?.()
  })
  await settle()
  expect(view.container.textContent).toBe('underway: deletingLogin')

  act(() => state.clerk?.reject(new Error('Clerk refused')))
  await settle()
  expect(view.container.textContent).toBe('underway: stranded')
})

test('Gather data only: the confirmation survives the sign-out that unmounts the layout (APP-397)', async () => {
  view = render()

  act(() => deletion.start('gatherData'))
  await settle()
  act(() => state.purged?.())
  await settle()

  // Signed out: the layout, the deletion provider and its underway screen
  // are all gone, so nothing they draw could say the data is deleted.
  expect(view.container.textContent).toBe('redirect')
  // The native alert was raised once and outlives them, on the welcome screen.
  expect(state.alerts).toEqual([
    [
      'Your Gather data is deleted',
      'You are signed out of Gather on this device. Your AppElent login still works in Foundry, Fairway and Arcade Club.',
    ],
  ])
  await settle()
  expect(state.alerts).toHaveLength(1)
})

function render() {
  return mount(<AppLayout />)
}
