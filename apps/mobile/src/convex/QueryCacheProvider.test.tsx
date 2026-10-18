// @vitest-environment jsdom
/**
 * The real `convex-helpers` cache and the real Convex hooks, over a client
 * whose `watchQuery` is a controllable transport: a result exists locally only
 * while something subscribes to it, as on the real socket.
 */
import { ConvexProvider, ConvexReactClient } from 'convex/react'
import { getFunctionName, makeFunctionReference } from 'convex/server'
import { act, type ReactNode, useState } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { mount } from '../testing/dom'

const harness = vi.hoisted(() => ({
  isAuthenticated: true,
  appState: 'active' as string,
  listeners: new Set<(state: string) => void>(),
}))

vi.mock('react-native', () => ({
  AppState: {
    get currentState() {
      return harness.appState
    },
    addEventListener: (_event: string, listener: (state: string) => void) => {
      harness.listeners.add(listener)
      return { remove: () => harness.listeners.delete(listener) }
    },
  },
}))

vi.mock('convex/react', async (original) => ({
  ...(await original<typeof import('convex/react')>()),
  useConvexAuth: () => ({
    isAuthenticated: harness.isAuthenticated,
    isLoading: false,
  }),
}))

const { QueryCacheProvider } = await import('./QueryCacheProvider')
const { EXPIRATION_MS, MAX_IDLE_ENTRIES, useQueries, useQuery } = await import(
  './queries'
)

const recipes = makeFunctionReference<'query', { groupId: string }, string>(
  'recipes:list',
)

function transport() {
  const client = new ConvexReactClient('https://cache-test.convex.cloud', {
    unsavedChangesWarning: false,
    logger: false,
  })
  const listeners = new Map<string, Set<() => void>>()
  const values = new Map<string, string>()
  let adds = 0
  let owner = 'user_A'
  vi.spyOn(client, 'watchQuery').mockImplementation(((
    reference: typeof recipes,
    args: { groupId: string },
  ) => {
    const key = JSON.stringify([getFunctionName(reference), args])
    return {
      localQueryResult: () => values.get(key),
      localQueryLogs: () => undefined,
      journal: () => undefined,
      onUpdate: (callback: () => void) => {
        let subscribers = listeners.get(key)
        if (!subscribers) {
          adds++
          subscribers = new Set()
          listeners.set(key, subscribers)
          values.set(key, `${owner}:${args.groupId}`)
        }
        subscribers.add(callback)
        return () => {
          subscribers.delete(callback)
          if (subscribers.size === 0) {
            listeners.delete(key)
            values.delete(key)
          }
        }
      },
    }
  }) as unknown as ConvexReactClient['watchQuery'])
  return {
    client,
    /** Subscriptions opened on the "wire". */
    get adds() {
      return adds
    },
    /** Subscriptions open right now. */
    get open() {
      return listeners.size
    },
    signInAs: (account: string) => {
      owner = account
    },
    publish: (groupId: string, value: string) => {
      const key = JSON.stringify(['recipes:list', { groupId }])
      values.set(key, value)
      for (const notify of listeners.get(key) ?? []) notify()
    },
  }
}

/** What a screen draws: its first render matters, so it records every one. */
const renders: string[] = []
function Recipes({ groupId }: { groupId: string }) {
  const value = useQuery(recipes, { groupId })
  renders.push(value ?? 'loading')
  return <p>{value ?? 'loading'}</p>
}

function setup(remote: ReturnType<typeof transport>) {
  let state = { account: 'user_A', confirmed: 'user_A' as string | null }
  let screen: ReactNode = <Recipes groupId="g1" />
  const tree = () => (
    <ConvexProvider client={remote.client}>
      <QueryCacheProvider
        key={state.account}
        account={state.account}
        confirmedAccount={state.confirmed}
        fallback={<p>waiting</p>}
      >
        {screen}
      </QueryCacheProvider>
    </ConvexProvider>
  )
  const view = mount(tree())
  return {
    ...view,
    show: (next: ReactNode) => {
      screen = next
      view.rerender(tree())
    },
    account: (account: string, confirmed: string | null) => {
      state = { account, confirmed }
      view.rerender(tree())
    },
  }
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

function background(state: string) {
  act(() => {
    harness.appState = state
    for (const listener of harness.listeners) listener(state)
  })
}

describe('QueryCacheProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    harness.isAuthenticated = true
    harness.appState = 'active'
    renders.length = 0
  })

  afterEach(() => {
    vi.useRealTimers()
    harness.listeners.clear()
    document.body.innerHTML = ''
  })

  test('a return within the expiration answers at once, live, with no new subscription', () => {
    const remote = transport()
    const view = setup(remote)
    expect(view.container.textContent).toBe('user_A:g1')

    view.show(null)
    advance(EXPIRATION_MS - 1_000)
    act(() => remote.publish('g1', 'updated while away'))
    renders.length = 0
    view.show(<Recipes groupId="g1" />)

    expect(renders[0]).toBe('updated while away')
    expect(remote.adds).toBe(1)
    view.unmount()
    expect(remote.open).toBe(0)
  })

  test('an abandoned subscription is released after the expiration', () => {
    const remote = transport()
    const view = setup(remote)
    view.show(null)
    advance(EXPIRATION_MS - 1)
    expect(remote.open).toBe(1)
    advance(1)
    expect(remote.open).toBe(0)

    renders.length = 0
    view.show(<Recipes groupId="g1" />)
    expect(renders[0]).toBe('loading')
    expect(remote.adds).toBe(2)
    view.unmount()
  })

  test('holds at most MAX_IDLE_ENTRIES idle subscriptions', () => {
    const remote = transport()
    const view = setup(remote)
    const groups = Array.from(
      { length: MAX_IDLE_ENTRIES + 5 },
      (_, i) => `g${i}`,
    )
    for (const groupId of groups) view.show(<Recipes groupId={groupId} />)
    view.show(null)
    expect(remote.open).toBe(MAX_IDLE_ENTRIES)
    view.unmount()
    expect(remote.open).toBe(0)
  })

  test('identical readers share one subscription; another Group is another key', () => {
    const remote = transport()
    function Both() {
      const both = useQueries({
        one: { query: recipes, args: { groupId: 'g1' } },
        two: { query: recipes, args: { groupId: 'g2' } },
      })
      return <p>{`${both.one}/${both.two}`}</p>
    }
    const view = setup(remote)
    view.show(
      <>
        <Recipes groupId="g1" />
        <Both />
      </>,
    )
    expect(view.container.textContent).toBe('user_A:g1user_A:g1/user_A:g2')
    expect(remote.adds).toBe(2)
    view.unmount()
    expect(remote.open).toBe(0)
  })

  test('a Group switch keeps the previous Group retained, so switching back is instant', () => {
    const remote = transport()
    const view = setup(remote)
    view.show(<Recipes groupId="g2" />)
    expect(remote.open).toBe(2)
    renders.length = 0
    view.show(<Recipes groupId="g1" />)
    expect(renders[0]).toBe('user_A:g1')
    expect(remote.adds).toBe(2)
    view.unmount()
  })

  test('an account change releases everything before the next account reads', () => {
    const remote = transport()
    const view = setup(remote)
    view.show(null)
    expect(remote.open).toBe(1)

    remote.signInAs('user_B')
    view.account('user_B', 'user_B')
    expect(remote.open).toBe(0)
    renders.length = 0
    view.show(<Recipes groupId="g1" />)
    expect(renders).not.toContain('user_A:g1')
    expect(view.container.textContent).toBe('user_B:g1')
    view.unmount()
  })

  test('renders the fallback, and no query, until the backend names the account', () => {
    const remote = transport()
    const view = setup(remote)
    remote.signInAs('user_B')
    view.account('user_B', 'user_A')
    expect(view.container.textContent).toBe('waiting')
    expect(remote.open).toBe(0)

    view.account('user_B', 'user_B')
    expect(view.container.textContent).toBe('user_B:g1')
    view.unmount()
  })

  test('backgrounding releases idle subscriptions, keeps mounted ones, and stops retaining', () => {
    const remote = transport()
    function Editor() {
      const [draft] = useState('unsaved draft')
      return <p>{draft}</p>
    }
    const view = setup(remote)
    view.show(
      <>
        <Editor />
        <Recipes groupId="g1" />
        <Recipes groupId="g2" />
      </>,
    )
    view.show(
      <>
        <Editor />
        <Recipes groupId="g1" />
      </>,
    )
    expect(remote.open).toBe(2)

    background('background')
    expect(remote.open).toBe(1)
    expect(view.container.textContent).toBe('unsaved draftuser_A:g1')
    view.show(<Editor />)
    expect(remote.open).toBe(0)

    background('active')
    view.show(<Recipes groupId="g1" />)
    view.show(null)
    expect(remote.open).toBe(1)
    view.unmount()
    expect(remote.open).toBe(0)
  })
})
