import { fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { GroupActivityEntry } from '../../../convex/activity'
import { renderInGroup, TEST_GROUP } from '../app/testing'
import { ACTIVITY_PREVIEW, GroupHome } from './GroupHome'
import { type RailItem, railRows } from './StartParts'

/**
 * Start: the Group's day, as the phone's Home shows it (APP-640).
 *
 * The rules (overdue, due today, which baby log entries are on the rail) are
 * `@gather/core/home-today`'s and tested there; these hold the page to drawing
 * them: an empty day is quiet rather than broken, an overdue task brings the
 * Now card, and the rail runs oldest first into the Now capsule.
 */

type Rows = Record<string, unknown>
const state = vi.hoisted(() => ({
  members: undefined as unknown,
  activity: undefined as unknown,
  lists: [] as unknown,
  tasks: {} as Rows,
  babies: [] as unknown,
  events: {} as Rows,
  pins: null as unknown,
  names: [] as string[],
}))

vi.mock('convex/react', () => ({
  useQuery: (name: string) => {
    state.names.push(name)
    switch (name) {
      case 'groups:members':
        return state.members
      case 'activity:forGroup':
        return state.activity
      case 'taskLists:list':
        return state.lists
      case 'babies:list':
        return state.babies
      case 'users:myPins':
        return state.pins
      default:
        throw new Error(`unexpected query ${name}`)
    }
  },
  useQueries: (
    requests: Record<string, { query: string; args: Record<string, string> }>,
  ) =>
    Object.fromEntries(
      Object.entries(requests).map(([key, { query }]) => {
        state.names.push(query)
        return [key, query === 'tasks:listByList' ? state.tasks[key] : state.events[key]]
      }),
    ),
  useMutation: () => {
    throw new Error('Start never writes')
  },
}))

vi.mock('../../../convex/_generated/api', () => ({
  api: {
    groups: { members: 'groups:members' },
    activity: { forGroup: 'activity:forGroup' },
    taskLists: { list: 'taskLists:list' },
    tasks: { listByList: 'tasks:listByList' },
    babies: { list: 'babies:list' },
    babyEvents: { listByBaby: 'babyEvents:listByBaby' },
    users: { myPins: 'users:myPins' },
  },
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    ...rest
  }: {
    children: React.ReactNode
    to: string
    params?: Record<string, string>
  }) => (
    <a
      href={Object.entries(params ?? {}).reduce(
        (path, [key, value]) => path.replace(`$${key}`, value),
        to,
      )}
      {...rest}
    >
      {children}
    </a>
  ),
}))

/** Monday 23 November 2026, 14:14 local time. */
const NOW = new Date(2026, 10, 23, 14, 14)
const at = (hours: number, minutes: number) =>
  new Date(2026, 10, 23, hours, minutes).getTime()

const HOUSEHOLD = { ...TEST_GROUP, name: 'Willow Street' }

const MEMBERS = [
  { userId: 'u_sam', name: 'Sam', role: 'admin' },
  { userId: 'u_nora', name: 'Nora', role: 'member' },
  { userId: 'u_test', name: 'Test User', role: 'member' },
]

const HOUSE = { _id: 'list_house', name: 'House', provider: 'local' }
const WEEKEND = { _id: 'list_weekend', name: 'Weekend', provider: 'local' }

const task = (
  id: string,
  listId: string,
  fields: { dueDate?: string; done?: boolean } = {},
) => ({ _id: id, listId, title: id, done: false, ...fields })

type RecipeEntry = Extract<GroupActivityEntry, { kind: 'recipe' }>
const entry = (over: Partial<RecipeEntry> = {}): RecipeEntry => ({
  id: 'r1',
  kind: 'recipe',
  at: NOW.getTime(),
  byName: 'Test User',
  title: 'Shakshuka',
  context: null,
  targetId: 'recipe_1',
  ...over,
})

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  state.members = MEMBERS
  state.activity = []
  state.lists = []
  state.tasks = {}
  state.babies = []
  state.events = {}
  state.pins = null
  state.names = []
})

afterEach(() => {
  vi.useRealTimers()
})

describe('the header', () => {
  test('names the Group, then the date and how many Members', () => {
    renderInGroup(<GroupHome />, { group: HOUSEHOLD })

    expect(
      screen.getByRole('heading', { name: 'Willow Street', level: 1 }),
    ).toBeDefined()
    expect(screen.getByTestId('start-byline').textContent).toBe(
      'Monday 23 November · 3 members',
    )
  })

  test('the Members are not listed here: they stay on the Group page', () => {
    renderInGroup(<GroupHome />, { group: HOUSEHOLD })

    expect(screen.queryByText('Nora')).toBeNull()
    expect(screen.queryByRole('region', { name: 'Who is here' })).toBeNull()
  })
})

describe('an empty day', () => {
  test('keeps the two-column grid, so a late Now card does not move the page', () => {
    renderInGroup(<GroupHome />, { group: HOUSEHOLD })

    const day = screen.getByTestId('start-day')
    expect(day.childElementCount).toBe(0)
    expect(day.parentElement?.className).toContain(
      'lg:grid-cols-[minmax(0,1fr)_360px]',
    )
  })

  test('has no Now card, no rail and no Anytime list, and says what to do next', () => {
    state.lists = [HOUSE]
    state.tasks = { list_house: [task('Later', 'list_house', { dueDate: '2026-12-05' })] }
    state.babies = [{ _id: 'baby_juno', name: 'Juno' }]
    state.events = { baby_juno: [] }
    renderInGroup(<GroupHome />, { group: HOUSEHOLD })

    expect(screen.queryByTestId('start-now')).toBeNull()
    expect(screen.queryByTestId('start-rail')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Today' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Anytime today' })).toBeNull()
    expect(screen.getByText(/nothing has happened in willow street/i)).toBeDefined()
    const activity = screen.getByRole('region', { name: 'Recent activity' })
    expect(
      within(activity).getByRole('link', { name: 'Recipes' }).getAttribute('href'),
    ).toBe('/recipes')
  })

  test('says it is still loading rather than that nothing has happened', () => {
    state.activity = undefined
    renderInGroup(<GroupHome />, { group: HOUSEHOLD })

    expect(screen.queryByText(/nothing has happened/i)).toBeNull()
  })
})

describe('the Now card', () => {
  test("goes by the Group's day, not this device's", () => {
    vi.setSystemTime(new Date('2026-11-29T10:30:00Z'))
    state.lists = [HOUSE]
    state.tasks = {
      list_house: [task('Due Sunday', 'list_house', { dueDate: '2026-11-29' })],
    }
    const { unmount } = renderInGroup(<GroupHome />, {
      group: { ...HOUSEHOLD, timeZone: 'Pacific/Kiritimati' },
    })
    expect(screen.getByTestId('start-now')).toBeDefined()
    expect(screen.getByText(/Monday.*30 Nov|30 Nov.*Monday|Monday.*Nov.* 30/)).toBeDefined()
    unmount()
    renderInGroup(<GroupHome />, {
      group: { ...HOUSEHOLD, timeZone: 'Europe/Amsterdam' },
    })
    expect(screen.queryByTestId('start-now')).toBeNull()
  })

  test('counts the overdue tasks and opens the one list they are on', () => {
    state.lists = [HOUSE, WEEKEND]
    state.tasks = {
      list_house: [
        task('Bleed the radiators', 'list_house', { dueDate: '2026-11-20' }),
        task('Done late', 'list_house', { dueDate: '2026-11-01', done: true }),
        task('Due today', 'list_house', { dueDate: '2026-11-23' }),
      ],
      list_weekend: [task('Later', 'list_weekend', { dueDate: '2026-11-28' })],
    }
    renderInGroup(<GroupHome />, { group: HOUSEHOLD })

    const card = screen.getByTestId('start-now')
    expect(within(card).getByText('Overdue tasks')).toBeDefined()
    expect(within(card).getByText('1')).toBeDefined()
    expect(within(card).getByText('in House')).toBeDefined()
    const open = within(card).getByRole('link', { name: 'Open House' })
    expect(open.getAttribute('href')).toBe('/tasks')
    expect(open.dataset.group).toBe('home')

    // Due today is Anytime today, never the Now card.
    const anytime = screen.getByRole('region', { name: 'Anytime today' })
    expect(within(anytime).getByText('Due today')).toBeDefined()
    expect(within(anytime).getByText('in House')).toBeDefined()
  })

  test('spread over lists, it opens Tasks itself', () => {
    state.lists = [HOUSE, WEEKEND]
    state.tasks = {
      list_house: [task('A', 'list_house', { dueDate: '2026-11-20' })],
      list_weekend: [task('B', 'list_weekend', { dueDate: '2026-11-22' })],
    }
    renderInGroup(<GroupHome />, { group: HOUSEHOLD })

    const card = screen.getByTestId('start-now')
    expect(within(card).getByText('2')).toBeDefined()
    expect(within(card).getByText('across 2 lists')).toBeDefined()
    expect(within(card).getByRole('link', { name: 'Open tasks' })).toBeDefined()
  })

  test('a linked list is never asked for its tasks', () => {
    state.lists = [{ _id: 'list_notion', name: 'Notion', provider: 'notion' }]
    renderInGroup(<GroupHome />, { group: HOUSEHOLD })

    expect(state.names).not.toContain('tasks:listByList')
  })
})

describe('the Today rail', () => {
  test('runs oldest first into the Now capsule, past items muted', () => {
    state.babies = [{ _id: 'baby_juno', name: 'Juno' }]
    state.events = {
      baby_juno: [
        { _id: 'e3', type: 'note', timestamp: at(12, 0), data: { text: 'Bottle' } },
        { _id: 'e1', type: 'note', timestamp: at(8, 10), data: { text: 'Woke' } },
        { _id: 'e2', type: 'note', timestamp: at(10, 15), data: { text: 'Nap' } },
        // Typed ahead for tonight: not on the rail until it has happened.
        { _id: 'e4', type: 'note', timestamp: at(19, 0), data: { text: 'Bath' } },
      ],
    }
    renderInGroup(<GroupHome />, { group: HOUSEHOLD })

    const rail = screen.getByTestId('start-rail')
    const rows = [...rail.querySelectorAll('li')]
    expect(rows.map((row) => row.dataset.rail)).toEqual([
      'past',
      'past',
      'past',
      'now',
    ])
    expect(rows.map((row) => row.querySelector('time')?.textContent)).toEqual([
      '08:10',
      '10:15',
      '12:00',
      undefined,
    ])
    expect(rows[0].className).toContain('text-[var(--muted)]')
    expect(rows[0].textContent).toContain('Juno')
    expect(rows[3].textContent).toBe('Now · 14:14')
    expect(rows[3].getAttribute('aria-hidden')).toBe('true')
    expect(rail.textContent).not.toContain('Bath')
  })

  test('an entry logged inside the current minute is past, never upcoming', () => {
    state.babies = [{ _id: 'baby_juno', name: 'Juno' }]
    state.events = { baby_juno: [] }
    const { rerender } = renderInGroup(<GroupHome />, { group: HOUSEHOLD })

    // The minute clock still says 14:14:00; the entry is from 14:14:30.
    vi.setSystemTime(NOW.getTime() + 31_000)
    state.events = {
      baby_juno: [
        {
          _id: 'e1',
          type: 'note',
          timestamp: NOW.getTime() + 30_000,
          data: { text: 'Just now' },
        },
      ],
    }
    rerender(<GroupHome />)

    const rows = [...screen.getByTestId('start-rail').querySelectorAll('li')]
    expect(rows.map((row) => row.dataset.rail)).toEqual(['past', 'now'])
  })

  test('puts upcoming items after the capsule, in ink 600 on their group tile', () => {
    const item = (id: string, hours: number): RailItem => ({
      id,
      timestamp: at(hours, 0),
      time: `${hours}:00`,
      group: 'kitchen',
      icon: 'ChefHat',
      title: id,
    })
    const rows = railRows(
      [item('dinner', 18), item('breakfast', 8), item('lunch', 12)],
      NOW.getTime(),
    )
    expect(
      rows.map((row) => (row.kind === 'now' ? 'now' : row.item.id)),
    ).toEqual(['breakfast', 'lunch', 'now', 'dinner'])
    expect(rows.flatMap((row) => (row.kind === 'item' ? [row.past] : []))).toEqual([
      true,
      true,
      false,
    ])
  })
})

describe('Pinned', () => {
  test('draws each Pin as a group-fill card that opens its Module', () => {
    state.pins = ['recipes', 'tasks']
    renderInGroup(<GroupHome />, { group: HOUSEHOLD })

    const pinned = screen.getByRole('region', { name: 'Pinned' })
    const recipes = within(pinned).getByRole('link', { name: 'Recipes' })
    expect(recipes.getAttribute('href')).toBe('/recipes')
    expect(recipes.dataset.group).toBe('kitchen')
    expect(
      within(pinned).getByRole('link', { name: 'Tasks' }).dataset.group,
    ).toBe('home')
  })

  test('a long Module name hyphenates rather than breaking mid-word', () => {
    state.pins = ['recipes']
    renderInGroup(<GroupHome />, { group: HOUSEHOLD })

    const label = within(screen.getByRole('region', { name: 'Pinned' }))
      .getByText('Recipes')
    expect(label.className).toContain('hyphens-auto')
    expect(label.className).not.toContain('wrap-anywhere')
  })

  test('is absent when nothing is pinned', () => {
    state.pins = []
    renderInGroup(<GroupHome />, { group: HOUSEHOLD })

    expect(screen.queryByRole('region', { name: 'Pinned' })).toBeNull()
  })
})

describe('recent activity', () => {
  test('asks for this Group and no other', () => {
    renderInGroup(<GroupHome />, { group: HOUSEHOLD })
    expect(state.names).toContain('activity:forGroup')
  })

  test('says who did what, in which Module, linked to its page', () => {
    state.activity = [entry()]
    renderInGroup(<GroupHome />, { group: HOUSEHOLD })

    const list = screen.getByRole('list', { name: 'Recent activity' })
    expect(within(list).getByText('Test User')).toBeDefined()
    expect(within(list).getByText(/added the recipe/i)).toBeDefined()
    expect(
      within(list).getByRole('link', { name: 'Shakshuka' }).getAttribute('href'),
    ).toBe('/recipes/recipe_1')
    expect(within(list).getByText('Recipes')).toBeDefined()
  })

  test('links a log entry to its child and a task to Tasks', () => {
    state.activity = [
      {
        id: 'e1',
        kind: 'babyEvent',
        eventType: 'feeding',
        at: NOW.getTime(),
        context: 'Juno',
        targetId: 'baby_1',
        byName: 'Nora',
      },
      { ...entry({ id: 't1', title: 'Descale the kettle', context: 'House', targetId: null }), kind: 'task' },
    ]
    renderInGroup(<GroupHome />, { group: HOUSEHOLD })

    expect(screen.getByRole('link', { name: 'Feeding' }).getAttribute('href')).toBe(
      '/baby/baby_1',
    )
    expect(
      screen.getByRole('link', { name: 'Descale the kettle' }).getAttribute('href'),
    ).toBe('/tasks')
  })

  test('an entry whose person has gone still says what happened', () => {
    state.activity = [entry({ byName: null })]
    renderInGroup(<GroupHome />, { group: HOUSEHOLD })

    expect(screen.getByText('Someone')).toBeDefined()
  })

  test(`shows the ${ACTIVITY_PREVIEW} newest, and the rest behind See all`, () => {
    state.activity = Array.from({ length: 7 }, (_, index) =>
      entry({ id: `r${index}`, title: `Recipe ${index}` }),
    )
    renderInGroup(<GroupHome />, { group: HOUSEHOLD })

    const list = screen.getByRole('list', { name: 'Recent activity' })
    expect(list.querySelectorAll(':scope > li')).toHaveLength(ACTIVITY_PREVIEW)
    expect(list.textContent).toContain('Recipe 0')
    expect(list.textContent).not.toContain('Recipe 5')

    fireEvent.click(screen.getByRole('button', { name: 'See all' }))
    expect(list.querySelectorAll(':scope > li')).toHaveLength(7)
    expect(screen.getByRole('button', { name: 'Show fewer' })).toBeDefined()
  })

  test('has no See all when everything fits', () => {
    state.activity = [entry()]
    renderInGroup(<GroupHome />, { group: HOUSEHOLD })

    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('what a phone has to survive', () => {
  test('a long name and a long title wrap instead of setting a width', () => {
    state.activity = [
      entry({ title: 'Slowroastedlambshoulderwithanchovyrosemaryandflatbreads' }),
    ]
    renderInGroup(<GroupHome />, {
      group: { ...TEST_GROUP, name: 'Vandenbergenhuishoudenoverdewintermaanden' },
    })

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading.className).toContain('wrap-anywhere')
    expect(heading.closest('header')?.parentElement?.className).toContain(
      'minmax(0,1fr)',
    )
    const row = screen
      .getByRole('list', { name: 'Recent activity' })
      .querySelector('li > div')
    expect(row?.className).toContain('minmax(0,1fr)')
    expect(row?.querySelector('p')?.className).toContain('wrap-anywhere')
  })

  test('the page never lays anything out in a table', () => {
    state.activity = [entry(), entry({ id: 'r2', title: 'Second' })]
    const { container } = renderInGroup(<GroupHome />, { group: HOUSEHOLD })
    expect(container.querySelector('table')).toBeNull()
  })
})
