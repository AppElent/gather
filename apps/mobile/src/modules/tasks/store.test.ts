import type { OptimisticLocalStore } from 'convex/browser'
import { useAction } from 'convex/react'
import { getFunctionName } from 'convex/server'
import { describe, expect, test, vi } from 'vitest'

import type { Doc, Id } from '../../convex/api'

/** The Group's zone; none by default. */
const zone: { timeZone?: string } = {}
const sent: { name: string; args: unknown }[] = []
/** What a mutation answers, by name; nothing by default. */
const answers: Record<string, unknown> = {}

vi.mock('../../group/GroupProvider', () => ({
  useGroup: () => ({ group: { slug: 'our-household', ...zone } }),
}))
vi.mock('convex/react', () => ({
  useAction: vi.fn(),
  useConvex: () => ({
    connectionState: () => ({ isWebSocketConnected: true }),
  }),
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) => {
    const run = (args: unknown) => {
      const name = getFunctionName(reference)
      sent.push({ name, args })
      return Promise.resolve(answers[name])
    }
    return Object.assign(run, { withOptimisticUpdate: () => run })
  },
}))

import { localIsoDate } from '@gather/core/civil-date'
import { moveLinkedToList, type SendWrite } from '@gather/core/linked-lists'
import type { TaskRepeat } from '@gather/core/task-repeat'
import {
  type CompletedOccurrence,
  ensureExternalLists,
  externalEntry,
  externalSnapshot,
  indexModel,
  LinkedWriteError,
  listFace,
  localTaskQueries,
  mergeTasks,
  onOccurrenceCompleted,
  PROVIDER_WAIT_MS,
  settledDetails,
  smartModel,
  syncExternalList,
  taskSections,
  toggleInPlace,
  useTaskActions,writeLinkedTask 
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
    kind: 'plain' as const,
    icon: null,
    connectionId: null,
    color: null,
    grocery: false,
    checkedClearedAt: null,
    aisleOrder: null,
    suggestionsOff: false,
    writable: provider === 'local',
    capabilities: { write: provider !== 'notion' },
    sections: [] as { id: string; name: string }[],
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

/** A local store whose only cached queries are these `listByList` ones. */
const listQueriesOnly =
  (queries: { args: unknown; value: unknown }[]) =>
  (query: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(query) === 'tasks:listByList' ? queries : []

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
      fresh: true,
      tasks: [
        {
          id: 'Water the plants',
          listId: 'once',
          linked: true,
          repeatText: undefined,
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
    await vi.waitFor(() => expect(retry).toHaveBeenCalled())
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
      getAllQueries: listQueriesOnly([
        { args: { listId: 'chores' }, value: chores },
        { args: { listId: 'errands' }, value: errands },
        { args: { listId: 'loading' }, value: undefined },
      ]),
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

describe('repeating tasks (APP-303)', () => {
  const weekly: TaskRepeat = {
    mode: 'fixed',
    unit: 'week',
    every: 1,
    weekdays: [6],
  }

  const storeOf = (rows: Doc<'tasks'>[]) => {
    const written: unknown[] = []
    const store = {
      getAllQueries: listQueriesOnly([
        { args: { listId: 'chores' }, value: rows },
      ]),
      setQuery: (_query: unknown, _args: unknown, value: unknown) =>
        written.push(value),
    } as unknown as OptimisticLocalStore
    return { store, written }
  }

  test('ticking an open repeating task moves it to its next date, still open', () => {
    const { store, written } = storeOf([
      { ...taskRow('bins', 'chores'), dueDate: '2026-11-21', repeat: weekly },
    ])
    toggleInPlace(store, {
      taskId: 'bins' as Id<'tasks'>,
      today: '2026-11-19',
    })
    expect(written).toEqual([
      [expect.objectContaining({ done: false, dueDate: '2026-11-28' })],
    ])
  })

  test('without a day to count from, it ticks the way it always did', () => {
    const { store, written } = storeOf([
      { ...taskRow('bins', 'chores'), dueDate: '2026-11-21', repeat: weekly },
    ])
    toggleInPlace(store, { taskId: 'bins' as Id<'tasks'> })
    expect(written).toEqual([
      [expect.objectContaining({ done: true, dueDate: '2026-11-21' })],
    ])
  })

  test('a done repeating task reopens rather than moving on', () => {
    const { store, written } = storeOf([
      {
        ...taskRow('bins', 'chores', true),
        dueDate: '2026-11-21',
        repeat: weekly,
      },
    ])
    toggleInPlace(store, {
      taskId: 'bins' as Id<'tasks'>,
      today: '2026-11-19',
    })
    expect(written).toEqual([
      [expect.objectContaining({ done: false, dueDate: '2026-11-21' })],
    ])
  })

  test('the rule reaches the model from Convex, and the words from Todoist', () => {
    const { tasks } = mergeTasks(
      [listRow('chores', 'local')],
      { chores: [{ ...taskRow('bins', 'chores'), repeat: weekly }] },
      new Map(),
    )
    expect(tasks[0].repeat).toEqual(weekly)

    const entry = externalEntry(
      'todoist',
      {
        status: 'ok',
        tasks: [
          {
            externalId: 'x',
            title: 'Water plants',
            done: false,
            repeatText: 'every week',
          },
        ],
      },
      [],
    )
    expect(entry.tasks[0].repeatText).toBe('every week')
  })

  test('completing sends today and tells the screen what came of it', async () => {
    sent.length = 0
    const heard: CompletedOccurrence[] = []
    const stop = onOccurrenceCompleted((done) => heard.push(done))
    answers['tasks:toggleDone'] = { completionId: 'c1', dueDate: '2026-11-28' }
    const actions = useTaskActions()
    try {
      const result = await actions.toggleTask({
        id: 'bins',
        title: 'Bins',
      })
      expect(result).toEqual({ completionId: 'c1', dueDate: '2026-11-28' })
    } finally {
      delete answers['tasks:toggleDone']
      stop()
    }
    expect(sent).toEqual([
      {
        name: 'tasks:toggleDone',
        args: {
          taskId: 'bins',
          groupSlug: 'our-household',
          today: localIsoDate(),
        },
      },
    ])
    expect(heard).toEqual([
      {
        taskId: 'bins',
        title: 'Bins',
        completionId: 'c1',
        dueDate: '2026-11-28',
      },
    ])
  })

  test('a plain tick tells no one', async () => {
    const heard: unknown[] = []
    const stop = onOccurrenceCompleted((done) => heard.push(done))
    await useTaskActions().toggleTask({ id: 'milk', title: 'Milk' })
    stop()
    expect(heard).toEqual([])
  })

  test("in a Group with a zone, completing sends that zone's day", async () => {
    sent.length = 0
    vi.useFakeTimers({ now: new Date('2026-11-29T10:30:00Z') })
    zone.timeZone = 'Pacific/Kiritimati'
    const actions = useTaskActions()
    try {
      await actions.toggleTask({ id: 'bins', title: 'Bins' })
    } finally {
      vi.useRealTimers()
      delete zone.timeZone
    }
    expect(sent[0].args).toMatchObject({ today: '2026-11-30' })
  })

  test('setting and clearing a repeat, and undoing a completion', async () => {
    sent.length = 0
    const actions = useTaskActions()
    await actions.setRepeat('bins', weekly)
    await actions.setRepeat('bins', null)
    await actions.undoCompletion('c1' as Id<'taskCompletions'>)
    expect(sent).toEqual([
      {
        name: 'tasks:update',
        args: {
          taskId: 'bins',
          groupSlug: 'our-household',
          repeat: weekly,
          today: localIsoDate(),
        },
      },
      {
        name: 'tasks:update',
        args: {
          taskId: 'bins',
          groupSlug: 'our-household',
          repeat: null,
          today: localIsoDate(),
        },
      },
      {
        name: 'tasks:undoCompletion',
        args: { completionId: 'c1', groupSlug: 'our-household' },
      },
    ])
  })
})

describe('what the writes send', () => {
  const list: TaskList = {
    id: 'chores',
    name: 'Chores',
    provider: 'local',
    writable: true,
    grocery: false,
    checkedClearedAt: null,
    aisleOrder: null,
    suggestionsOff: false,
    display: { due: true, priority: false, labels: true },
    order: 0,
    sync: 'live',
    kind: 'chores',
    icon: 'sparkles',
    color: 'home',
    sections: [],
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
  test('a line onto a grocery list goes with its amount read off', async () => {
    sent.length = 0
    await useTaskActions().addTask('groceries', '2 pakken melk', true)
    await useTaskActions().addTask('groceries', 'bananen', true)
    await useTaskActions().addTask('chores', '2 pakken melk')

    expect(sent.map((call) => call.args)).toEqual([
      {
        listId: 'groceries',
        groupSlug: 'our-household',
        title: 'melk',
        quantity: 2,
        unit: 'pak',
      },
      { listId: 'groceries', groupSlug: 'our-household', title: 'bananen' },
      { listId: 'chores', groupSlug: 'our-household', title: '2 pakken melk' },
    ])
  })
})

describe('a list’s kind and face', () => {
  test('a list from before kinds draws as a plain list in the Tasks colours', () => {
    expect(listFace({})).toEqual({ kind: 'plain', icon: 'list', color: 'home' })
  })

  test('a kind this build does not know draws as plain, its face kept', () => {
    expect(
      listFace({ kind: 'recipes-someday', icon: 'gift', color: 'tasting' }),
    ).toEqual({ kind: 'plain', icon: 'gift', color: 'tasting' })
  })

  test('a typed list without its own face wears its kind’s', () => {
    expect(listFace({ kind: 'packing', icon: null, color: null })).toEqual({
      kind: 'packing',
      icon: 'suitcase',
      color: 'money',
    })
  })

  test('the lists from Convex carry it through to the model', () => {
    const { lists } = mergeTasks(
      [
        {
          ...listRow('trip', 'local'),
          kind: 'packing' as const,
          icon: null,
          color: 'kitchen' as const,
        },
      ],
      { trip: [] },
      new Map(),
    )
    expect(lists[0]).toMatchObject({
      kind: 'packing',
      icon: 'suitcase',
      color: 'kitchen',
    })
  })
})

describe('sections (APP-357)', () => {
  test('a list’s sections and a task’s section reach the model', () => {
    const { lists, tasks } = mergeTasks(
      [
        {
          ...listRow('trip', 'local'),
          sections: [{ id: 'clothes', name: 'Clothes' }],
        },
      ],
      { trip: [{ ...taskRow('socks', 'trip'), sectionId: 'clothes' }] },
      new Map(),
    )
    expect(lists[0].sections).toEqual([{ id: 'clothes', name: 'Clothes' }])
    expect(tasks[0].sectionId).toBe('clothes')
  })

  test('a server older than sections reads as a list without any', () => {
    const { sections: _, ...old } = listRow('old', 'local')
    const { lists } = mergeTasks(
      [old as ReturnType<typeof listRow>],
      { old: [] },
      new Map(),
    )
    expect(lists[0].sections).toEqual([])
  })
})

describe('smart lists (APP-301)', () => {
  const today = '2026-11-19'
  const me = 'me' as Id<'users'>

  test('local rows from Convex and linked rows already fetched, each on its rules', () => {
    const lists = [listRow('chores', 'local'), listRow('work', 'todoist')]
    const answer = {
      me,
      tasks: [
        { ...taskRow('bins', 'chores'), dueDate: '2026-11-18', assigneeId: me },
        { ...taskRow('plants', 'chores'), dueDate: '2026-11-22' },
        { ...taskRow('taxes', 'chores'), assigneeId: 'sanne' as Id<'users'> },
      ],
    }
    const linked = new Map([
      [
        'work',
        {
          sync: 'synced' as const,
          tasks: [
            {
              id: 'report',
              listId: 'work',
              title: 'Report',
              done: false,
              dueDate: today,
              labels: [],
              order: 0,
            },
          ],
        },
      ],
    ])
    const model = smartModel(lists, answer, linked, today)
    const ids = (id: keyof typeof model.byList) =>
      model.byList[id].map((task) => task.id)

    expect(model.loaded).toBe(true)
    expect(model.me).toBe(me)
    expect(ids('today')).toEqual(['bins', 'report'])
    expect(ids('mine')).toEqual(['bins'])
    expect(ids('upcoming')).toEqual(['bins', 'report', 'plants'])
    expect(ids('unassigned')).toEqual(['report', 'plants'])
    expect(model.lists.map((list) => [list.id, list.sync])).toEqual([
      ['chores', 'live'],
      ['work', 'synced'],
    ])
  })

  test('a linked list nobody opened adds nothing, and nothing is fetched', () => {
    const model = smartModel(
      [listRow('work', 'notion')],
      { me, tasks: [] },
      new Map(),
      today,
    )
    expect(model.tasks).toEqual([])
    expect(model.lists[0].sync).toBe('loading')
  })

  test('a list that left the Group takes its rows with it', () => {
    const model = smartModel(
      [listRow('chores', 'local')],
      { me, tasks: [{ ...taskRow('gone', 'deleted'), dueDate: today }] },
      new Map(),
      today,
    )
    expect(model.byList.today).toEqual([])
  })

  test('not loaded until both the lists and the smart rows have answered', () => {
    expect(smartModel(undefined, { me, tasks: [] }, new Map(), today).loaded).toBe(
      false,
    )
    expect(
      smartModel([listRow('chores', 'local')], undefined, new Map(), today)
        .loaded,
    ).toBe(false)
  })

  test('ticking a task takes it off the smart lists before the server answers', () => {
    const written: unknown[] = []
    const value = {
      me,
      tasks: [
        { ...taskRow('bins', 'chores'), dueDate: today },
        {
          ...taskRow('plants', 'chores'),
          dueDate: today,
          repeat: {
            mode: 'fixed',
            unit: 'week',
            every: 1,
            weekdays: [4],
          } satisfies TaskRepeat,
        },
      ],
    }
    const store = {
      getAllQueries: (query: Parameters<typeof getFunctionName>[0]) =>
        getFunctionName(query) === 'tasks:smartLists'
          ? [{ args: { groupSlug: 'our-household', today }, value }]
          : [],
      setQuery: (_query: unknown, _args: unknown, next: unknown) =>
        written.push(next),
    } as unknown as OptimisticLocalStore

    toggleInPlace(store, { taskId: 'bins' as Id<'tasks'>, today })
    toggleInPlace(store, { taskId: 'plants' as Id<'tasks'>, today })

    expect(written).toEqual([
      { me, tasks: [expect.objectContaining({ _id: 'plants' })] },
      {
        me,
        tasks: [
          expect.objectContaining({ _id: 'bins' }),
          expect.objectContaining({
            _id: 'plants',
            done: false,
            dueDate: '2026-11-26',
          }),
        ],
      },
    ])
  })
})

describe('subtasks (APP-304)', () => {
  const today = '2026-11-19'
  const me = 'me' as Id<'users'>
  const step = (id: string, parent: string, done = false) => ({
    ...taskRow(id, 'chores', done),
    parentTaskId: parent as Id<'tasks'>,
  })

  test('a list’s parents carry how far along their subtasks are', () => {
    const { tasks } = mergeTasks(
      [listRow('chores', 'local')],
      {
        chores: [
          taskRow('attic', 'chores'),
          step('boxes', 'attic', true),
          step('sweep', 'attic'),
          taskRow('bins', 'chores'),
        ],
      },
      new Map(),
    )
    const byId = new Map(tasks.map((task) => [task.id, task]))
    expect(byId.get('attic')?.subtasks).toEqual({ done: 1, total: 2 })
    expect(byId.get('sweep')?.parentTaskId).toBe('attic')
    expect(byId.get('bins')?.subtasks).toBeUndefined()
  })

  test('a smart list names a subtask’s parent and counts a parent’s steps', () => {
    const model = smartModel(
      [listRow('chores', 'local')],
      {
        me,
        tasks: [
          { ...taskRow('attic', 'chores'), dueDate: today },
          { ...step('sweep', 'attic'), dueDate: today },
        ],
        subtasks: [{ taskId: 'attic' as Id<'tasks'>, done: 1, total: 3 }],
        parents: [{ taskId: 'attic' as Id<'tasks'>, title: 'Clear the attic' }],
      },
      new Map(),
      today,
    )
    const byId = new Map(model.byList.today.map((task) => [task.id, task]))
    expect(byId.get('attic')?.subtasks).toEqual({ done: 1, total: 3 })
    expect(byId.get('sweep')?.parentTitle).toBe('Clear the attic')
  })

  test('a Todoist subtask names its parent', () => {
    const entry = externalEntry(
      'work',
      {
        status: 'ok',
        tasks: [
          {
            externalId: 'child',
            title: 'Child',
            done: false,
            parentExternalId: 'parent',
          },
        ],
      } as never,
      [],
    )
    expect(entry.tasks[0].parentTaskId).toBe('parent')
  })

  const storeOf = (rows: Doc<'tasks'>[]) => {
    const written: Doc<'tasks'>[][] = []
    const store = {
      getAllQueries: listQueriesOnly([
        { args: { listId: 'chores' }, value: rows },
      ]),
      setQuery: (_query: unknown, _args: unknown, value: Doc<'tasks'>[]) =>
        written.push(value),
    } as unknown as OptimisticLocalStore
    return { store, written }
  }
  const doneOf = (rows: Doc<'tasks'>[]) =>
    Object.fromEntries(rows.map((row) => [row._id, row.done]))

  test('Complete all ticks the open subtasks with it; Only this leaves them', () => {
    const rows = [taskRow('attic', 'chores'), step('sweep', 'attic')]
    const all = storeOf(rows)
    toggleInPlace(all.store, {
      taskId: 'attic' as Id<'tasks'>,
      withSubtasks: true,
    })
    expect(doneOf(all.written[0])).toEqual({ attic: true, sweep: true })

    const only = storeOf(rows)
    toggleInPlace(only.store, { taskId: 'attic' as Id<'tasks'> })
    expect(doneOf(only.written[0])).toEqual({ attic: true, sweep: false })
  })

  test('a repeating parent’s subtasks reopen with its next occurrence', () => {
    const { store, written } = storeOf([
      {
        ...taskRow('bins', 'chores'),
        dueDate: '2026-11-21',
        repeat: { mode: 'fixed', unit: 'week', every: 1, weekdays: [6] },
      },
      step('rinse', 'bins', true),
    ])
    toggleInPlace(store, { taskId: 'bins' as Id<'tasks'>, today })
    expect(doneOf(written[0])).toEqual({ bins: false, rinse: false })
  })
})

describe('the Tasks index model (APP-430)', () => {
  const counts = [
    { listId: 'house' as Id<'taskLists'>, open: 3 },
    { listId: 'trip' as Id<'taskLists'>, open: 3, done: 1, total: 4 },
  ]
  const lists = [
    listRow('house', 'local'),
    { ...listRow('trip', 'local'), kind: 'packing' as const },
    listRow('fresh', 'local'),
    listRow('work', 'todoist'),
  ]
  const linkedEntry = (
    sync: 'synced' | 'loading' | 'failed',
    rows: { id: string; done: boolean; parent?: string }[],
  ) => ({
    sync,
    tasks: rows.map((row, order) => ({
      id: row.id,
      listId: 'work',
      title: row.id,
      done: row.done,
      labels: [],
      order,
      ...(row.parent ? { parentTaskId: row.parent } : {}),
    })),
  })

  test('local counts come from Convex, a list it does not name yet is empty', () => {
    const model = indexModel(lists, counts, new Map())
    expect(model.counts.get('house')).toMatchObject({ open: 3 })
    expect(model.counts.get('trip')).toEqual({ open: 3, done: 1, total: 4 })
    expect(model.counts.get('fresh')).toEqual({ open: 0 })
    expect(model.lists.map((list) => list.sync)).toEqual([
      'live',
      'live',
      'live',
      'loading',
    ])
  })

  test('nothing is counted before Convex answers', () => {
    const model = indexModel(lists, undefined, new Map())
    expect(model.counts.size).toBe(0)
    expect(model.lists.slice(0, 3).map((list) => list.sync)).toEqual([
      'loading',
      'loading',
      'loading',
    ])
  })

  test('a linked list is counted from its provider rows, subtasks left out', () => {
    const linked = new Map([
      [
        'work',
        linkedEntry('synced', [
          { id: 'a', done: false },
          { id: 'b', done: true },
          { id: 'step', done: false, parent: 'a' },
        ]),
      ],
    ])
    const model = indexModel(lists, counts, linked)
    expect(model.counts.get('work')).toEqual({ open: 1, done: 1, total: 2 })
    expect(model.openTotal).toBe(3 + 3 + 0 + 1)
  })

  test('a linked list not yet answered has no count; a failed one keeps its last rows', () => {
    expect(
      indexModel(lists, counts, new Map([['work', linkedEntry('loading', [])]]))
        .counts.has('work'),
    ).toBe(false)
    const failed = indexModel(
      lists,
      counts,
      new Map([['work', linkedEntry('failed', [{ id: 'a', done: false }])]]),
    )
    expect(failed.lists[3].sync).toBe('failed')
    expect(failed.counts.get('work')?.open).toBe(1)
  })
})

describe('what a composed task’s note and reminder came to', () => {
  const reminder = { date: '2026-11-23', time: '09:00' }
  const ok: PromiseSettledResult<unknown> = { status: 'fulfilled', value: null }
  const no: PromiseSettledResult<unknown> = { status: 'rejected', reason: new Error() }

  test('a reminder that went in is set even when the note failed', () => {
    expect(settledDetails({ notes: 'keys', reminder }, no, ok)).toEqual({
      notesFailed: true,
      reminderFailed: false,
      reminderSet: true,
      failed: { notes: 'keys', reminder: undefined },
    })
  })

  test('a reminder written again on a retry is set', () => {
    expect(settledDetails({ reminder }, ok, ok).reminderSet).toBe(true)
  })

  test('no reminder, or a failed one, is not set', () => {
    expect(settledDetails({ notes: 'keys' }, ok, ok).reminderSet).toBe(false)
    const failed = settledDetails({ reminder }, ok, no)
    expect(failed).toMatchObject({ reminderSet: false, reminderFailed: true })
    expect(failed.failed.reminder).toEqual(reminder)
  })
})

describe('a linked list is written to in its provider first (APP-448)', () => {
  const row = (externalId: string, rest: object = {}) => ({
    externalId,
    title: externalId,
    done: false,
    ...rest,
  })
  const answering = (...tasks: ReturnType<typeof row>[]) =>
    vi.fn(() => Promise.resolve({ status: 'ok' as const, tasks }))
  const taken = (tasks: ReturnType<typeof row>[] = [], refresh = false) =>
    vi.fn(() => Promise.resolve({ status: 'ok' as const, tasks, refresh }))
  const rows = (listId: string) =>
    externalSnapshot().get(listId)?.tasks.map((task) => task.title)
  const writable = (listId: string, provider: 'notion' | 'todoist' = 'todoist') =>
    mergeTasks([listRow(listId, provider)], {}, externalSnapshot()).lists[0]
      .writable

  test('nothing changes here until the provider took the write', async () => {
    const fetchTasks = answering(row('a'))
    await syncExternalList('first', fetchTasks)
    let take = (_: Awaited<ReturnType<ReturnType<typeof taken>>>) => {}
    const request = writeLinkedTask(
      'first',
      { kind: 'update', taskId: 'a', title: 'b' },
      () => new Promise((resolve) => (take = resolve)),
      fetchTasks,
    )
    await Promise.resolve()
    expect(externalSnapshot().get('first')?.tasks[0]).toMatchObject({
      title: 'a',
      pending: true,
    })
    take({ status: 'ok', tasks: [row('a', { title: 'b' })], refresh: false })
    await request
    expect(externalSnapshot().get('first')?.tasks[0]).toMatchObject({
      title: 'b',
    })
    expect(externalSnapshot().get('first')?.tasks[0].pending).toBeUndefined()
    expect(fetchTasks).toHaveBeenCalledTimes(1)
  })

  test('a move leaves one list, shows on the other, and undo puts it back under its parent', async () => {
    // What Todoist holds, by list.
    const held: Record<string, ReturnType<typeof row>[]> = {
      from: [row('p'), row('s', { parentExternalId: 'p' })],
      to: [],
    }
    const fetchTasks = (id: string) =>
      Promise.resolve({ status: 'ok' as const, tasks: [...held[id]] })
    const sent: unknown[] = []
    const send: SendWrite = async (id, write) => {
      sent.push([id, write])
      if (write.kind === 'moveToList') {
        held[id] = held[id].filter((each) => each.externalId !== write.taskId)
        held[write.listId].push(row(write.taskId))
      } else if (write.kind === 'move') {
        held[id] = held[id].map((each) =>
          each.externalId === write.taskId
            ? row('s', { parentExternalId: write.parentId })
            : each,
        )
        return { status: 'ok', tasks: [held[id][1]], refresh: false }
      }
      return { status: 'ok', tasks: [row('s')], refresh: true }
    }
    await syncExternalList('from', fetchTasks)
    await syncExternalList('to', fetchTasks)
    const undo = await moveLinkedToList(
      { id: 's', listId: 'from', parentTaskId: 'p' },
      'to',
      send,
      fetchTasks,
    )
    expect(rows('from')).toEqual(['p'])
    await vi.waitFor(() => expect(rows('to')).toEqual(['s']))

    await undo()
    expect(rows('to')).toEqual([])
    expect(rows('from')).toEqual(['p', 's'])
    expect(externalSnapshot().get('from')?.tasks[1].parentTaskId).toBe('p')
    expect(sent).toEqual([
      ['from', { kind: 'moveToList', taskId: 's', listId: 'to' }],
      ['to', { kind: 'moveToList', taskId: 's', listId: 'from' }],
      ['from', { kind: 'move', taskId: 's', parentId: 'p' }],
    ])
  })

  test('a refused move leaves the task where it is', async () => {
    const fetchTasks = answering(row('a'))
    await syncExternalList('stays', fetchTasks)
    await expect(
      moveLinkedToList(
        { id: 'a', listId: 'stays' },
        'elsewhere',
        () => Promise.resolve({ status: 'error', reason: 'failed' }),
        fetchTasks,
      ),
    ).rejects.toMatchObject({ reason: 'failed' })
    expect(rows('stays')).toEqual(['a'])
    expect(externalSnapshot().has('elsewhere')).toBe(false)
  })

  test('a subtask lands under its parent', async () => {
    await syncExternalList('sub', answering(row('a')))
    await writeLinkedTask(
      'sub',
      { kind: 'create', title: 'step', parentId: 'a' },
      taken([row('step', { parentExternalId: 'a' })]),
      answering(),
    )
    expect(externalSnapshot().get('sub')?.tasks[1]).toMatchObject({
      title: 'step',
      parentTaskId: 'a',
      linked: true,
    })
  })

  test('who has a task follows the provider, and stays with the list (APP-405)', async () => {
    const assignable = { shared: true, memberIds: ['u1'] }
    await syncExternalList('given', () =>
      Promise.resolve({
        status: 'ok' as const,
        assignable,
        tasks: [row('a', { assigneeName: 'Bob' })],
      }),
    )
    await writeLinkedTask(
      'given',
      { kind: 'update', taskId: 'a', assigneeId: 'u1' },
      taken([row('a', { assigneeId: 'u1' })]),
      answering(),
    )
    const [task] = externalSnapshot().get('given')?.tasks ?? []
    expect(task.assigneeId).toBe('u1')
    expect(task).not.toHaveProperty('assigneeName')
    expect(
      mergeTasks([listRow('given', 'todoist')], {}, externalSnapshot()).lists[0]
        .assignable,
    ).toEqual(assignable)
  })

  test('a read-only connection asks to reconnect and changes nothing', async () => {
    const fetchTasks = answering(row('a'))
    await syncExternalList('old-scope', fetchTasks)
    expect(writable('old-scope')).toBe(true)
    const request = writeLinkedTask(
      'old-scope',
      { kind: 'setDone', taskId: 'a', done: true },
      () =>
        Promise.resolve({ status: 'reconnect' as const, provider: 'todoist' }),
      fetchTasks,
    )
    await expect(request).rejects.toMatchObject({ reason: 'reconnect' })
    expect(externalSnapshot().get('old-scope')?.sync).toBe('reconnect')
    expect(rows('old-scope')).toEqual(['a'])
    expect(writable('old-scope')).toBe(false)
    expect(fetchTasks).toHaveBeenCalledTimes(1)

    // Reads keep working.
    await syncExternalList('old-scope', fetchTasks)
    expect(externalSnapshot().get('old-scope')?.sync).toBe('synced')
  })

  test.each([
    ['a refusal', () => Promise.resolve({ status: 'error' as const, reason: 'failed' as const })],
    ['no network', () => Promise.reject(new Error('offline'))],
  ])('%s rejects and shows what the provider has', async (name, send) => {
    const fetchTasks = answering(row('a'))
    await syncExternalList(name, fetchTasks)
    await expect(
      writeLinkedTask(name, { kind: 'setDone', taskId: 'a', done: true }, send, fetchTasks),
    ).rejects.toBeInstanceOf(LinkedWriteError)
    await vi.waitFor(() => expect(fetchTasks).toHaveBeenCalledTimes(2))
    await vi.waitFor(() =>
      expect(externalSnapshot().get(name)?.sync).toBe('synced'),
    )
    expect(rows(name)).toEqual(['a'])
    expect(externalSnapshot().get(name)?.tasks[0].pending).toBeUndefined()
    expect(writable(name)).toBe(true)
  })

  test('an outage leaves the list stale and read-only, and refuses writes', async () => {
    await syncExternalList('outage', answering(row('a')))
    const down = () => Promise.reject(new Error('offline'))
    await expect(
      writeLinkedTask('outage', { kind: 'setDone', taskId: 'a', done: true }, down, down),
    ).rejects.toMatchObject({ reason: 'failed' })
    await syncExternalList('outage', down)
    expect(rows('outage')).toEqual(['a'])
    expect(writable('outage')).toBe(false)

    const send = taken()
    await expect(
      writeLinkedTask('outage', { kind: 'setDone', taskId: 'a', done: true }, send, down),
    ).rejects.toMatchObject({ reason: 'stale' })
    expect(send).not.toHaveBeenCalled()
  })

  test('writes to one list run in order, and a refresh waits for them', async () => {
    await syncExternalList('queue', answering(row('a')))
    const order: string[] = []
    const slow = async () => {
      await Promise.resolve()
      order.push('write')
      return { status: 'ok' as const, tasks: [row('a')], refresh: false }
    }
    const change = { kind: 'update', taskId: 'a', title: 'a' } as const
    const fetchTasks = () => {
      order.push('fetch')
      return answering(row('a'))()
    }
    await Promise.all([
      writeLinkedTask('queue', change, slow, fetchTasks),
      writeLinkedTask('queue', change, slow, fetchTasks),
      syncExternalList('queue', fetchTasks),
    ])
    expect(order).toEqual(['write', 'write', 'fetch'])
  })

  test('offline nothing is sent, now or later', async () => {
    const fetchTasks = answering(row('a'))
    await syncExternalList('offline', fetchTasks)
    const send = taken()
    await expect(
      writeLinkedTask(
        'offline',
        { kind: 'setDone', taskId: 'a', done: true },
        send,
        fetchTasks,
        { isOnline: () => false, whenOnline: () => {} },
      ),
    ).rejects.toMatchObject({ reason: 'offline' })
    expect(send).not.toHaveBeenCalled()
    expect(rows('offline')).toEqual(['a'])
    expect(writable('offline')).toBe(false)
    expect(externalSnapshot().get('offline')?.tasks[0].pending).toBeUndefined()
  })

  test('an offline refusal reads the list once the connection is back', async () => {
    const down = () => Promise.reject(new Error('offline'))
    const fetchTasks = vi.fn(answering(row('a')))
    await syncExternalList('back', fetchTasks)
    let online = false
    const waiting: (() => unknown)[] = []
    const connection = {
      isOnline: () => online,
      whenOnline: (run: () => void) => waiting.push(run),
    }
    const write = () =>
      writeLinkedTask(
        'back',
        { kind: 'setDone', taskId: 'a', done: true },
        taken(),
        fetchTasks,
        connection,
      )
    await expect(write()).rejects.toMatchObject({ reason: 'offline' })
    await expect(write()).rejects.toMatchObject({ reason: 'stale' })
    expect(waiting).toHaveLength(1)
    expect(writable('back')).toBe(false)
    // Back for a moment only: it waits again, and reads nothing meanwhile.
    fetchTasks.mockImplementationOnce(down)
    await waiting[0]()
    expect(writable('back')).toBe(false)
    expect(waiting).toHaveLength(2)
    online = true
    await waiting[1]()
    expect(writable('back')).toBe(true)
    expect(waiting).toHaveLength(2)
    expect(fetchTasks).toHaveBeenCalledTimes(3)
    await write()
  })

  test('Complete all keeps its key until Todoist took it', async () => {
    const send = vi.fn()
    vi.mocked(useAction).mockReturnValue(send as never)
    send.mockResolvedValue({ status: 'error', reason: 'failed' })
    await syncExternalList('keys', answering(row('a')))
    const complete = () =>
      useTaskActions().toggleTask(
        { id: 'a', listId: 'keys', linked: true, title: 'a' },
        { withSubtasks: true },
      )
    await expect(complete()).rejects.toMatchObject({ reason: 'failed' })
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(2))
    await syncExternalList('keys', answering(row('a')))
    send.mockResolvedValue({ status: 'ok', tasks: [row('a')], refresh: false })
    await complete()
    await complete()
    const keys = send.mock.calls
      .map(([call]) => call.write?.requestKey)
      .filter(Boolean)
    expect(keys).toHaveLength(3)
    expect(keys[1]).toBe(keys[0])
    expect(keys[2]).not.toBe(keys[0])
    for (const key of keys) expect(key).toMatch(/^[\w-]{1,64}$/)
  })

  test('a write that never answers fails, and what waited is not sent', async () => {
    await syncExternalList('hung', answering(row('a')))
    vi.useFakeTimers()
    try {
      const hung = () => new Promise<never>(() => {})
      const second = taken()
      const change = { kind: 'update', taskId: 'a', title: 'b' } as const
      const outcomes = Promise.allSettled([
        writeLinkedTask('hung', change, hung, hung),
        writeLinkedTask('hung', change, second, hung),
      ])
      await vi.advanceTimersByTimeAsync(PROVIDER_WAIT_MS)
      expect(await outcomes).toMatchObject([
        { reason: { reason: 'failed' } },
        { reason: { reason: 'stale' } },
      ])
      expect(second).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(PROVIDER_WAIT_MS)
    } finally {
      vi.useRealTimers()
    }
    expect(externalSnapshot().get('hung')).toMatchObject({ sync: 'failed' })
    expect(rows('hung')).toEqual(['a'])
  })

  test('a write answered too late keeps the list read-only until it is', async () => {
    const fetchTasks = answering(row('a'))
    await syncExternalList('late', fetchTasks)
    let answer = () => {}
    vi.useFakeTimers()
    try {
      const request = writeLinkedTask(
        'late',
        { kind: 'setDone', taskId: 'a', done: true },
        () =>
          new Promise((resolve) => {
            answer = () =>
              resolve({ status: 'ok', tasks: [], refresh: true })
          }),
        fetchTasks,
      ).catch((error) => error)
      await vi.advanceTimersByTimeAsync(PROVIDER_WAIT_MS)
      expect(await request).toMatchObject({ reason: 'failed' })
    } finally {
      vi.useRealTimers()
    }
    expect(writable('late')).toBe(false)
    // A refresh that overtakes the write does not make it writable either.
    await syncExternalList('late', fetchTasks)
    expect(writable('late')).toBe(false)

    answer()
    await vi.waitFor(() => expect(writable('late')).toBe(true))
    expect(fetchTasks).toHaveBeenCalledTimes(3)
  })

  test('a refresh already running keeps a task pending', async () => {
    await syncExternalList('refreshing', answering(row('a')))
    let answer = (_: Awaited<ReturnType<ReturnType<typeof answering>>>) => {}
    const refresh = syncExternalList(
      'refreshing',
      () => new Promise((resolve) => (answer = resolve)),
    )
    await Promise.resolve()
    let take = (_: Awaited<ReturnType<ReturnType<typeof taken>>>) => {}
    const request = writeLinkedTask(
      'refreshing',
      { kind: 'setDone', taskId: 'a', done: true },
      () => new Promise((resolve) => (take = resolve)),
      answering(row('a')),
    )
    await vi.waitFor(async () => {
      answer(await answering(row('a'))())
      await refresh
    })
    expect(externalSnapshot().get('refreshing')?.tasks[0].pending).toBe(true)
    await vi.waitFor(() => {
      take({ status: 'ok', tasks: [], refresh: false })
      expect(externalSnapshot().get('refreshing')?.tasks[0].pending).toBeUndefined()
    })
    await request
  })

  test('a task in two lists is written through the list it was opened on', async () => {
    const send = vi.fn(taken([row('a')]))
    vi.mocked(useAction).mockReturnValue(send as never)
    await syncExternalList('one', answering(row('a')))
    await syncExternalList('two', answering(row('a')))
    await useTaskActions().setDue(
      { id: 'a', listId: 'two', linked: true },
      undefined,
    )
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ listId: 'two' }),
    )
  })

  test('Notion stays read-only', async () => {
    await syncExternalList('notion-list', answering(row('a')))
    expect(writable('notion-list', 'notion')).toBe(false)
  })
})
