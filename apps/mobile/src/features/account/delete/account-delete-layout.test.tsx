// @vitest-environment jsdom
/**
 * #233 at the place it was lost: the signed-in layout. The gates are stubbed
 * as what they do here — `GroupProvider` draws its no-Group screen instead of
 * the stack once the purge empties the Group list — and the real layout
 * decides whether a Clerk refusal survives that. Moving the deletion below
 * either gate fails this.
 */
import { act, type ReactNode, useState } from 'react'
import { afterEach, expect, test, vi } from 'vitest'

import AppLayout from '../../../../app/(app)/_layout'
import { mount, settle } from '../../../testing/dom'
import {
  type AccountDeleteValue,
  useAccountDelete,
} from './account-delete-provider'

const state = vi.hoisted(() => ({
  clerk: null as null | { reject: (cause: unknown) => void },
  purged: null as null | (() => void),
  emptyGroups: null as null | (() => void),
}))

vi.mock('@clerk/expo', () => ({
  useAuth: () => ({ isSignedIn: true }),
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
vi.mock('../../../auth/useSignOut', () => ({ useSignOut: () => () => {} }))
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
afterEach(() => view?.unmount())

test('a Clerk refusal after the purge empties the Group list is still on screen (#233)', async () => {
  view = render()
  expect(view.container.textContent).toBe('delete screen')

  act(() => deletion.start())
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

function render() {
  return mount(<AppLayout />)
}
