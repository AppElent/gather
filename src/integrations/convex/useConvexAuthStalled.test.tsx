import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import {
  AUTH_STALLED_AFTER_MS,
  useConvexAuthStalled,
} from './useConvexAuthStalled'

const clerk = vi.hoisted(() => ({
  isLoaded: true,
  isSignedIn: true as boolean | undefined,
}))
const convexAuth = vi.hoisted(() => ({ isAuthenticated: false }))

vi.mock('@clerk/clerk-react', () => ({ useAuth: () => clerk }))
vi.mock('convex/react', () => ({ useConvexAuth: () => convexAuth }))

function Probe() {
  return <span data-testid="stalled">{String(useConvexAuthStalled())}</span>
}

// Built fresh on every call: re-rendering an identical element reference makes
// React bail out of the subtree, so the hook would never see new auth state.
const tree = () => <Probe />

function renderProbe() {
  const view = render(tree())
  return () => {
    act(() => {
      view.rerender(tree())
    })
  }
}

const stalled = () => screen.getByTestId('stalled').textContent === 'true'

const advance = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  clerk.isLoaded = true
  clerk.isSignedIn = true
  convexAuth.isAuthenticated = false
})

afterEach(() => {
  vi.useRealTimers()
})

test('holds off while the handshake still has time to finish', () => {
  renderProbe()

  advance(AUTH_STALLED_AFTER_MS - 1)

  expect(stalled()).toBe(false)
})

test('reports a stall when a signed-in session never authenticates', () => {
  renderProbe()

  advance(AUTH_STALLED_AFTER_MS)

  expect(stalled()).toBe(true)
})

test('stays quiet once Convex authenticates in time', () => {
  const refresh = renderProbe()

  convexAuth.isAuthenticated = true
  refresh()
  advance(AUTH_STALLED_AFTER_MS * 2)

  expect(stalled()).toBe(false)
})

test('clears a reported stall when auth recovers', () => {
  const refresh = renderProbe()
  advance(AUTH_STALLED_AFTER_MS)
  expect(stalled()).toBe(true)

  convexAuth.isAuthenticated = true
  refresh()

  expect(stalled()).toBe(false)
})

test('stays quiet for signed-out visitors', () => {
  clerk.isSignedIn = false
  renderProbe()

  advance(AUTH_STALLED_AFTER_MS * 2)

  expect(stalled()).toBe(false)
})

test('stays quiet while Clerk is still loading', () => {
  clerk.isLoaded = false
  clerk.isSignedIn = undefined
  renderProbe()

  advance(AUTH_STALLED_AFTER_MS * 2)

  expect(stalled()).toBe(false)
})
