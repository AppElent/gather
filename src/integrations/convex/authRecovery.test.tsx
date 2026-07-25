import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import {
  ConvexAuthRecoveryProvider,
  ConvexAuthWatchdog,
  MAX_RECOVERY_ATTEMPTS,
  RECOVERY_RETRY_DELAYS_MS,
  STUCK_LOADING_MS,
  useConvexAuthRecovery,
  useConvexAuthRetryNonce,
} from './authRecovery'

const clerk = vi.hoisted(() => ({
  isLoaded: true,
  isSignedIn: true as boolean | undefined,
}))
const convexAuth = vi.hoisted(() => ({
  isLoading: false,
  isAuthenticated: false,
}))

vi.mock('@clerk/clerk-react', () => ({ useAuth: () => clerk }))
vi.mock('convex/react', () => ({ useConvexAuth: () => convexAuth }))

function Probe() {
  const nonce = useConvexAuthRetryNonce()
  const { failed, retry } = useConvexAuthRecovery()

  return (
    <>
      <span data-testid="nonce">{nonce}</span>
      <span data-testid="failed">{String(failed)}</span>
      <button type="button" onClick={retry}>
        Try again
      </button>
    </>
  )
}

// Built fresh on every call: re-rendering an identical element reference makes
// React bail out of the subtree, and the watchdog would never see new auth state.
const tree = () => (
  <ConvexAuthRecoveryProvider>
    <ConvexAuthWatchdog />
    <Probe />
  </ConvexAuthRecoveryProvider>
)

function renderWatchdog() {
  const view = render(tree())
  /** Re-render after mutating the mocked Clerk/Convex auth state. */
  return () => {
    act(() => {
      view.rerender(tree())
    })
  }
}

const nonce = () => Number(screen.getByTestId('nonce').textContent)
const failed = () => screen.getByTestId('failed').textContent === 'true'

const advance = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

/** Run past every automatic attempt plus the final give-up window. */
const advancePastAllAttempts = () => {
  const longestDelay = Math.max(...RECOVERY_RETRY_DELAYS_MS, STUCK_LOADING_MS)
  for (let i = 0; i <= MAX_RECOVERY_ATTEMPTS; i++) advance(longestDelay + 1)
}

beforeEach(() => {
  vi.useFakeTimers()
  clerk.isLoaded = true
  clerk.isSignedIn = true
  convexAuth.isLoading = false
  convexAuth.isAuthenticated = false
})

afterEach(() => {
  vi.useRealTimers()
})

test('re-runs the handshake when Convex settles unauthenticated', () => {
  renderWatchdog()
  expect(nonce()).toBe(0)

  advance(RECOVERY_RETRY_DELAYS_MS[0] + 1)

  expect(nonce()).toBe(1)
  expect(failed()).toBe(false)
})

test('re-runs the handshake when Convex never settles at all', () => {
  convexAuth.isLoading = true
  renderWatchdog()

  advance(RECOVERY_RETRY_DELAYS_MS[0] + 1)
  expect(nonce()).toBe(0)

  advance(STUCK_LOADING_MS)
  expect(nonce()).toBe(1)
})

test('reports failure once the automatic attempts are spent', () => {
  renderWatchdog()

  advancePastAllAttempts()

  expect(failed()).toBe(true)
  expect(nonce()).toBe(MAX_RECOVERY_ATTEMPTS)
})

test('stops retrying after reporting failure', () => {
  renderWatchdog()
  advancePastAllAttempts()

  const settled = nonce()
  advancePastAllAttempts()

  expect(nonce()).toBe(settled)
})

test('stays quiet while Convex is authenticated', () => {
  convexAuth.isAuthenticated = true
  renderWatchdog()

  advancePastAllAttempts()

  expect(nonce()).toBe(0)
  expect(failed()).toBe(false)
})

test('stays quiet when Clerk reports a signed-out visitor', () => {
  clerk.isSignedIn = false
  renderWatchdog()

  advancePastAllAttempts()

  expect(nonce()).toBe(0)
  expect(failed()).toBe(false)
})

test('clears the failure and restores the attempt budget on a manual retry', () => {
  renderWatchdog()
  advancePastAllAttempts()
  expect(failed()).toBe(true)

  const beforeRetry = nonce()
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

  expect(failed()).toBe(false)
  expect(nonce()).toBe(beforeRetry + 1)

  advance(RECOVERY_RETRY_DELAYS_MS[0] + 1)
  expect(nonce()).toBe(beforeRetry + 2)
})

test('restores the attempt budget once a retry succeeds', () => {
  const refresh = renderWatchdog()
  advance(RECOVERY_RETRY_DELAYS_MS[0] + 1)
  expect(nonce()).toBe(1)

  convexAuth.isAuthenticated = true
  refresh()
  convexAuth.isAuthenticated = false
  refresh()

  advancePastAllAttempts()

  expect(nonce()).toBe(1 + MAX_RECOVERY_ATTEMPTS)
})
