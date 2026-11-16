// @vitest-environment jsdom
/**
 * Layer 2 of `queries.ts`: what a display read shows before Convex answers,
 * and what it writes once it has.
 */
import { makeFunctionReference } from 'convex/server'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { mount } from '../testing/dom'

const harness = vi.hoisted(() => ({
  isAuthenticated: true,
  live: new Map<string, unknown>(),
}))

vi.mock('convex/react', async (original) => ({
  ...(await original<typeof import('convex/react')>()),
  useConvexAuth: () => ({ isAuthenticated: harness.isAuthenticated, isLoading: false }),
}))

vi.mock('convex-helpers/react/cache', () => ({
  useQuery: (query: unknown) =>
    harness.live.get((query as { name: string }).name),
  useQueries: (queries: Record<string, { query: { name: string } }>) =>
    Object.fromEntries(
      Object.entries(queries).map(([id, { query }]) => [id, harness.live.get(query.name)]),
    ),
}))

vi.mock('convex/server', async (original) => {
  const real = await original<typeof import('convex/server')>()
  return {
    ...real,
    getFunctionName: (ref: { name?: string }) => ref.name ?? real.getFunctionName(ref as never),
  }
})

const { DiskScopeContext, isOfflineReadable, useLiveQuery, useQueries, useQuery } =
  await import('./queries')
const { diskScope, entryKey, setStoreForTests } = await import('./lastKnown')

const list = Object.assign(
  makeFunctionReference<'query', { groupSlug: string }, unknown>('loyaltyCards:list'),
  { name: 'loyaltyCards:list' },
)
const other = Object.assign(
  makeFunctionReference<'query', { groupSlug: string }, unknown>('recipes:list'),
  { name: 'recipes:list' },
)

const map = new Map<string, string>()
const card = {
  _id: 'k1',
  storeName: 'HEMA',
  cardNumber: '123',
  barcodeFormat: 'CODE_128',
  note: 'secret',
  lastUsedAt: 1,
}
const scope = diskScope('user_a')
const listKey = entryKey(scope, 'loyaltyCards:list', { groupSlug: 'home' }) as string

beforeEach(() => {
  map.clear()
  harness.live.clear()
  harness.isAuthenticated = true
  setStoreForTests({
    getItemSync: (k: string) => map.get(k) ?? null,
    setItemSync: (k: string, v: string) => void map.set(k, v),
    removeItemSync: (k: string) => void map.delete(k),
    getAllKeysSync: () => [...map.keys()],
  } as never)
})
afterEach(() => setStoreForTests(undefined))

function render(read: () => unknown, at: string | null = scope) {
  const seen: unknown[] = []
  function Probe() {
    seen.push(read())
    return null
  }
  const view = mount(
    <DiskScopeContext value={at ?? undefined}>
      <Probe />
    </DiskScopeContext>,
  )
  return { seen, view }
}

describe('useQuery', () => {
  test('writes only the drawn fields once Convex answers', () => {
    harness.live.set('loyaltyCards:list', [card])
    const { seen, view } = render(() => useQuery(list, { groupSlug: 'home' }))
    expect(seen.at(-1)).toEqual([card])
    expect(JSON.parse(map.get(listKey) as string)).toEqual([
      { _id: 'k1', storeName: 'HEMA', cardNumber: '123', barcodeFormat: 'CODE_128' },
    ])
    view.unmount()
  })

  test('shows the copy while authenticated and connected, until live arrives', () => {
    map.set(listKey, JSON.stringify([{ _id: 'k1' }]))
    const { seen, view } = render(() => useQuery(list, { groupSlug: 'home' }))
    expect(seen.at(-1)).toEqual([{ _id: 'k1' }])
    view.unmount()
  })

  test('never shows the copy while disconnected or unauthenticated', () => {
    map.set(listKey, JSON.stringify([{ _id: 'k1' }]))
    // Disconnected: the provider gives no scope.
    const a = render(() => useQuery(list, { groupSlug: 'home' }), null)
    expect(a.seen.at(-1)).toBeUndefined()
    a.view.unmount()
    harness.isAuthenticated = false
    const b = render(() => useQuery(list, { groupSlug: 'home' }))
    expect(b.seen.at(-1)).toBeUndefined()
    b.view.unmount()
  })

  test('a function outside the allowlist never touches disk', () => {
    harness.live.set('recipes:list', ['soup'])
    const { view } = render(() => useQuery(other, { groupSlug: 'home' }))
    expect(map.size).toBe(0)
    view.unmount()
  })

  test('useLiveQuery skips the copy', () => {
    map.set(listKey, JSON.stringify([{ _id: 'k1' }]))
    const { seen, view } = render(() => useLiveQuery(list, { groupSlug: 'home' }))
    expect(seen.at(-1)).toBeUndefined()
    view.unmount()
  })
})

test('only persisted functions of offline-readable modules are offline-readable', () => {
  expect(isOfflineReadable('loyaltyCards:list')).toBe(true)
  expect(isOfflineReadable('loyaltyCards:get')).toBe(false)
  expect(isOfflineReadable('recipes:list')).toBe(false)
})

describe('useQueries', () => {
  test('falls back per request, and keeps errors as errors', () => {
    map.set(listKey, JSON.stringify([{ _id: 'k1' }]))
    const failure = new Error('refused')
    harness.live.set('recipes:list', failure)
    const { seen, view } = render(() =>
      useQueries({
        cards: { query: list, args: { groupSlug: 'home' } },
        recipes: { query: other, args: { groupSlug: 'home' } },
      }),
    )
    expect(seen.at(-1)).toEqual({ cards: [{ _id: 'k1' }], recipes: failure })
    view.unmount()
  })
})
