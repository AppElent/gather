import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { renderInGroup } from '../app/testing'
import { SmartListPage } from './SmartListPage'
import { TaskListPage } from './TaskListPage'
import { TaskPage } from './TaskPage'
import { TasksIndexPage } from './TasksIndexPage'

const state = vi.hoisted(() => ({
  queries: {} as Record<string, unknown>,
  calls: [] as [string, Record<string, unknown>][],
  fail: new Set<string>(),
  navigated: [] as { to: string; search?: Record<string, string> }[],
  linked: { status: 'unavailable' } as unknown,
  desktop: true,
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
      if (state.fail.has(name)) throw new Error('nope')
      if (name === 'taskLists:getTasks') return state.linked
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

const calls = (name: string) =>
  state.calls.filter(([each]) => each === name).map(([, args]) => args)

beforeEach(() => {
  state.calls = []
  state.fail = new Set()
  state.navigated = []
  state.linked = { status: 'unavailable' }
  state.desktop = true
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

describe('a list', () => {
  test('a quick-add line is read before it is added', async () => {
    renderInGroup(<TaskListPage listId="l1" />)
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
    renderInGroup(<TaskListPage listId="l1" />)
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
    renderInGroup(<TaskListPage listId="l1" />)
    const field = screen.getByRole('textbox', { name: 'New task' })
    fireEvent.keyDown(document.body, { key: 'n' })
    expect(document.activeElement).toBe(field)
    field.blur()
    fireEvent.click(screen.getByRole('button', { name: 'Add task' }))
    expect(document.activeElement).toBe(field)
  })

  test('a ring ticks its task; subtasks are not rows', async () => {
    renderInGroup(<TaskListPage listId="l1" />)
    expect(screen.queryByText('Buy soap')).toBeNull()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Complete Bins out' }))
    await waitFor(() =>
      expect(calls('tasks:toggleDone')[0]).toMatchObject({ taskId: 't2' }),
    )
  })

  test('a task with open subtasks asks first', async () => {
    renderInGroup(<TaskListPage listId="l1" />)
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

  test('moving down keeps subtasks behind their parent', async () => {
    renderInGroup(<TaskListPage listId="l1" />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Actions for Wash windows' }),
    )
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move down' }))
    await waitFor(() => expect(calls('tasks:reorder')).toHaveLength(1))
    const ids = calls('tasks:reorder')[0].ids as string[]
    expect(ids.slice(0, 3)).toEqual(['t2', 't1', 's1'])
  })

  test('a list that is gone says so', () => {
    renderInGroup(<TaskListPage listId="nope" />)
    expect(screen.getAllByText('List not found').length).toBeGreaterThan(0)
  })

  test('a grocery list is Groceries', () => {
    state.queries['taskLists:list'] = [list('l1', 'Shop', { grocery: true })]
    renderInGroup(<TaskListPage listId="l1" />)
    expect(screen.getByText('navigated to /groceries')).toBeTruthy()
  })
})

describe('the panel', () => {
  test('Escape closes it, to the list itself', () => {
    renderInGroup(<TaskListPage listId="l1" selectedTaskId="t1" />)
    fireEvent.keyDown(panel(), { key: 'Escape' })
    expect(state.navigated).toEqual([
      { to: '/tasks/$listId', params: { listId: 'l1' } },
    ])
  })

  test('Escape in an open field closes the field only', () => {
    renderInGroup(<TaskListPage listId="l1" selectedTaskId="t1" />)
    fireEvent.click(within(panel()).getByRole('button', { name: /^Who/ }))
    fireEvent.keyDown(screen.getByRole('button', { name: /Sam/ }), {
      key: 'Escape',
    })
    expect(screen.queryByRole('button', { name: /Sam/ })).toBeNull()
    expect(state.navigated).toEqual([])
  })

  test('who and when are written as they are chosen', async () => {
    renderInGroup(<TaskListPage listId="l1" selectedTaskId="t1" />)
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
    renderInGroup(<TaskListPage listId="l1" selectedTaskId="t1" />)
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
    const { unmount } = renderInGroup(
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
    renderInGroup(<TaskListPage listId="l1" selectedTaskId="s1" />)
    expect(within(panel()).queryByText(/^Subtasks/)).toBeNull()
    expect(within(panel()).queryByRole('button', { name: /^Repeat/ })).toBeNull()
  })

  test('a task deleted while open says so; a wrong id is not found', () => {
    const { rerender, unmount } = renderInGroup(
      <TaskListPage listId="l1" selectedTaskId="t1" />,
    )
    state.queries['tasks:listByList'] = [BINS]
    state.queries['tasks:listOf'] = () => null
    rerender(<TaskListPage listId="l1" selectedTaskId="t1" />)
    expect(screen.getByText('This task was deleted')).toBeTruthy()
    unmount()
    renderInGroup(<TaskListPage listId="l1" selectedTaskId="zz" />)
    expect(within(panel()).getByText('Task not found')).toBeTruthy()
  })

  test('opening a task someone gave you marks it seen', async () => {
    state.queries['tasks:listByList'] = [
      { ...WINDOWS, assigneeId: 'u1', assignmentNotice: { by: 'u2', at: 5 } },
    ]
    renderInGroup(<TaskListPage listId="l1" selectedTaskId="t1" />)
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
    renderInGroup(<TaskListPage listId="lk" selectedTaskId="x1" />)
    await waitFor(() =>
      expect(within(panel()).getByRole('button', { name: /^When/ })).toBeTruthy(),
    )
    for (const name of [/^Who/, /^Reminder/, /^Repeat/])
      expect(within(panel()).queryByRole('button', { name })).toBeNull()
    expect(within(panel()).queryByLabelText('Note')).toBeNull()
  })
})

describe('the other pages', () => {
  test('the index lists Today, the smart lists and the lists', () => {
    renderInGroup(<TasksIndexPage />)
    expect(screen.getByText('Nothing due today.')).toBeTruthy()
    expect(screen.getByText('My tasks')).toBeTruthy()
    expect(screen.getByText('Household')).toBeTruthy()
    expect(screen.getByText('2 open', { selector: 'span' })).toBeTruthy()
  })

  test('a new packing list arrives with its sections', async () => {
    renderInGroup(<TasksIndexPage />)
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
    renderInGroup(<SmartListPage smartList="mine" />)
    const field = screen.getByRole('textbox', { name: 'New task' })
    fireEvent.change(field, { target: { value: 'Mop floor' } })
    fireEvent.submit(field.closest('form') as HTMLFormElement)
    await waitFor(() =>
      expect(calls('tasks:add')[0]).toMatchObject({ assigneeId: 'u1' }),
    )
  })

  test('a smart list nobody knows goes to Tasks', () => {
    renderInGroup(<SmartListPage smartList="never" />)
    expect(screen.getByText('navigated to /tasks')).toBeTruthy()
  })

  test("a task's own page has its trail and no close button", () => {
    renderInGroup(<TaskPage taskId="t1" />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Wash windows',
    )
    expect(screen.queryByRole('button', { name: 'Close panel' })).toBeNull()
  })
})
