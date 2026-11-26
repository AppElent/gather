// @vitest-environment jsdom
import { act, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { mount } from '../testing/dom'
import { ConvexSessionGate, GATE_STUCK_MS } from './ConvexSessionGate'

const harness = vi.hoisted(() => ({
  isAuthenticated: true,
  /** What `users.me` answers: a Clerk id, `null` for no row, `undefined`
   * while unanswered. */
  viewer: undefined as string | null | undefined,
  provisioningFailed: false,
  provisioningDeleted: false,
  /** This phone is running a deletion (`AccountDeleteProvider`). */
  deleting: false,
  reauthenticate: vi.fn(),
  retryProvisioning: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('@clerk/expo', () => ({ useAuth: () => ({ userId: 'user_A' }) }))

vi.mock('convex/react', () => ({
  useConvexAuth: () => ({ isAuthenticated: harness.isAuthenticated }),
  useQueries: (queries: Record<string, unknown>) =>
    'me' in queries
      ? {
          me:
            typeof harness.viewer === 'string'
              ? { clerkId: harness.viewer }
              : harness.viewer,
        }
      : {},
}))

vi.mock('../convex/useEnsureUser', () => ({
  useEnsureUser: () => ({
    failed: harness.provisioningFailed,
    deleted: harness.provisioningDeleted,
    retry: harness.retryProvisioning,
  }),
}))

vi.mock('../features/account/delete/account-delete-provider', () => ({
  useDeletionInProgress: () => harness.deleting,
}))

// The retention provider is the query module's own suite (`QueryCacheProvider.test.tsx`);
// here it only has to let an open gate's children through.
vi.mock('../convex/QueryCacheProvider', () => ({
  QueryCacheProvider: (props: { children: ReactNode }) => props.children,
}))

vi.mock('../convex/ClerkConvexAuth', () => ({
  useReauthenticate: () => harness.reauthenticate,
}))

vi.mock('../components/SessionError', () => ({
  SessionError: (props: { onRetry: () => void; onSignOut: () => void }) => (
    <div>
      <button type="button" onClick={props.onRetry}>
        Try again
      </button>
      <button type="button" onClick={props.onSignOut}>
        Sign out
      </button>
    </div>
  ),
  AccountBeingDeleted: (props: { onSignOut: () => void }) => (
    <div>
      <p>Being deleted</p>
      <button type="button" onClick={props.onSignOut}>
        Sign out
      </button>
    </div>
  ),
}))

vi.mock('../theme/tokens', () => ({ useTokens: () => ({ bg: '#fff' }) }))

vi.mock('react-native', () => ({
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}))

function renderGate() {
  const tree = () => (
    <ConvexSessionGate pending={<p>Loading</p>} onSignOut={harness.signOut}>
      <p>signed-in tree</p>
    </ConvexSessionGate>
  )
  const view = mount(tree())
  return { ...view, rerender: () => view.rerender(tree()) }
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

function button(container: HTMLElement, label: string) {
  return [...container.querySelectorAll('button')].find(
    (candidate) => candidate.textContent === label,
  )
}

describe('ConvexSessionGate', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    harness.isAuthenticated = true
    harness.viewer = undefined
    harness.provisioningFailed = false
    harness.provisioningDeleted = false
    harness.deleting = false
    harness.reauthenticate.mockReset()
    harness.retryProvisioning.mockReset()
    harness.signOut.mockReset()
  })
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  test('opens once the backend vouches for the Clerk user', () => {
    harness.viewer = 'user_A'
    const { container } = renderGate()
    expect(container.textContent).toBe('signed-in tree')
  })

  test('a token Convex keeps rejecting ends on Try again or Sign out, not an endless loading screen', async () => {
    harness.isAuthenticated = false
    const { container } = renderGate()
    await advance(1_000)
    expect(container.textContent).toBe('Loading')

    await advance(GATE_STUCK_MS)
    expect(button(container, 'Sign out')).toBeDefined()

    act(() => button(container, 'Sign out')?.click())
    expect(harness.signOut).toHaveBeenCalledOnce()
  })

  test('Try again asks Convex to authenticate afresh, re-runs provisioning, and restarts the clock', async () => {
    harness.isAuthenticated = false
    const { container } = renderGate()
    await advance(GATE_STUCK_MS)

    act(() => button(container, 'Try again')?.click())
    expect(harness.reauthenticate).toHaveBeenCalledOnce()
    expect(harness.retryProvisioning).toHaveBeenCalledOnce()
    expect(container.textContent).toBe('Loading')

    await advance(GATE_STUCK_MS)
    expect(button(container, 'Try again')).toBeDefined()
  })

  test('a provisioning refusal offers the way out without waiting', async () => {
    harness.viewer = null
    harness.provisioningFailed = true
    const { container } = renderGate()
    expect(button(container, 'Try again')).toBeDefined()
  })

  test('an account another phone is deleting says so and offers Sign out alone, without waiting', async () => {
    harness.viewer = null
    harness.provisioningDeleted = true
    const { container } = renderGate()
    expect(container.textContent).toContain('Being deleted')
    expect(button(container, 'Try again')).toBeUndefined()

    await advance(GATE_STUCK_MS)
    expect(container.textContent).toContain('Being deleted')

    act(() => button(container, 'Sign out')?.click())
    expect(harness.signOut).toHaveBeenCalledOnce()
  })

  test('a phone already open when its account starts being deleted asks again and says so, without waiting (APP-949)', async () => {
    harness.viewer = 'user_A'
    const { container, rerender } = renderGate()
    expect(container.textContent).toBe('signed-in tree')

    // Another phone starts the deletion: `users.me` turns null.
    harness.viewer = null
    rerender()
    await advance(0)
    expect(harness.retryProvisioning).toHaveBeenCalledOnce()

    // The re-run is refused for the deletion.
    harness.provisioningDeleted = true
    rerender()
    expect(container.textContent).toContain('Being deleted')
    expect(button(container, 'Try again')).toBeUndefined()

    rerender()
    await advance(1_000)
    expect(harness.retryProvisioning).toHaveBeenCalledOnce()
  })

  test('a row that comes back resets the watch, so a later loss asks again', async () => {
    harness.viewer = 'user_A'
    const { container, rerender } = renderGate()

    harness.viewer = null
    rerender()
    await advance(0)
    expect(harness.retryProvisioning).toHaveBeenCalledOnce()

    // Gather data only: the retry provisions a fresh account.
    harness.viewer = 'user_A'
    rerender()
    await advance(0)
    expect(container.textContent).toBe('signed-in tree')

    harness.viewer = null
    rerender()
    await advance(0)
    expect(harness.retryProvisioning).toHaveBeenCalledTimes(2)
  })

  test('the phone running the deletion does not re-run provisioning', async () => {
    harness.viewer = 'user_A'
    const { rerender } = renderGate()

    harness.deleting = true
    harness.viewer = null
    rerender()
    await advance(1_000)
    expect(harness.retryProvisioning).not.toHaveBeenCalled()
  })

  test('a first sign-in with no row yet does not re-run provisioning', async () => {
    harness.viewer = null
    const { rerender } = renderGate()
    rerender()
    await advance(1_000)
    expect(harness.retryProvisioning).not.toHaveBeenCalled()
  })

  test('a gate that closes again later starts a fresh clock', async () => {
    harness.viewer = 'user_A'
    const { container, rerender } = renderGate()
    await advance(GATE_STUCK_MS * 2)
    expect(container.textContent).toBe('signed-in tree')

    harness.isAuthenticated = false
    harness.viewer = undefined
    rerender()
    await advance(1_000)
    expect(container.textContent).toBe('Loading')
  })
})
