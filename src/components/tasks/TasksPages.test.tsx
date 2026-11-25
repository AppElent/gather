import { localIsoDate } from '@gather/core/civil-date'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { renderInGroup, TEST_GROUP } from '../app/testing'
import type { ShellGroup } from '../app/useCurrentGroup'
import { SmartListPage } from './SmartListPage'
import { TaskListPage } from './TaskListPage'
import { TaskPage } from './TaskPage'
import { TasksIndexPage } from './TasksIndexPage'
import { TasksNotices } from './TasksNotices'

const state = vi.hoisted(() => ({
  queries: {} as Record<string, unknown>,
  calls: [] as [string, Record<string, unknown>][],
  fail: new Set<string>(),
  navigated: [] as { to: string; search?: Record<string, string> }[],
  linked: { status: 'unavailable' } as unknown,
  written: undefined as unknown,
  desktop: true,
  slow: undefined as undefined | (() => Promise<never>),
}))

vi.mock('../../../convex/_generated/api', () => {
  const module = (name: string) =>
    new Proxy({}, { get: (_, key) => `${name}:${String(key)}` })
  return { api: new Proxy({}, { get: (_, key) => module(String(key)) }) }
})

vi.mock('convex/react', () => {
  const call = (name: string) => {
    const run = async (args: Record<string, unknown>) => {
      state.calls.push([name, args])
      if (name === 'tasks:update' && state.slow) return state.slow()
      if (state.fail.has(name)) throw new Error('nope')
      if (name === 'taskLists:getTasks') return state.linked
      if (name === 'taskLists:writeTask') return state.written
      return name === 'tasks:toggleDone' ? null : 'new-id'
    }
    return Object.assign(run, { withOptimisticUpdate: () => run })
  }
  return {
    useQuery: (name: string, args: unknown) => {
      if (args === 'skip') return undefined
      const answer = state.queries[name]
      return typeof answer === 'function' ? answer(args) : answer
    },
    useMutation: call,
    useAction: call,
    useConvex: () => ({
      query: async (name: string, args: unknown) => {
        const answer = state.queries[name]
        return typeof answer === 'function' ? answer(args) : answer
      },
      connectionState: () => ({ isWebSocketConnected: true }),
    }),
  }
})

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => async (to: (typeof state.navigated)[number]) => {
    state.navigated.push(to)
  },
  Navigate: ({ to }: { to: string }) => <p>{`navigated to ${to}`}</p>,
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))

const list = (id: string, name: string, more: object = {}) => ({
  _id: id,
  name,
  order: 1,
  grocery: false,
  writable: true,
  provider: 'local',
  kind: 'plain',
  sections: [],
  display: { due: true, priority: true, labels: true },
  ...more,
})
const task = (id: string, title: string, more: object = {}) => ({
  _id: id,
  _creationTime: Date.UTC(2026, 9, 1, 12),
  listId: 'l1',
  title,
  done: false,
  order: 1,
  labels: [],
  createdBy: 'u1',
  ...more,
})

const WINDOWS = task('t1', 'Wash windows', { notes: 'Both sides' })
const BINS = task('t2', 'Bins out', { order: 2 })
const SOAP = task('s1', 'Buy soap', { parentTaskId: 't1' })
const DONE = task('t3', 'Vacuum', { done: true, order: 3 })

const TODAY = localIsoDate()

/** A page in the Tasks layout. `page` shows another in the same layout. */
const renderTasks = (page: ReactElement, group?: ShellGroup) => {
  const inLayout = (each: ReactElement) => <TasksNotices>{each}</TasksNotices>
  const { unmount, rerender } = renderInGroup(inLayout(page), { group })
  return {
    unmount,
    goTo: (each: ReactElement) => rerender(inLayout(each)),
  }
}

const calls = (name: string) =>
  state.calls.filter(([each]) => each === name).map(([, args]) => args)

beforeEach(() => {
  state.calls = []
  state.fail = new Set()
  state.navigated = []
  state.linked = { status: 'unavailable' }
  state.desktop = true
  state.slow = undefined
  window.matchMedia = ((query: string) => ({
    matches: state.desktop,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
  state.queries = {
    'users:me': { _id: 'u1' },
    'taskLists:list': [list('l1', 'Household')],
    'tasks:openCounts': [{ listId: 'l1', open: 2 }],
    'tasks:listByList': [WINDOWS, BINS, SOAP, DONE],
    'tasks:listOf': ({ taskId }: { taskId: string }) =>
      ['t1', 't2', 't3', 's1'].includes(taskId) ? 'l1' : null,
    'tasks:labels': [],
    'tasks:smartLists': { me: 'u1', tasks: [] },
    'groups:members': [
      { userId: 'u1', name: 'Eva' },
      { userId: 'u2', name: 'Sam' },
    ],
  }
})

const panel = () => screen.getByRole('complementary', { name: 'Task' })

// The Group's zone decides the day (APP-814); a reminder keeps this device's.
describe("the Group's today", () => {
  const far: ShellGroup = { ...TEST_GROUP, timeZone: 'Pacific/Kiritimati' }
  // Past noon UTC it is already the next day there.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'], now: Date.UTC(2026, 10, 19, 11) })
  })
  afterEach(() => {
    vi.useRealTimers()
  })
  const add = async (line: string) => {
    const field = screen.getByRole('textbox', { name: 'New task' })
    fireEvent.change(field, { target: { value: line } })
    fireEvent.submit(field.closest('form') as HTMLFormElement)
    await waitFor(() => expect(calls('tasks:add')).toHaveLength(1))
  }

  test('a typed day, a tick and the smart lists use it', async () => {
    const asked: unknown[] = []
    state.queries['tasks:smartLists'] = (args: { today: string }) => {
      asked.push(args.today)
      return { me: 'u1', tasks: [] }
    }
    renderTasks(<TaskListPage listId="l1" />, far)
    await add('Mop floor today')
    expect(calls('tasks:add')[0]).toMatchObject({
      dueDate: '2026-11-20',
      today: '2026-11-20',
    })
    fireEvent.click(screen.getByRole('checkbox', { name: /Bins out/ }))
    await waitFor(() => expect(calls('tasks:toggleDone')).toHaveLength(1))
    expect(calls('tasks:toggleDone')[0].today).toBe('2026-11-20')
    renderTasks(<SmartListPage smartList="today" />, far)
    expect(new Set(asked)).toEqual(new Set(['2026-11-20']))
  })

  test("a typed time is on this device's day", async () => {
    renderTasks(<TaskListPage listId="l1" />, far)
    await add('Mop floor 23:45')
    expect(calls('tasks:add')[0].dueDate).toBe(localIsoDate())
  })

  test("a reminder's day is this device's", () => {
    const clock = { date: localIsoDate(), time: '23:45', timeZone: 'UTC' }
    state.queries['tasks:listByList'] = [
      task('t1', 'Wash windows', {
        dueDate: '2026-11-20',
        reminder: { ...clock, userId: 'u1' },
      }),
    ]
    renderTasks(<TaskListPage listId="l1" selectedTaskId="t1" />, far)
    expect(within(panel()).getByText('Today 23:45')).toBeTruthy()
    expect(within(panel()).getByText('Today')).toBeTruthy()
  })
})

describe('a list', () => {
  test('a quick-add line is read before it is added', async () => {
    renderTasks(<TaskListPage listId="l1" />)
    const field = screen.getByRole('textbox', { name: 'New task' })
    fireEvent.change(field, { target: { value: 'Mop floor @Sam' } })
    expect(
      within(screen.getByRole('list', { name: 'Recognised' })).getByText('Sam'),
    ).toBeTruthy()
    fireEvent.submit(field.closest('form') as HTMLFormElement)
    await waitFor(() => expect(calls('tasks:add')).toHaveLength(1))
    expect(calls('tasks:add')[0]).toMatchObject({
      listId: 'l1',
      title: 'Mop floor',
      assigneeId: 'u2',
    })
    expect((field as HTMLInputElement).value).toBe('')
  })

  test('a line that did not save comes back, and keeps its key', async () => {
    state.fail.add('tasks:add')
    renderTasks(<TaskListPage listId="l1" />)
    const field = screen.getByRole('textbox', { name: 'New task' })
    const form = field.closest('form') as HTMLFormElement
    fireEvent.change(field, { target: { value: 'Mop floor' } })
    fireEvent.submit(form)
    await screen.findByRole('alert')
    expect((field as HTMLInputElement).value).toBe('Mop floor')
    fireEvent.submit(form)
    await waitFor(() => expect(calls('tasks:add')).toHaveLength(2))
    const [first, second] = calls('tasks:add')
    expect(second.idempotencyKey).toBe(first.idempotencyKey)
  })

  test('N focuses the add field, and the header button does too', () => {
    renderTasks(<TaskListPage listId="l1" />)
    const field = screen.getByRole('textbox', { name: 'New task' })
    fireEvent.keyDown(document.body, { key: 'n' })
    expect(document.activeElement).toBe(field)
    field.blur()
    fireEvent.click(screen.getByRole('button', { name: 'Add task' }))
    expect(document.activeElement).toBe(field)
  })

  test('a ring ticks its task; subtasks are not rows', async () => {
    renderTasks(<TaskListPage listId="l1" />)
    expect(screen.queryByText('Buy soap')).toBeNull()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Complete Bins out' }))
    await waitFor(() =>
      expect(calls('tasks:toggleDone')[0]).toMatchObject({ taskId: 't2' }),
    )
  })

  test('a task with open subtasks asks first', async () => {
    renderTasks(<TaskListPage listId="l1" />)
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Complete Wash windows' }),
    )
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Complete all',
      }),
    )
    await waitFor(() =>
      expect(calls('tasks:toggleDone')[0]).toMatchObject({
        taskId: 't1',
        withSubtasks: true,
      }),
    )
  })

  // The choice when completing a task with open subtasks (APP-820).
  const choice = (name: string) =>
    within(screen.getByRole('alertdialog')).queryByRole('button', { name })
  const tickWindows = () =>
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Complete Wash windows' }),
    )

  test('"Only this" completes the task and leaves its subtasks', async () => {
    renderTasks(<TaskListPage listId="l1" />)
    tickWindows()
    fireEvent.click(choice('Only this') as HTMLElement)
    await waitFor(() => expect(calls('tasks:toggleDone')).toHaveLength(1))
    expect(calls('tasks:toggleDone')[0]).toMatchObject({ taskId: 't1' })
    expect(calls('tasks:toggleDone')[0]).not.toHaveProperty('withSubtasks')
  })

  test('Cancel completes nothing', () => {
    renderTasks(<TaskListPage listId="l1" />)
    tickWindows()
    fireEvent.click(choice('Cancel') as HTMLElement)
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(calls('tasks:toggleDone')).toEqual([])
  })

  // As on the phone: the next occurrence reopens the subtasks either way.
  test('a repeating Gather task does not ask', async () => {
    state.queries['tasks:listByList'] = [
      { ...WINDOWS, repeat: { every: 1, unit: 'week', from: 'schedule' } },
      SOAP,
    ]
    renderTasks(<TaskListPage listId="l1" />)
    tickWindows()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    await waitFor(() => expect(calls('tasks:toggleDone')).toHaveLength(1))
  })

  const tickLinkedParent = async (listId: string, more: object) => {
    state.queries['taskLists:list'] = [
      list(listId, 'Todoist', {
        provider: 'todoist',
        capabilities: { write: true },
      }),
    ]
    const parent = {
      externalId: 'p',
      title: 'Pack',
      done: false,
      labels: [],
      ...more,
    }
    const child = {
      externalId: 'c',
      title: 'Socks',
      done: false,
      labels: [],
      parentExternalId: 'p',
    }
    state.linked = { status: 'ok', tasks: [parent, child] }
    state.written = { status: 'ok', tasks: [parent], refresh: false }
    renderTasks(<TaskListPage listId={listId} />)
    await screen.findByText('Pack')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Complete Pack' }))
  }

  test.each([
    ['Only this', { kind: 'setDone', taskId: 'p', done: true }],
    ['Complete all', { kind: 'setDone', withSubtasks: true }],
  ])('a repeating linked task offers %s', async (name, write) => {
    await tickLinkedParent(`repeats ${name}`, { repeatText: 'every week' })
    fireEvent.click(choice(name) as HTMLElement)
    await waitFor(() => expect(calls('taskLists:writeTask')).toHaveLength(1))
    const sent = calls('taskLists:writeTask')[0]?.write
    expect(sent).toMatchObject(write)
    if (name === 'Only this') expect(sent).not.toHaveProperty('withSubtasks')
  })

  test('a one-off linked task has no "Only this"', async () => {
    await tickLinkedParent('one-off', {})
    expect(choice('Complete all')).toBeVisible()
    expect(choice('Only this')).toBeNull()
  })

  test('moving down keeps subtasks behind their parent', async () => {
    renderTasks(<TaskListPage listId="l1" />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Actions for Wash windows' }),
    )
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move down' }))
    await waitFor(() => expect(calls('tasks:reorder')).toHaveLength(1))
    const ids = calls('tasks:reorder')[0].ids as string[]
    expect(ids.slice(0, 3)).toEqual(['t2', 't1', 's1'])
  })

  test('a list that is gone says so', () => {
    renderTasks(<TaskListPage listId="nope" />)
    expect(screen.getAllByText('List not found').length).toBeGreaterThan(0)
  })

  test('a grocery list is Groceries', () => {
    state.queries['taskLists:list'] = [list('l1', 'Shop', { grocery: true })]
    renderTasks(<TaskListPage listId="l1" />)
    expect(screen.getByText('navigated to /groceries')).toBeTruthy()
  })
})

describe('the panel', () => {
  test('Escape closes it, to the list itself', () => {
    renderTasks(<TaskListPage listId="l1" selectedTaskId="t1" />)
    fireEvent.keyDown(panel(), { key: 'Escape' })
    expect(state.navigated).toEqual([
      { to: '/tasks/$listId', params: { listId: 'l1' } },
    ])
  })

  test('Escape in an open field closes the field only', () => {
    renderTasks(<TaskListPage listId="l1" selectedTaskId="t1" />)
    fireEvent.click(within(panel()).getByRole('button', { name: /^Who/ }))
    fireEvent.keyDown(screen.getByRole('button', { name: /Sam/ }), {
      key: 'Escape',
    })
    expect(screen.queryByRole('button', { name: /Sam/ })).toBeNull()
    expect(state.navigated).toEqual([])
  })

  test('who and when are written as they are chosen', async () => {
    renderTasks(<TaskListPage listId="l1" selectedTaskId="t1" />)
    fireEvent.click(within(panel()).getByRole('button', { name: /^Who/ }))
    fireEvent.click(screen.getByRole('button', { name: /Sam/ }))
    await waitFor(() =>
      expect(calls('tasks:update')).toContainEqual(
        expect.objectContaining({ taskId: 't1', assigneeId: 'u2' }),
      ),
    )
    fireEvent.click(within(panel()).getByRole('button', { name: /^When/ }))
    fireEvent.change(screen.getByLabelText('Pick a date'), {
      target: { value: '2030-05-06' },
    })
    expect(calls('tasks:update')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(calls('tasks:update')).toContainEqual(
        expect.objectContaining({ taskId: 't1', dueDate: '2030-05-06' }),
      ),
    )
  })

  test('a reminder that has passed is refused', () => {
    renderTasks(<TaskListPage listId="l1" selectedTaskId="t1" />)
    fireEvent.click(within(panel()).getByRole('button', { name: /^Reminder/ }))
    fireEvent.change(screen.getByLabelText('Pick a date'), {
      target: { value: '2020-01-01' },
    })
    const submit = screen.getByRole('button', { name: 'Set reminder' })
    fireEvent.submit(submit.closest('form') as HTMLFormElement)
    expect(screen.getByRole('alert').textContent).toContain('has passed')
    expect(calls('tasks:setReminder')).toEqual([])
  })

  test('subtasks: count, add, and no subtasks of a subtask', async () => {
    const { unmount } = renderTasks(
      <TaskListPage listId="l1" selectedTaskId="t1" />,
    )
    expect(within(panel()).getByText('Subtasks · 0 of 1')).toBeTruthy()
    const add = screen.getByRole('textbox', {
      name: 'Add a subtask to Wash windows',
    })
    fireEvent.change(add, { target: { value: 'Find ladder' } })
    fireEvent.submit(add.closest('form') as HTMLFormElement)
    await waitFor(() =>
      expect(calls('tasks:add')[0]).toMatchObject({
        title: 'Find ladder',
        parentTaskId: 't1',
      }),
    )
    unmount()
    renderTasks(<TaskListPage listId="l1" selectedTaskId="s1" />)
    expect(within(panel()).queryByText(/^Subtasks/)).toBeNull()
    expect(within(panel()).queryByRole('button', { name: /^Repeat/ })).toBeNull()
  })

  test('a task deleted while open says so; a wrong id is not found', () => {
    const { goTo, unmount } = renderTasks(
      <TaskListPage listId="l1" selectedTaskId="t1" />,
    )
    state.queries['tasks:listByList'] = [BINS]
    state.queries['tasks:listOf'] = () => null
    goTo(<TaskListPage listId="l1" selectedTaskId="t1" />)
    expect(screen.getByText('This task was deleted')).toBeTruthy()
    unmount()
    renderTasks(<TaskListPage listId="l1" selectedTaskId="zz" />)
    expect(within(panel()).getByText('Task not found')).toBeTruthy()
  })

  test('opening a task someone gave you marks it seen', async () => {
    state.queries['tasks:listByList'] = [
      { ...WINDOWS, assigneeId: 'u1', assignmentNotice: { by: 'u2', at: 5 } },
    ]
    renderTasks(<TaskListPage listId="l1" selectedTaskId="t1" />)
    await waitFor(() =>
      expect(calls('tasks:markAssignmentSeen')).toHaveLength(1),
    )
  })

  test('a linked list hides what its provider cannot store', async () => {
    state.queries['taskLists:list'] = [
      list('lk', 'Todoist', {
        provider: 'todoist',
        capabilities: { write: true },
      }),
    ]
    state.queries['tasks:listOf'] = null
    state.linked = {
      status: 'ok',
      writable: true,
      tasks: [
        {
          externalId: 'x1',
          title: 'Call plumber',
          done: false,
          labels: [],
          url: 'https://todoist.com/x1',
        },
      ],
    }
    renderTasks(<TaskListPage listId="lk" selectedTaskId="x1" />)
    await waitFor(() =>
      expect(within(panel()).getByRole('button', { name: /^When/ })).toBeTruthy(),
    )
    for (const name of [/^Who/, /^Reminder/, /^Repeat/])
      expect(within(panel()).queryByRole('button', { name })).toBeNull()
    expect(within(panel()).queryByLabelText('Note')).toBeNull()
  })
})

describe('what a review found (APP-308)', () => {
  const smart = (...tasks: object[]) => {
    state.queries['tasks:smartLists'] = {
      me: 'u1',
      tasks,
      subtasks: [],
      parents: [],
    }
  }
  const menuItem = (title: string, name: string) => {
    fireEvent.click(
      screen.getByRole('button', { name: new RegExp(`Actions for ${title}`) }),
    )
    fireEvent.click(screen.getByRole('menuitem', { name }))
  }

  test('Move under offers its own list only, and all of it', async () => {
    state.queries['taskLists:list'] = [
      list('l1', 'Household'),
      list('lu', 'Todoist', {
        provider: 'todoist',
        capabilities: { write: true },
      }),
    ]
    const row = (externalId: string, title: string, due?: string) => ({
      externalId,
      title,
      done: false,
      labels: [],
      ...(due ? { dueDate: due } : {}),
    })
    state.linked = {
      status: 'ok',
      tasks: [row('y1', 'Call plumber', TODAY), row('y2', 'House jobs')],
    }
    const { unmount } = renderTasks(<TaskListPage listId="lu" />)
    await screen.findByText('Call plumber')
    unmount()
    smart(task('t2', 'Bins out', { dueDate: TODAY }))
    renderTasks(<SmartListPage smartList="today" />)
    await screen.findByText('Bins out')
    menuItem('Call plumber', 'Move under a task…')
    const dialog = within(screen.getByRole('dialog'))
    expect(dialog.getByText('House jobs')).toBeTruthy()
    expect(dialog.queryByText('Bins out')).toBeNull()
  })

  test('Enter saves the title, and Escape then closes the task', async () => {
    renderTasks(<TaskListPage listId="l1" selectedTaskId="t1" />)
    const title = within(panel()).getByRole('textbox', { name: 'Task title' })
    title.focus()
    fireEvent.change(title, { target: { value: 'Wash doors' } })
    fireEvent.keyDown(title, { key: 'Enter' })
    await waitFor(() => expect(calls('tasks:update')).toHaveLength(1))
    expect(document.activeElement).toBe(document.body)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(state.navigated).toHaveLength(1)
  })

  test('a title that failed to save on leaving is said, and kept', async () => {
    state.fail.add('tasks:update')
    const page = <TaskListPage listId="l1" selectedTaskId="t1" />
    const { unmount } = renderTasks(page)
    fireEvent.change(
      within(panel()).getByRole('textbox', { name: 'Task title' }),
      { target: { value: 'Wash doors' } },
    )
    unmount()
    await waitFor(() => expect(calls('tasks:update')).toHaveLength(1))
    await Promise.resolve()
    state.fail.clear()
    const again = renderTasks(page)
    const title = within(panel()).getByRole('textbox', { name: 'Task title' })
    expect((title as HTMLTextAreaElement).value).toBe('Wash doors')
    expect(within(panel()).getByText('Not saved. Try again.')).toBeTruthy()
    fireEvent.blur(title)
    await waitFor(() => expect(calls('tasks:update')).toHaveLength(2))
    again.unmount()
  })

  const titleField = () =>
    within(panel()).getByRole('textbox', {
      name: 'Task title',
    }) as HTMLTextAreaElement
  const lose = async (text: string) => {
    state.fail.add('tasks:update')
    const { unmount } = renderTasks(page)
    fireEvent.change(titleField(), { target: { value: text } })
    unmount()
    await waitFor(() => expect(calls('tasks:update')).toHaveLength(1))
    await new Promise((done) => setTimeout(done))
    state.fail.clear()
  }
  const page = <TaskListPage listId="l1" selectedTaskId="t1" />

  test('a save that fails after its page has gone is said on the next one', async () => {
    state.fail.add('tasks:update')
    const { goTo } = renderTasks(<TaskPage taskId="t1" />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Task title' }), {
      target: { value: 'ONE' },
    })
    goTo(<TaskListPage listId="l1" />)
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe('nope'),
    )
  })

  test('closing the panel says a save that fails', async () => {
    state.fail.add('tasks:update')
    const { goTo } = renderTasks(page)
    fireEvent.change(titleField(), { target: { value: 'FOUR' } })
    goTo(<TaskListPage listId="l1" />)
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe('nope'),
    )
  })

  test('with Tasks closed, the next Tasks page says it', async () => {
    await lose('FIVE')
    renderTasks(<SmartListPage smartList="today" />)
    expect(screen.getByRole('alert').textContent).toBe('nope')
  })

  test('typing the stored text back is no longer a failure', async () => {
    state.fail.add('tasks:update')
    renderTasks(page)
    fireEvent.change(titleField(), { target: { value: 'SIX' } })
    fireEvent.blur(titleField())
    const said = 'Not saved. Try again.'
    await waitFor(() => expect(within(panel()).getByText(said)).toBeTruthy())
    fireEvent.change(titleField(), { target: { value: 'Wash windows' } })
    expect(within(panel()).queryByText(said)).toBeNull()
  })

  test('a kept draft is not sent by opening and leaving the task', async () => {
    await lose('TWO')
    const { unmount } = renderTasks(page)
    expect(titleField().value).toBe('TWO')
    unmount()
    expect(calls('tasks:update')).toHaveLength(1)
    // Nor is it put over something newer.
    state.queries['tasks:listByList'] = [{ ...WINDOWS, title: 'SAMS' }]
    const again = renderTasks(page)
    expect(titleField().value).toBe('SAMS')
    again.unmount()
    expect(calls('tasks:update')).toHaveLength(1)
  })

  test('a newer save forgets the kept draft', async () => {
    await lose('THREE')
    const { unmount } = renderTasks(page)
    fireEvent.change(titleField(), { target: { value: 'NEWER' } })
    fireEvent.blur(titleField())
    await waitFor(() => expect(calls('tasks:update')).toHaveLength(2))
    await new Promise((done) => setTimeout(done))
    unmount()
    renderTasks(page)
    expect(titleField().value).toBe('Wash windows')
    expect(calls('tasks:update').map((sent) => sent.title)).toEqual([
      'THREE',
      'NEWER',
    ])
  })

  test('a draft that fails late does not come back over a newer one', async () => {
    let refuse = (_: Error) => {}
    state.slow = () => new Promise((_, reject) => (refuse = reject))
    const { unmount } = renderTasks(page)
    fireEvent.change(titleField(), { target: { value: 'OLD' } })
    unmount()
    state.slow = undefined
    const again = renderTasks(page)
    refuse(new Error('nope'))
    await screen.findByText('nope')
    fireEvent.change(titleField(), { target: { value: 'NEWER' } })
    fireEvent.blur(titleField())
    await waitFor(() => expect(calls('tasks:update')).toHaveLength(2))
    await new Promise((done) => setTimeout(done))
    again.unmount()
    const last = renderTasks(page)
    expect(titleField().value).not.toBe('OLD')
    last.unmount()
    expect(calls('tasks:update')).toHaveLength(2)
  })

  const fails = () => {
    let refuse = (_: Error) => {}
    state.slow = () => new Promise((_, reject) => (refuse = reject))
    return (error: Error) => refuse(error)
  }

  // #581 (APP-799), in the web's field.
  test('a late refusal of an older title says nothing about a newer one', async () => {
    const refuseOld = fails()
    const { unmount } = renderTasks(page)
    fireEvent.change(titleField(), { target: { value: 'OLD' } })
    fireEvent.blur(titleField())
    const refuseNew = fails()
    fireEvent.change(titleField(), { target: { value: 'NEWER' } })
    fireEvent.blur(titleField())
    refuseOld(new Error('nope'))
    await new Promise((done) => setTimeout(done))
    expect(titleField().value).toBe('NEWER')
    expect(within(panel()).queryByText('Not saved. Try again.')).toBeNull()
    refuseNew(new Error('nope'))
    expect(await within(panel()).findByText('Not saved. Try again.')).toBeTruthy()
    expect(titleField().value).toBe('NEWER')
    unmount()
  })

  test('a refused title is sent again by a blur, never by leaving', async () => {
    state.fail.add('tasks:update')
    const first = renderTasks(page)
    fireEvent.change(titleField(), { target: { value: 'REFUSED' } })
    fireEvent.blur(titleField())
    await within(panel()).findByText('Not saved. Try again.')
    state.fail.clear()
    first.unmount()
    expect(calls('tasks:update')).toHaveLength(1)
    const again = renderTasks(page)
    expect(titleField().value).toBe('REFUSED')
    fireEvent.blur(titleField())
    await waitFor(() => expect(calls('tasks:update')).toHaveLength(2))
    again.unmount()
  })

  test('a project linked to two lists: a task stays with the one it was opened from', async () => {
    const linked = { provider: 'todoist', capabilities: { write: true } }
    state.queries['taskLists:list'] = [
      list('one', 'One', linked),
      list('two', 'Two', linked),
    ]
    state.queries['tasks:listOf'] = null
    state.linked = {
      status: 'ok',
      tasks: [{ externalId: 'x1', title: 'Shared', done: false, labels: [] }],
    }
    const both = renderTasks(<TaskListPage listId="one" />)
    await screen.findByText('Shared')
    both.unmount()
    const second = renderTasks(
      <TaskListPage listId="two" selectedTaskId="x1" />,
    )
    await waitFor(() => expect(panel().textContent).toContain('Two'))
    second.unmount()
    const own = renderTasks(<TaskPage taskId="x1" listId="two" />)
    await waitFor(() => expect(screen.queryAllByText('Two').length).toBeGreaterThan(0))
    expect(screen.queryByText('One')).toBeNull()
    own.unmount()
  })

  test('Complete all on a linked list keeps its key until it was taken', async () => {
    state.queries['taskLists:list'] = [
      list('keys', 'Todoist', {
        provider: 'todoist',
        capabilities: { write: true },
      }),
    ]
    const rows = [
      { externalId: 'p', title: 'Pack', done: false, labels: [] },
      {
        externalId: 'c',
        title: 'Socks',
        done: false,
        labels: [],
        parentExternalId: 'p',
      },
    ]
    state.linked = { status: 'ok', tasks: rows }
    renderTasks(<TaskListPage listId="keys" />)
    await screen.findByText('Pack')
    const completeAll = async (times: number) => {
      const ring = () => screen.getByRole('checkbox', { name: 'Complete Pack' })
      await waitFor(() => expect(ring()).not.toBeDisabled())
      fireEvent.click(ring())
      fireEvent.click(screen.getByRole('button', { name: /^Complete all/ }))
      await waitFor(() =>
        expect(calls('taskLists:writeTask')).toHaveLength(times),
      )
      await new Promise((done) => setTimeout(done))
    }
    state.fail.add('taskLists:writeTask')
    await completeAll(1)
    state.fail.clear()
    state.written = { status: 'ok', tasks: [rows[0]], refresh: false }
    await completeAll(2)
    await completeAll(3)
    const keys = calls('taskLists:writeTask').map(
      (sent) => (sent.write as { requestKey?: string }).requestKey,
    )
    expect(keys[0]).toMatch(/^[\w-]{1,64}$/)
    expect(keys[1]).toBe(keys[0])
    expect(keys[2]).not.toBe(keys[0])
  })

  test('duplicating from a smart list brings every subtask', async () => {
    smart(task('t1', 'Wash windows', { dueDate: TODAY }))
    renderTasks(<SmartListPage smartList="today" />)
    menuItem('Wash windows', 'Duplicate')
    await waitFor(() => expect(calls('tasks:add')).toHaveLength(2))
    expect(calls('tasks:add')[1]).toMatchObject({
      title: 'Buy soap',
      parentTaskId: 'new-id',
    })
  })

  test('only a list itself adds to its last section', async () => {
    state.queries['taskLists:list'] = [
      list('l1', 'Household', { sections: [{ id: 'b', name: 'B' }] }),
    ]
    const addOne = async (page: ReactElement) => {
      state.calls = []
      const { unmount } = renderTasks(page)
      const field = screen.getByRole('textbox', { name: 'New task' })
      fireEvent.change(field, { target: { value: 'Mop floor' } })
      fireEvent.submit(field.closest('form') as HTMLFormElement)
      await waitFor(() => expect(calls('tasks:add')).toHaveLength(1))
      unmount()
      return calls('tasks:add')[0]?.sectionId
    }
    expect(await addOne(<TaskListPage listId="l1" />)).toBe('b')
    expect(await addOne(<SmartListPage smartList="today" />)).toBeUndefined()
  })
})

describe('the other pages', () => {
  test('the index lists Today, the smart lists and the lists', () => {
    renderTasks(<TasksIndexPage />)
    expect(screen.getByText('Nothing due today.')).toBeTruthy()
    expect(screen.getByText('My tasks')).toBeTruthy()
    expect(screen.getByText('Household')).toBeTruthy()
    expect(screen.getByText('2 open', { selector: 'span' })).toBeTruthy()
  })

  test('a new packing list arrives with its sections', async () => {
    renderTasks(<TasksIndexPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Add list' }))
    fireEvent.click(screen.getByRole('button', { name: /^Packing list/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() => expect(calls('taskLists:create')).toHaveLength(1))
    const sent = calls('taskLists:create')[0]
    expect(sent).toMatchObject({ kind: 'packing', provider: 'local' })
    expect((sent.starterSections as unknown[]).length).toBeGreaterThan(0)
    await waitFor(() =>
      expect(state.navigated.at(-1)).toMatchObject({ to: '/tasks/$listId' }),
    )
  })

  test('My tasks gives a new task to me', async () => {
    renderTasks(<SmartListPage smartList="mine" />)
    const field = screen.getByRole('textbox', { name: 'New task' })
    fireEvent.change(field, { target: { value: 'Mop floor' } })
    fireEvent.submit(field.closest('form') as HTMLFormElement)
    await waitFor(() =>
      expect(calls('tasks:add')[0]).toMatchObject({ assigneeId: 'u1' }),
    )
  })

  test('a smart list nobody knows goes to Tasks', () => {
    renderTasks(<SmartListPage smartList="never" />)
    expect(screen.getByText('navigated to /tasks')).toBeTruthy()
  })

  test("a task's own page has its trail and no close button", () => {
    renderTasks(<TaskPage taskId="t1" />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Wash windows',
    )
    expect(screen.queryByRole('button', { name: 'Close panel' })).toBeNull()
  })
})
