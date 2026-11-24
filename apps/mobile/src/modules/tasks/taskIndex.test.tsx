// @vitest-environment jsdom
/**
 * What the Tasks index subscribes to (APP-430).
 *
 * The index used to read `useTaskState()`: one `tasks.listByList` subscription
 * for every list of the Group, to draw a count per list. It now reads
 * `useTaskIndex()` (one `tasks.openCounts`). This counts the Convex
 * subscriptions each opens on a Group with many lists, by recording every
 * `useQuery` call and every request `useQueries` is handed.
 */
import { getFunctionName } from 'convex/server'
import { beforeEach, expect, test, vi } from 'vitest'

import { mount } from '../../testing/dom'

const LISTS = 12

const calls = vi.hoisted(() => ({
  queries: [] as string[],
  batched: [] as string[],
}))

vi.mock('../../group/GroupProvider', () => ({
  useGroup: () => ({ group: { slug: 'our-household' } }),
}))
vi.mock('convex/react', () => ({
  useAction: () => vi.fn(),
  useConvex: () => ({}),
  useMutation: () => Object.assign(vi.fn(), { withOptimisticUpdate: vi.fn() }),
}))
vi.mock('../../convex/queries', () => ({
  useQuery: (reference: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(reference)
    calls.queries.push(name)
    if (name === 'taskLists:list') {
      return Array.from({ length: LISTS }, (_, index) => ({
        _id: `list-${index}`,
        name: `List ${index}`,
        provider: 'local',
        order: index,
        display: { due: false, priority: false, labels: false },
      }))
    }
    return undefined
  },
  useQueries: (requests: Record<string, { query: unknown }>) => {
    for (const request of Object.values(requests)) {
      calls.batched.push(
        getFunctionName(request.query as Parameters<typeof getFunctionName>[0]),
      )
    }
    return {}
  },
}))

import { useSmartLists, useTaskIndex, useTaskState } from './store'

beforeEach(() => {
  calls.queries.length = 0
  calls.batched.length = 0
})

const count = (names: string[], name: string) =>
  names.filter((each) => each === name).length

test('before: the index opened a listByList subscription for every list', () => {
  function Before() {
    useTaskState()
    useSmartLists()
    return null
  }
  const screen = mount(<Before />)
  screen.unmount()
  expect(count(calls.batched, 'tasks:listByList')).toBe(LISTS)
})

test('after: the index opens one openCounts and no listByList', () => {
  function After() {
    useTaskIndex()
    useSmartLists()
    return null
  }
  const screen = mount(<After />)
  screen.unmount()
  expect(calls.batched).toEqual([])
  expect(count(calls.queries, 'tasks:openCounts')).toBe(1)
  expect(count(calls.queries, 'tasks:smartLists')).toBe(1)
  // The lists themselves, read by both hooks; the query cache shares them.
  expect(count(calls.queries, 'taskLists:list')).toBe(2)
  expect(calls.queries.filter((name) => name === 'tasks:listByList')).toEqual(
    [],
  )
})
