import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { renderInGroup } from '../app/testing'
import { GroceriesItemPage } from './GroceriesNestedPages'
import { GroceriesPage } from './GroceriesPage'
import { RecentPanel } from './RecentPanel'

const state = vi.hoisted(() => ({
  queries: {} as Record<string, unknown>,
  calls: [] as [string, Record<string, unknown>][],
  fail: new Set<string>(),
  navigated: [] as { to: string; search?: Record<string, string> }[],
  blocker: null as null | { shouldBlockFn: () => boolean },
  blocked: false,
}))

vi.mock('../../../convex/_generated/api', () => {
  const module = (name: string) =>
    new Proxy({}, { get: (_, key) => `${name}:${String(key)}` })
  return { api: new Proxy({}, { get: (_, key) => module(String(key)) }) }
})

vi.mock('convex/react', () => ({
  useQuery: (name: string, args: unknown) => {
    if (args === 'skip') return undefined
    const answer = state.queries[name]
    return typeof answer === 'function' ? answer(args) : answer
  },
  useMutation: (name: string) => async (args: Record<string, unknown>) => {
    state.calls.push([name, args])
    if (state.fail.has(name)) throw new Error('nope')
    return 'new-id'
  },
  useAction: () => async () => ({ status: 'unavailable' }),
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => async (to: (typeof state.navigated)[number]) => {
    state.navigated.push(to)
  },
  useBlocker: (options: { shouldBlockFn: () => boolean }) => {
    state.blocker = options
    return state.blocked
      ? { status: 'blocked', proceed: () => {}, reset: () => {} }
      : { status: 'idle' }
  },
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))

const list = (id: string, name: string, order: number) => ({
  _id: id,
  name,
  order,
  grocery: true,
  writable: true,
  provider: 'local',
  aisleOrder: null,
  checkedClearedAt: null,
  suggestionsOff: false,
})
const task = (id: string, title: string, more: object = {}) => ({
  _id: id,
  _creationTime: Date.UTC(2026, 9, 1, 12),
  listId: 'l1',
  title,
  done: false,
  createdBy: 'u1',
  ...more,
})

const MILK = task('t1', 'Melk', { quantity: 2, unit: 'pak', category: 'dairy' })
const SOAP = task('t2', 'Zeep', { category: 'household' })
const DONE = task('t3', 'Brood', { done: true, doneAt: 5, category: 'bakery' })

beforeEach(() => {
  window.localStorage.clear()
  state.calls = []
  state.fail = new Set()
  state.navigated = []
  state.blocked = false
  state.blocker = null
  window.matchMedia = ((query: string) => ({
    matches: true,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
  state.queries = {
    'taskLists:list': [list('l2', 'Markt', 2), list('l1', 'Supermarkt', 1)],
    'tasks:openCounts': [{ listId: 'l1', open: 2 }],
    'tasks:listByList': ({ listId }: { listId: string }) =>
      listId === 'l1' ? [SOAP, MILK, DONE] : [],
    'tasks:listOf': ({ taskId }: { taskId: string }) =>
      ['t1', 't2', 't3'].includes(taskId) ? 'l1' : null,
    'tasks:groceryHabits': {
      habits: [
        {
          key: 'melk',
          title: 'Melk',
          count: 9,
          lastAt: 1,
          intervalDays: 7,
          quantity: 1,
          unit: 'pak',
          category: 'dairy',
        },
      ],
      suggestions: [],
    },
    'tasks:recentGroceries': [
      { _id: 't3', title: 'Brood', doneAt: Date.now(), category: 'bakery' },
      { _id: 't9', title: 'melk', doneAt: Date.now(), category: 'dairy' },
    ],
    'groceryStaples:list': { staples: [], list: null },
    'groups:members': [{ userId: 'u1', name: 'Anna', role: 'admin' }],
    'groceryLines:aisles': undefined,
  }
})

const callsOf = (name: string) =>
  state.calls.filter(([called]) => called === name).map(([, args]) => args)

describe('the list', () => {
  test('groups open items by aisle in the walking order, with a Checked section', () => {
    renderInGroup(<GroceriesPage />)
    const headings = screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent)
    expect(headings.indexOf('Dairy and eggs')).toBeLessThan(
      headings.indexOf('Household'),
    )
    expect(screen.getByText('2 items on Supermarkt')).toBeTruthy()
    expect(screen.getByText('(1)')).toBeTruthy()
  })

  test('checks an item, and says so when that fails', async () => {
    state.fail.add('tasks:toggleDone')
    renderInGroup(<GroceriesPage />)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Check Melk' }))
    expect(callsOf('tasks:toggleDone')[0]).toMatchObject({ taskId: 't1' })
    expect(await screen.findByRole('alert')).toBeTruthy()
  })

  test('a row opens the panel through the URL, keeping the list and the tab', () => {
    renderInGroup(<GroceriesPage selectedListId="l1" tab="stock" />)
    fireEvent.click(screen.getByRole('button', { name: /^Melk, 2/ }))
    expect(state.navigated[0]).toMatchObject({
      to: '/groceries',
      search: { list: 'l1', item: 't1', tab: 'stock' },
    })
  })

  test('the switcher changes the list in the URL', () => {
    renderInGroup(<GroceriesPage />)
    fireEvent.click(screen.getByRole('button', { name: 'List: Supermarkt, switch' }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^Markt/ }))
    expect(state.navigated[0].search).toEqual({ list: 'l2' })
  })

  test('a Group without a grocery list is offered one', () => {
    state.queries['taskLists:list'] = []
    renderInGroup(<GroceriesPage />)
    expect(screen.getByText('No grocery list yet')).toBeTruthy()
  })
})

describe('adding', () => {
  const input = () => screen.getByRole<HTMLInputElement>('combobox', { name: 'Add item' })
  const type = (value: string) => {
    fireEvent.focus(input())
    fireEvent.change(input(), { target: { value } })
  }

  test('takes the amount off the line and clears the field at once', async () => {
    renderInGroup(<GroceriesPage />)
    type('3 pak yoghurt')
    expect(
      within(screen.getByTestId('grocery-recognised')).getByText('Yoghurt'),
    ).toBeTruthy()
    fireEvent.submit(input())
    expect(input().value).toBe('')
    await waitFor(() =>
      expect(callsOf('tasks:add')[0]).toMatchObject({
        listId: 'l1',
        title: 'Yoghurt',
        quantity: 3,
        unit: 'pak',
      }),
    )
  })

  test('a failed add puts the line back', async () => {
    state.fail.add('tasks:add')
    renderInGroup(<GroceriesPage />)
    type('yoghurt')
    fireEvent.submit(input())
    await waitFor(() => expect(input().value).toBe('yoghurt'))
    expect(screen.getByRole('alert')).toBeTruthy()
  })

  test('an aisle chosen here is saved on the new item', async () => {
    renderInGroup(<GroceriesPage />)
    type('yoghurt')
    fireEvent.click(screen.getByRole('button', { name: /^Aisle:/ }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Household' }))
    fireEvent.submit(input())
    await waitFor(() =>
      expect(callsOf('tasks:update')[0]).toMatchObject({
        taskId: 'new-id',
        category: 'household',
      }),
    )
  })

  test('a suggestion for an open item adds the typed amount to it', async () => {
    renderInGroup(<GroceriesPage />)
    type('3 pak mel')
    fireEvent.keyDown(input(), { key: 'ArrowDown' })
    fireEvent.submit(input())
    await waitFor(() =>
      expect(callsOf('tasks:update')[0]).toMatchObject({
        taskId: 't1',
        quantity: 5,
        unit: 'pak',
      }),
    )
    expect(callsOf('tasks:add')).toEqual([])
  })
})

describe('the item editor', () => {
  const field = (name: string) => screen.getByLabelText<HTMLInputElement>(name)

  test('saves only what changed', async () => {
    renderInGroup(<GroceriesPage selectedItemId="t1" />)
    expect(screen.getByText(/Added by Anna/)).toBeTruthy()
    const save = screen.getByRole<HTMLButtonElement>('button', { name: 'Save' })
    expect(save.disabled).toBe(true)
    fireEvent.change(field('Note'), { target: { value: 'halfvol' } })
    fireEvent.click(screen.getByRole('button', { name: /^Save/ }))
    await waitFor(() =>
      expect(callsOf('tasks:update')).toEqual([
        { taskId: 't1', groupSlug: 'jansen-household', notes: 'halfvol' },
      ]),
    )
  })

  test('another Member’s change lands beside a draft, not over it', () => {
    const page = <GroceriesPage selectedItemId="t1" />
    const { rerender } = renderInGroup(page)
    fireEvent.change(field('Note'), { target: { value: 'halfvol' } })
    state.queries['tasks:listByList'] = () => [{ ...MILK, title: 'Havermelk' }]
    rerender(<GroceriesPage selectedItemId="t1" />)
    expect(field('Note').value).toBe('halfvol')
    expect(field('Name').value).toBe('Havermelk')
  })

  test('leaving is blocked only while something is unsaved', () => {
    renderInGroup(<GroceriesPage selectedItemId="t1" />)
    expect(state.blocker?.shouldBlockFn()).toBe(false)
    fireEvent.change(field('Name'), { target: { value: 'Havermelk' } })
    expect(state.blocker?.shouldBlockFn()).toBe(true)
    fireEvent.change(field('Name'), { target: { value: 'Melk' } })
    expect(state.blocker?.shouldBlockFn()).toBe(false)
  })

  test('a blocked leave asks', () => {
    state.blocked = true
    renderInGroup(<GroceriesPage selectedItemId="t1" />)
    expect(screen.getByRole('alertdialog')).toBeTruthy()
  })

  test('an amount that is none cannot be saved', () => {
    renderInGroup(<GroceriesPage selectedItemId="t1" />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Amount' }), {
      target: { value: 'veel' },
    })
    expect(screen.getByRole('alert').textContent).toContain('positive amount')
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Save' }).disabled,
    ).toBe(true)
  })

  test('tells loading, an unknown address and a deleted item apart', () => {
    state.queries['tasks:listOf'] = undefined
    const { rerender } = renderInGroup(<GroceriesItemPage itemId="t1" />)
    expect(screen.getByRole('status').textContent).toBe('Loading…')
    state.queries['tasks:listOf'] = 'l1'
    rerender(<GroceriesItemPage itemId="t1" />)
    expect(field('Name').value).toBe('Melk')
    state.queries['tasks:listOf'] = null
    rerender(<GroceriesItemPage itemId="t1" />)
    expect(screen.getByRole('status').textContent).toContain('deleted')
  })

  test('an address that never existed is not called deleted', () => {
    renderInGroup(<GroceriesItemPage itemId="nope" />)
    expect(screen.getByRole('status').textContent).toBe('Item not found.')
  })
})

test('Recent puts an item back and marks what is already open', async () => {
  renderInGroup(
    <RecentPanel
      groupSlug="jansen-household"
      timeZone={undefined}
      listId={'l1' as never}
      openTitles={['Melk']}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: /Brood/ }))
  await waitFor(() =>
    expect(callsOf('tasks:putBack')[0]).toMatchObject({
      taskId: 't3',
      listId: 'l1',
    }),
  )
  expect(screen.queryByRole('button', { name: /melk/ })).toBeNull()
})
