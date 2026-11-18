// @vitest-environment jsdom
import { act } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { mount, settle } from '../testing/dom'
import { AvailabilityProvider, useAvailability } from './AvailabilityProvider'

const clerk = vi.hoisted(() => ({
  status: 'error' as 'error' | 'ready',
  load: vi.fn(async () => {}),
  reloadInitialResources: vi.fn(async () => {}),
  sessionReload: vi.fn(async () => {}),
}))

vi.mock('@clerk/expo', () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true }),
  useClerk: () => ({ status: clerk.status }),
  useSession: () => ({ session: { reload: clerk.sessionReload } }),
  getClerkInstance: () => ({
    load: clerk.load,
    __internal_reloadInitialResources: clerk.reloadInitialResources,
  }),
}))

vi.mock('convex/react', () => ({
  useConvexAuth: () => ({ isAuthenticated: false }),
  useConvexConnectionState: () => ({
    isWebSocketConnected: false,
    hasEverConnected: false,
  }),
}))

vi.mock('../auth/config', () => ({ publishableKey: 'pk_test_x' }))

let current: ReturnType<typeof useAvailability> | undefined

function Probe() {
  current = useAvailability()
  return null
}

beforeEach(() => {
  clerk.load.mockClear()
  clerk.reloadInitialResources.mockClear()
  clerk.sessionReload.mockClear()
})

afterEach(() => {
  document.body.innerHTML = ''
  current = undefined
})

// The bug (APP-234): retry called `load()` with no options, which on a native
// build re-ran Clerk from its browser defaults (`standardBrowser: true`)
// while it was in `error`, and did nothing once it was loaded.
test.each(['error', 'ready'] as const)(
  'Try again reloads Clerk the native way when Clerk is %s, never through load()',
  async (status) => {
    clerk.status = status
    mount(
      <AvailabilityProvider>
        <Probe />
      </AvailabilityProvider>,
    )

    act(() => current?.retry())
    expect(current?.retrying).toBe(true)
    await settle()

    expect(clerk.load).not.toHaveBeenCalled()
    expect(clerk.reloadInitialResources).toHaveBeenCalledTimes(1)
    expect(clerk.sessionReload).toHaveBeenCalledTimes(1)
    expect(current?.retrying).toBe(false)
  },
)

test('a failed reload ends the retry, so Try again can be pressed again', async () => {
  clerk.status = 'error'
  clerk.reloadInitialResources.mockRejectedValueOnce(new Error('offline'))
  mount(
    <AvailabilityProvider>
      <Probe />
    </AvailabilityProvider>,
  )

  act(() => current?.retry())
  await settle()
  expect(current?.retrying).toBe(false)
  expect(clerk.sessionReload).not.toHaveBeenCalled()

  act(() => current?.retry())
  await settle()
  expect(clerk.reloadInitialResources).toHaveBeenCalledTimes(2)
})
