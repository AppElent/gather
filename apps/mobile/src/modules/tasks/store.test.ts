import type { OptimisticLocalStore } from 'convex/browser'
import { getFunctionName } from 'convex/server'
import { describe, expect, test, vi } from 'vitest'

import type { Doc, Id } from '../../convex/api'

const sent: { name: string; args: unknown }[] = []

vi.mock('../../group/GroupProvider', () => ({
  useGroup: () => ({ group: { slug: 'our-household' } }),
}))
vi.mock('convex/react', () => ({
  useAction: vi.fn(),
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) => {
    const run = (args: unknown) => {
      sent.push({ name: getFunctionName(reference), args })
      return Promise.resolve()
    }
    return Object.assign(run, { withOptimisticUpdate: () => run })
  },
}))

import {
  ensureExternalLists,
  externalSnapshot,
  localTaskQueries,
  mergeTasks,
  syncExternalList,
  taskSections,
  toggleInPlace,
  useTaskActions,
} from './store'
import type { TaskList } from './types'

const display = { due: false, priority: false, labels: false }

function listRow(id: string, provider: 'local' | 'notion' | 'todoist') {
  return {
    _id: id as Id<'taskLists'>,
    name: id,
    provider,
    order: 0,
    display,
    writable: provider === 'local',
  }
}

function taskRow(id: string, listId: string, done = false) {
  return {
    _id: id as Id<'tasks'>,
    _creationTime: 0,
    listId: listId as Id<'taskLists'>,
    title: id,
    done,
    createdBy: 'user' as Id<'users'>,
    order: 0,
  } satisfies Doc<'tasks'>
}

const provided = (titles: string[]) => () =>
  Promise.resolve({
    status: 'ok' as const,
    tasks: titles.map((title) => ({
      externalId: title,
      title,
      done: false,
    })),
  })

describe('localTaskQueries', () => {
  test('builds requests only for local lists in the active Group', () => {
    const queries = localTaskQueries(
      [
        { _id: 'local-list' as Id<'taskLists'>, provider: 'local' },
        { _id: 'notion-list' as Id<'taskLists'>, provider: 'notion' },
      ],
      'our-household',
    )

    expect(Object.keys(queries)).toEqual(['local-list'])
    expect(getFunctionName(queries['local-list'].query)).toBe(
      'tasks:listByList',
    )
    expect(queries['local-list'].args).toEqual({
      listId: 'local-list',
      groupSlug: 'our-household',
    })
  })
})

describe('one model for local and linked lists', () => {
  test('a local list is live once Convex answers, loading before, failed on an error', () => {
    const { lists, tasks } = mergeTasks(
      [
        listRow('answered', 'local'),
        listRow('waiting', 'local'),
        listRow('broken', 'local'),
      ],
      {
        answered: [taskRow('bins', 'answered')],
        broken: new Error('List not found'),
      },
      new Map(),
    )

    expect(lists.map((list) => [list.id, list.sync])).toEqual([
      ['answered', 'live'],
      ['waiting', 'loading'],
      ['broken', 'failed'],
    ])
    expect(tasks).toEqual([
      expect.objectContaining({ id: 'bins', listId: 'answered', labels: [] }),
    ])
  })

  test('a linked list shows its last answer with how that answer went', () => {
    const { lists, tasks } = mergeTasks(
      [listRow('notion', 'notion'), listRow('todoist', 'todoist')],
      {},
      new Map([
        [
          'notion',
          {
            sync: 'reconnect' as const,
            tasks: [
              {
                id: 'kept',
                listId: 'notion',
                title: 'kept',
                done: false,
                labels: [],
                order: 0,
              },
            ],
          },
        ],
      ]),
    )

    expect(lists.map((list) => [list.id, list.sync])).toEqual([
      ['notion', 'reconnect'],
      ['todoist', 'loading'],
    ])
    expect(tasks.map((task) => task.id)).toEqual(['kept'])
  })
})

describe('a linked list asks its provider once, then on request', () => {
  test('opening it twice fetches once; a refresh fetches again', async () => {
    const fetchTasks = vi.fn(provided(['Water the plants']))

    ensureExternalLists(['once'], fetchTasks)
    ensureExternalLists(['once'], fetchTasks)
    expect(externalSnapshot().get('once')?.sync).toBe('loading')
    await syncExternalList('once', fetchTasks)
    expect(fetchTasks).toHaveBeenCalledTimes(1)

    ensureExternalLists(['once'], fetchTasks)
    expect(fetchTasks).toHaveBeenCalledTimes(1)
    expect(externalSnapshot().get('once')).toEqual({
      sync: 'synced',
      tasks: [
        {
          id: 'Water the plants',
          listId: 'once',
          title: 'Water the plants',
          done: false,
          dueDate: undefined,
          priority: undefined,
          labels: [],
          order: 0,
        },
      ],
    })

    await expect(syncExternalList('once', fetchTasks)).resolves.toBe('synced')
    expect(fetchTasks).toHaveBeenCalledTimes(2)
  })

  test('a failure keeps the last rows readable, says so, and is asked again next open', async () => {
    await syncExternalList('stale', provided(['Call the plumber']))

    await expect(
      syncExternalList('stale', () =>
        Promise.resolve({ status: 'reconnect' as const, provider: 'notion' }),
      ),
    ).resolves.toBe('reconnect')
    await expect(
      syncExternalList('stale', () => Promise.reject(new Error('offline'))),
    ).resolves.toBe('failed')
    expect(externalSnapshot().get('stale')).toEqual({
      sync: 'failed',
      tasks: [expect.objectContaining({ title: 'Call the plumber' })],
    })

    const retry = vi.fn(provided(['Call the plumber']))
    ensureExternalLists(['stale'], retry)
    expect(retry).toHaveBeenCalledTimes(1)
  })
})

describe('task sections', () => {
  test('keeps completed tasks out of the active list', () => {
    expect(
      taskSections([
        { id: 'one', done: false },
        { id: 'two', done: true },
        { id: 'three', done: false },
      ]),
    ).toEqual({
      active: [
        { id: 'one', done: false },
        { id: 'three', done: false },
      ],
      completed: [{ id: 'two', done: true }],
    })
  })
})

describe('optimistic task completion', () => {
  test('ticks the task in the list that holds it and leaves the rest alone', () => {
    const chores = [taskRow('one', 'chores'), taskRow('two', 'chores', true)]
    const errands = [taskRow('three', 'errands')]
    const written: { args: unknown; value: unknown }[] = []
    const store = {
      getAllQueries: () => [
        { args: { listId: 'chores' }, value: chores },
        { args: { listId: 'errands' }, value: errands },
        { args: { listId: 'loading' }, value: undefined },
      ],
      setQuery: (_query: unknown, args: unknown, value: unknown) =>
        written.push({ args, value }),
    } as unknown as OptimisticLocalStore

    toggleInPlace(store, { taskId: 'one' as Id<'tasks'> })

    expect(written).toEqual([
      {
        args: { listId: 'chores' },
        value: [
          expect.objectContaining({ _id: 'one', done: true }),
          expect.objectContaining({ _id: 'two', done: true }),
        ],
      },
    ])
    expect(chores[0].done).toBe(false)
  })
})

describe('what the writes send', () => {
  const list: TaskList = {
    id: 'chores',
    name: 'Chores',
    provider: 'local',
    writable: true,
    display: { due: true, priority: false, labels: true },
    order: 0,
    sync: 'live',
  }

  test('toggling one display option keeps the other two', async () => {
    sent.length = 0
    await useTaskActions().setListDisplay(list, { priority: true })

    expect(sent).toEqual([
      {
        name: 'taskLists:updateDisplay',
        args: {
          listId: 'chores',
          groupSlug: 'our-household',
          display: { due: true, priority: true, labels: true },
        },
      },
    ])
  })

  test('moving a task names the list it goes to', async () => {
    sent.length = 0
    await useTaskActions().moveTask('bins', 'errands')

    expect(sent).toEqual([
      {
        name: 'tasks:moveToList',
        args: { taskId: 'bins', groupSlug: 'our-household', listId: 'errands' },
      },
    ])
  })
})
