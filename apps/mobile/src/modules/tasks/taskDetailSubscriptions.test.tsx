// @vitest-environment jsdom
/**
 * What the task detail screen and the Labels sheet subscribe to (APP-565).
 *
 * Both used to read `useTaskState()`: one `tasks.listByList` subscription for
 * every list of the Group. The detail screen now reads `useTaskOf()` (the
 * task's own list, placed by `tasks.listOf`) and the sheet `useGroupLabels()`
 * (one `tasks.labels`). This counts the Convex subscriptions each opens on a
 * Group with many lists, by recording every `useQuery` call and every request
 * `useQueries` is handed.
 */
import { getFunctionName } from 'convex/server'
import { beforeEach, expect, test, vi } from 'vitest'

import { mount } from '../../testing/dom'

const LISTS = 12
const HOME = 'list-3'

const calls = vi.hoisted(() => ({
  queries: [] as string[],
  batched: [] as { name: string; listId: unknown }[],
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
  useQuery: (reference: Parameters<typeof getFunctionName>[0], args: unknown) => {
    const name = getFunctionName(reference)
    if (args !== 'skip') calls.queries.push(name)
    if (name === 'taskLists:list') {
      return Array.from({ length: LISTS }, (_, index) => ({
        _id: `list-${index}`,
        name: `List ${index}`,
        provider: 'local',
        order: index,
        display: { due: false, priority: false, labels: false },
      }))
    }
    if (name === 'tasks:listOf') return HOME
    if (name === 'tasks:labels') return ['outside', 'weekly']
    return undefined
  },
  useQueries: (
    requests: Record<string, { query: unknown; args: { listId: unknown } }>,
  ) => {
    for (const request of Object.values(requests)) {
      calls.batched.push({
        name: getFunctionName(
          request.query as Parameters<typeof getFunctionName>[0],
        ),
        listId: request.args.listId,
      })
    }
    return {}
  },
}))

import { useGroupLabels, useTaskOf, useTaskState } from './store'

beforeEach(() => {
  calls.queries.length = 0
  calls.batched.length = 0
})

const listByList = () =>
  calls.batched.filter((each) => each.name === 'tasks:listByList')

test('before: each opened a listByList subscription for every list', () => {
  function Before() {
    useTaskState()
    return null
  }
  mount(<Before />).unmount()
  expect(listByList()).toHaveLength(LISTS)
})

test("after: the detail screen subscribes to the task's own list only", () => {
  function Detail() {
    useTaskOf('task-1')
    return null
  }
  mount(<Detail />).unmount()
  expect(listByList().map((each) => each.listId)).toEqual([HOME])
  expect(calls.queries.filter((name) => name === 'tasks:listOf')).toHaveLength(
    1,
  )
})

test('after: the Labels sheet opens one labels query and no listByList', () => {
  let seen: readonly string[] = []
  function Sheet() {
    seen = useGroupLabels()
    return null
  }
  mount(<Sheet />).unmount()
  expect(calls.batched).toEqual([])
  expect(calls.queries.filter((name) => name === 'tasks:labels')).toHaveLength(
    1,
  )
  expect(seen).toEqual(['outside', 'weekly'])
})
