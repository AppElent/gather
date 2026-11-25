import { addDays, mondayStart, todayIn } from '@gather/core/civil-date'
import { resolveMealPreferences } from '@gather/core/meal-preferences'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { renderInGroup, TEST_GROUP } from '../app/testing'
import { MealPlannerNotices } from './MealPlannerNotices'
import { MealPlannerPage } from './MealPlannerPage'
import { MealPreferencesPage } from './MealPreferencesPage'
import { RecordPage } from './RecordPage'

const state = vi.hoisted(() => ({
  queries: {} as Record<string, unknown>,
  answers: {} as Record<string, unknown>,
  calls: [] as [string, Record<string, unknown>][],
  fail: new Set<string>(),
  navigated: [] as { to: string; search?: Record<string, string> }[],
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
      return state.answers[name] ?? null
    }
    return Object.assign(run, { withOptimisticUpdate: () => run })
  }
  return {
    useQuery: (name: string, args: unknown) =>
      args === 'skip' ? undefined : state.queries[name],
    useQueries: () => ({}),
    useMutation: call,
    useAction: call,
    useConvexConnectionState: () => ({ isWebSocketConnected: true }),
  }
})

vi.mock('@tanstack/react-router', () => {
  const navigate = async (to: (typeof state.navigated)[number]) => {
    state.navigated.push(to)
  }
  return {
    useNavigate: () => navigate,
    Link: ({
      children,
      to,
      search,
      params: _params,
      ...rest
    }: {
      children: ReactNode
      to: string
      search?: Record<string, string>
      params?: unknown
    }) => (
      <a {...rest} href={`${to}?${new URLSearchParams(search)}`}>
        {children}
      </a>
    ),
  }
})

const MONDAY = mondayStart(todayIn(TEST_GROUP.timeZone))
const day = (index: number) => addDays(MONDAY, index)
const meal = (id: string, date: string, title: string, more: object = {}) => ({
  _id: id,
  date,
  slot: 'dinner',
  title,
  ...more,
})
const draft = (id: string, date: string, title: string) => ({
  _id: id,
  date,
  slot: 'dinner',
  title,
  reason: 'Highly rated',
  source: 'ai',
  wishes: [],
})
const members = [
  { userId: 'u1', name: 'Eva' },
  { userId: 'u2', name: 'Sam' },
]
const week = (meals: object[]) => ({
  meals,
  members,
  events: [],
  preferences: resolveMealPreferences(null, members),
  groceryListId: null,
})

const calls = (name: string) =>
  state.calls.filter(([each]) => each === name).map(([, args]) => args)
const show = (page: ReactNode) =>
  renderInGroup(<MealPlannerNotices>{page}</MealPlannerNotices>)
const row = (date: string) =>
  within(screen.getByTestId(`day-${date}`))
    .getByText('Dinner')
    .closest('li') as HTMLElement

function drag(from: HTMLElement, to: HTMLElement) {
  const dataTransfer = { setData() {}, effectAllowed: '', dropEffect: '' }
  fireEvent.dragStart(from, { dataTransfer })
  fireEvent.dragOver(to, { dataTransfer })
  fireEvent.drop(to, { dataTransfer })
}

beforeEach(() => {
  state.calls = []
  state.fail = new Set()
  state.navigated = []
  state.answers = {
    'mealPlan:move': { kind: 'move' },
    'mealPlan:remove': { date: day(0), slot: 'dinner', title: 'Pasta' },
    'mealPlanDrafts:accept': 'planned',
    'mealPlanDrafts:acceptAll': { skipped: 0 },
    'mealPlanDrafts:regenerate': { status: 'ai' },
  }
  window.matchMedia = ((media: string) => ({
    matches: true,
    media,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
  state.queries = {
    'mealPlan:week': week([
      meal('m1', day(0), 'Pasta'),
      meal('m2', day(2), 'Tacos'),
    ]),
    'mealPlanDrafts:list': [],
    'groceryStaples:list': { staples: [] },
    'aiUsage:today': { used: 0, left: 30, limit: 30 },
  }
})

describe('the week', () => {
  test('seven day cards, what is planned and the summary', () => {
    show(<MealPlannerPage search={{}} />)
    expect(screen.getAllByTestId(/^day-/)).toHaveLength(7)
    expect(document.body.textContent?.includes('2 of 9 planned')).toBeTruthy()
    expect(within(row(day(0))).getByRole('link', { name: /Pasta/ })).toBeTruthy()
    expect(
      within(row(day(1))).getByRole('button', { name: /choose something/i }),
    ).toBeTruthy()
  })

  test('dragging moves a meal to another day, and swaps on a planned one', async () => {
    show(<MealPlannerPage search={{}} />)
    drag(row(day(0)), row(day(4)))
    await screen.findByText(/Pasta moved to/)
    state.answers['mealPlan:move'] = { kind: 'swap' }
    drag(row(day(0)), row(day(2)))
    await screen.findByText('Pasta swapped with Tacos.')
    expect(calls('mealPlan:move')).toEqual([
      expect.objectContaining({ id: 'm1', date: day(4), slot: 'dinner' }),
      expect.objectContaining({ id: 'm1', date: day(2), slot: 'dinner' }),
    ])
  })

  test('a meal dropped where it is, writes nothing', () => {
    show(<MealPlannerPage search={{}} />)
    drag(row(day(0)), row(day(0)))
    expect(calls('mealPlan:move')).toEqual([])
  })

  test('a refused move says so', async () => {
    state.fail.add('mealPlan:move')
    show(<MealPlannerPage search={{}} />)
    drag(row(day(0)), row(day(4)))
    expect(await screen.findByText('That did not work. Please try again.')).toBeTruthy()
  })
})

describe('the proposal', () => {
  beforeEach(() => {
    state.queries['mealPlanDrafts:list'] = [
      draft('d1', day(1), 'Curry'),
      draft('d2', day(3), 'Soup'),
      draft('taken', day(0), 'Chilli'),
    ]
  })

  test('the bar counts open slots only, and accepts or discards them all', async () => {
    show(<MealPlannerPage search={{}} />)
    const bar = within(screen.getByTestId('proposal-bar'))
    expect(bar.getByText('Proposal for 2 evenings')).toBeTruthy()
    fireEvent.click(bar.getByRole('button', { name: 'Accept all' }))
    await screen.findByText('Everything is in the week menu')
    fireEvent.click(bar.getByRole('button', { name: 'Discard' }))
    await screen.findByText('Proposal discarded. Nothing changed.')
    expect(calls('mealPlanDrafts:acceptAll')).toEqual([
      { groupSlug: TEST_GROUP.slug, weekStart: MONDAY },
    ])
    expect(calls('mealPlanDrafts:discard')).toHaveLength(1)
  })

  test('one proposal is accepted or asked again', async () => {
    show(<MealPlannerPage search={{ draft: 'd1' }} />)
    fireEvent.click(screen.getByRole('button', { name: /^Another proposal for/ }))
    await waitFor(() =>
      expect(calls('mealPlanDrafts:regenerate')).toEqual([
        { groupSlug: TEST_GROUP.slug, id: 'd1', locale: 'en' },
      ]),
    )
    fireEvent.click(screen.getByRole('button', { name: /^Accept Curry for/ }))
    expect(calls('mealPlanDrafts:accept')).toEqual([
      { groupSlug: TEST_GROUP.slug, id: 'd1' },
    ])
  })

  test('over the cap another proposal opens the plan dialog', async () => {
    state.answers['mealPlanDrafts:regenerate'] = { status: 'limit' }
    state.queries['aiUsage:today'] = { used: 30, left: 0, limit: 30 }
    show(<MealPlannerPage search={{ draft: 'd1' }} />)
    fireEvent.click(screen.getByRole('button', { name: /^Another proposal for/ }))
    expect(
      await screen.findByText('Your smart actions for today are used up'),
    ).toBeTruthy()
  })

  test('the panel follows its slot when the proposal is replaced', async () => {
    const page = <MealPlannerPage search={{ draft: 'd1' }} />
    const { rerender } = show(page)
    state.queries['mealPlanDrafts:list'] = [draft('d9', day(1), 'Stew')]
    rerender(
      <MealPlannerNotices>
        <MealPlannerPage search={{ draft: 'd1' }} />
      </MealPlannerNotices>,
    )
    await waitFor(() =>
      expect(state.navigated.at(-1)).toMatchObject({
        search: { draft: 'd9' },
        replace: true,
      }),
    )
  })
})

describe('the meal panel', () => {
  test('eaters, servings, a move and the note are saved', async () => {
    show(<MealPlannerPage search={{ meal: 'm1' }} />)
    fireEvent.click(screen.getByRole('button', { name: 'More servings' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sam' }))
    const note = screen.getByRole('textbox', { name: 'Note' })
    fireEvent.change(note, { target: { value: ' Make extra ' } })
    fireEvent.blur(note)
    expect(calls('mealPlan:update')).toEqual([
      expect.objectContaining({ id: 'm1', servings: 3 }),
      expect.objectContaining({ id: 'm1', eaterIds: ['u1'] }),
      expect.objectContaining({ id: 'm1', note: 'Make extra' }),
    ])
    fireEvent.click(screen.getByRole('button', { name: /^Swaps with Tacos/ }))
    await waitFor(() =>
      expect(calls('mealPlan:move')).toEqual([
        expect.objectContaining({ id: 'm1', date: day(2) }),
      ]),
    )
  })

  test('a note typed and left by closing is still saved', () => {
    const { unmount } = show(<MealPlannerPage search={{ meal: 'm1' }} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Note' }), {
      target: { value: 'Late' },
    })
    unmount()
    expect(calls('mealPlan:update')).toEqual([
      expect.objectContaining({ note: 'Late' }),
    ])
  })

  test('removing offers Undo', async () => {
    show(<MealPlannerPage search={{ meal: 'm1' }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Remove from week menu' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }))
    expect(calls('mealPlan:restore')).toEqual([
      expect.objectContaining({ title: 'Pasta', date: day(0) }),
    ])
  })

  test('Escape closes the panel', () => {
    show(<MealPlannerPage search={{ meal: 'm1' }} />)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(state.navigated.at(-1)).toMatchObject({ search: {} })
  })

  test('an unknown meal says Not found, also on its own page', () => {
    show(<RecordPage kind="meal" id="nope" week={undefined} />)
    expect(screen.getByText('Not found')).toBeTruthy()
  })
})

test('Plan my week asks for the days chosen', async () => {
  // Next week, so no day is past.
  const next = addDays(MONDAY, 7)
  state.queries['mealPlan:week'] = week([])
  state.answers['mealPlanDrafts:propose'] = { status: 'ai', count: 6 }
  show(<MealPlannerPage search={{ week: next }} />)
  fireEvent.click(screen.getByRole('button', { name: 'Plan my week' }))
  const dialog = within(screen.getByRole('dialog'))
  fireEvent.click(dialog.getByRole('button', { name: /^Monday/ }))
  fireEvent.click(dialog.getByRole('button', { name: 'Make a plan for 6 days' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(calls('mealPlanDrafts:propose')).toEqual([
    expect.objectContaining({
      weekStart: next,
      dates: [1, 2, 3, 4, 5, 6].map((index) => addDays(next, index)),
      slots: ['dinner'],
    }),
  ])
})

test('a preference saves at once', () => {
  state.queries['mealPreferences:get'] = {
    ...resolveMealPreferences(null, members),
    members,
  }
  show(<MealPreferencesPage />)
  fireEvent.click(screen.getByRole('button', { name: 'Vegetarian' }))
  expect(calls('mealPreferences:setDiet')).toEqual([
    { groupSlug: TEST_GROUP.slug, diet: 'vegetarian', on: true },
  ])
})
