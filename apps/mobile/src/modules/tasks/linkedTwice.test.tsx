// @vitest-environment jsdom
/** One Todoist project linked to two lists of a Group (APP-799). */
import { getFunctionName } from 'convex/server'
import { expect, test, vi } from 'vitest'

import { mount, settle } from '../../testing/dom'

const getTasks = vi.hoisted(() => vi.fn())

vi.mock('../../group/GroupProvider', () => ({
  useGroup: () => ({ group: { slug: 'our-household' } }),
}))
vi.mock('convex/react', () => ({
  useAction: () => getTasks,
  useConvex: () => ({}),
  useMutation: () => Object.assign(vi.fn(), { withOptimisticUpdate: vi.fn() }),
}))
vi.mock('../../convex/queries', () => {
  const lists = ['one', 'two'].map((id, order) => ({
    _id: id,
    name: id,
    provider: 'todoist',
    capabilities: { write: true },
    order,
    display: { due: false, priority: false, labels: false },
  }))
  return {
    useQuery: (reference: Parameters<typeof getFunctionName>[0]) =>
      getFunctionName(reference) === 'taskLists:list' ? lists : null,
    useQueries: () => ({}),
  }
})

import { syncExternalList, useTaskOf } from './store'

const row = { externalId: 'a', title: 'a', done: false }
const holding = (...tasks: (typeof row)[]) =>
  Promise.resolve({ status: 'ok' as const, tasks })

function open(listId?: string) {
  let state = {} as ReturnType<typeof useTaskOf>
  function Detail() {
    state = useTaskOf('a', listId)
    return null
  }
  const view = mount(<Detail />)
  return { state: () => state, unmount: view.unmount }
}

test('a task opens in the list it was opened from', async () => {
  getTasks.mockImplementation(() => holding(row))
  // Only the other list has answered: the opened one is fetched and waited for.
  await syncExternalList('one', () => holding(row))
  const second = open('two')
  expect(second.state().task).toBeUndefined()
  await settle()
  expect(second.state().task?.listId).toBe('two')
  expect(second.state().lists.map((list) => list.id)).toEqual(['two'])

  const first = open('one')
  expect(first.state().task?.listId).toBe('one')
  // From Recents or Search there is no list: the first that holds it.
  const any = open()
  expect(any.state().task?.listId).toBe('one')

  // Gone from its list, it does not turn into the other list's task.
  await syncExternalList('two', () => holding())
  await settle()
  expect(second.state().task).toBeUndefined()
  for (const view of [first, second, any]) view.unmount()
})
