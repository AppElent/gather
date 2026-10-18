// @vitest-environment jsdom
import { type ConvexReactClient, useConvexAuth } from 'convex/react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { mount, until } from '../testing/dom'
import { ClerkConvexAuth } from './ClerkConvexAuth'
import { REAUTH_BACKOFF_MS } from './reauthentication'

const harness = vi.hoisted(() => ({
  clerk: { tokenAvailable: true, signedIn: true, tokenDelayMs: 0 },
  appState: null as ((state: string) => void) | null,
}))

vi.mock('@clerk/expo', () => {
  const getToken = async () => {
    if (harness.clerk.tokenDelayMs) {
      await new Promise((resolve) =>
        setTimeout(resolve, harness.clerk.tokenDelayMs),
      )
    }
    if (!harness.clerk.tokenAvailable) throw new Error('offline')
    return 'jwt'
  }
  return {
    useAuth: () => ({
      isLoaded: true,
      isSignedIn: harness.clerk.signedIn,
      getToken,
      orgId: null,
      orgRole: null,
      sessionId: 'sess_1',
      sessionClaims: undefined,
    }),
  }
})

vi.mock('react-native', () => ({
  AppState: {
    addEventListener: (_: string, listener: (state: string) => void) => {
      harness.appState = listener
      return { remove: () => {} }
    },
  },
}))

type FetchToken = (args: {
  forceRefreshToken: boolean
}) => Promise<string | null>

/**
 * The parts of `ConvexReactClient` the provider touches, with the behaviour of
 * convex 1.42's `AuthenticationManager` that matters here: a failed refresh
 * reports `false` and forgets the token fetcher, and a reconnect does not
 * bring it back. Only `setAuth` does.
 */
class FakeClient {
  setAuthCalls = 0
  private config: {
    fetchToken: FetchToken
    onChange: (authenticated: boolean) => void
  } | null = null
  private state = { isWebSocketConnected: true }
  private listeners = new Set<() => void>()

  setAuth(fetchToken: FetchToken, onChange: (ok: boolean) => void) {
    this.setAuthCalls += 1
    const config = { fetchToken, onChange }
    this.config = config
    void fetchToken({ forceRefreshToken: false }).then((token) => {
      if (this.config === config) config.onChange(token !== null)
    })
  }

  clearAuth() {
    this.config = null
  }

  /** The scheduled refresh, run while Clerk cannot mint a token. */
  async refreshFails() {
    const config = this.config
    if (!config) return
    const token = await config.fetchToken({ forceRefreshToken: true })
    if (token === null) {
      this.config = null
      config.onChange(false)
    }
  }

  setConnected(isWebSocketConnected: boolean) {
    this.state = { isWebSocketConnected }
    for (const listener of this.listeners) listener()
  }

  connectionState() {
    return this.state
  }

  subscribeToConnectionState(listener: () => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
}

function renderWithClient() {
  const client = new FakeClient()
  const seen = { authenticated: false }
  function Probe() {
    seen.authenticated = useConvexAuth().isAuthenticated
    return null
  }
  const tree = () => (
    <ClerkConvexAuth client={client as unknown as ConvexReactClient}>
      <Probe />
    </ClerkConvexAuth>
  )
  const view = mount(tree())
  return { client, seen, view, rerender: () => view.rerender(tree()) }
}

/** Clerk goes offline, the refresh fails, and the socket drops with it. */
async function loseAuthOffline(client: FakeClient) {
  harness.clerk.tokenAvailable = false
  await act(async () => {
    client.setConnected(false)
    await client.refreshFails()
  })
}

/** Advance fake time inside `act`, twice: once for what is due, once more for
 * the timers the resulting effects schedule. */
async function tick(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
}

describe('ClerkConvexAuth', () => {
  beforeEach(() => {
    harness.clerk.tokenAvailable = true
    harness.clerk.signedIn = true
    harness.clerk.tokenDelayMs = 0
  })
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  test('recovers from a failed refresh once the connection returns, without anybody tapping anything', async () => {
    const { client, seen, view } = renderWithClient()
    await until(() => seen.authenticated)
    expect(client.setAuthCalls).toBe(1)

    await loseAuthOffline(client)
    expect(seen.authenticated).toBe(false)

    // Offline there is nothing to retry: no token fetch can succeed.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(client.setAuthCalls).toBe(1)

    harness.clerk.tokenAvailable = true
    act(() => client.setConnected(true))
    await until(() => seen.authenticated)
    expect(client.setAuthCalls).toBe(2)
    view.unmount()
  })

  test('does not race an ordinary sign-in, while Convex is not yet authenticated', async () => {
    harness.clerk.signedIn = false
    harness.clerk.tokenDelayMs = 200
    const { client, seen, rerender, view } = renderWithClient()
    expect(client.setAuthCalls).toBe(0)

    // Convex now reports "not loading, not authenticated" for the length of
    // the handshake. That is not a client that has given up.
    harness.clerk.signedIn = true
    rerender()
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(client.setAuthCalls).toBe(1)
    await until(() => seen.authenticated)
    expect(client.setAuthCalls).toBe(1)
    view.unmount()
  })

  test('keeps retrying with backoff while the token still cannot be had', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { client, seen, view } = renderWithClient()
    await tick()
    expect(seen.authenticated).toBe(true)

    await loseAuthOffline(client)
    // The socket is back but Clerk is still unreachable: the first retry is
    // immediate and fails.
    act(() => client.setConnected(true))
    await tick()
    expect(client.setAuthCalls).toBe(2)
    expect(seen.authenticated).toBe(false)

    harness.clerk.tokenAvailable = true
    await tick(REAUTH_BACKOFF_MS[1] - 1)
    expect(client.setAuthCalls).toBe(2)
    await tick(1)
    expect(client.setAuthCalls).toBe(3)
    expect(seen.authenticated).toBe(true)
    view.unmount()
  })

  test('returning to the foreground retries at once instead of waiting out the backoff', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { client, seen, view } = renderWithClient()
    await tick()
    await loseAuthOffline(client)
    act(() => client.setConnected(true))
    await tick()
    expect(client.setAuthCalls).toBe(2)

    harness.clerk.tokenAvailable = true
    act(() => harness.appState?.('active'))
    await tick()
    expect(client.setAuthCalls).toBe(3)
    expect(seen.authenticated).toBe(true)
    view.unmount()
  })
})
