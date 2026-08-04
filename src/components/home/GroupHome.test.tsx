import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { GroupActivityEntry } from '../../../convex/activity'
import { renderWithI18n } from '../../lib/i18n/testing'
import { GroupHome } from './GroupHome'

/**
 * A Group's Home, which has to be worth opening on the very first visit and
 * has to stay honest about which Group it is describing.
 *
 * The test that matters most is the empty one: the closed #10 branch shipped a
 * Home that read "nothing here" for everybody, permanently, and the way that
 * gets shipped again is an empty state nobody asserts anything about. So the
 * empty state is held to naming the Group, naming its Members and saying what
 * to do next — it fails if any of the three quietly goes away.
 */

const members = vi.hoisted(() => ({ value: undefined as unknown }))
const activity = vi.hoisted(() => ({ value: undefined as unknown }))
const queryArgs = vi.hoisted(() => ({
  value: [] as Array<{ name: string; args: unknown }>,
}))

vi.mock('convex/react', () => ({
  useQuery: (name: string, args: unknown) => {
    queryArgs.value = [...queryArgs.value, { name, args }]
    return name === 'groups:members' ? members.value : activity.value
  },
}))

vi.mock('../../../convex/_generated/api', () => ({
  api: {
    groups: { members: 'groups:members' },
    activity: { forGroup: 'activity:forGroup' },
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

const HOUSEHOLD = {
  groupSlug: 'jansen-household',
  groupName: 'Jansen Household',
  isPersonal: false,
}

const MEMBERS = [
  { userId: 'u_alice', name: 'Alice', role: 'admin' },
  { userId: 'u_bob', name: 'Bob', role: 'member' },
]

const entry = (over: Partial<GroupActivityEntry> = {}): GroupActivityEntry => ({
  id: 'r1',
  kind: 'recipe',
  at: Date.now(),
  byName: 'Bob',
  title: 'Roast chicken',
  context: null,
  targetId: 'recipe_1',
  ...over,
})

beforeEach(() => {
  members.value = MEMBERS
  activity.value = []
  queryArgs.value = []
})

describe('the very first visit, before anything has happened', () => {
  test('names the Group, says who is in it, and says what to do next', () => {
    renderWithI18n(<GroupHome {...HOUSEHOLD} />)

    // The Group. Named as a heading, not buried in a sentence.
    expect(
      screen.getByRole('heading', { name: 'Jansen Household', level: 1 }),
    ).toBeDefined()

    // Who is in it — every Member, by name.
    const who = screen.getByRole('region', { name: 'Who is here' })
    expect(within(who).getByText('Alice')).toBeDefined()
    expect(within(who).getByText('Bob')).toBeDefined()

    // What to do next.
    const activityCard = screen.getByRole('region', { name: 'Recent activity' })
    expect(
      within(activityCard).getByText(/nothing has happened in/i).textContent,
    ).toContain('Jansen Household')
    for (const label of ['Recipes', 'Tasks', 'Baby log']) {
      expect(
        within(activityCard).getByRole('link', { name: label }),
      ).toBeDefined()
    }
  })

  test('the starters point into this Group and not at a bare module path', () => {
    renderWithI18n(<GroupHome {...HOUSEHOLD} />)

    const recipes = screen.getByRole('link', { name: 'Recipes' })
    expect(recipes.getAttribute('href')).toBe('/g/jansen-household/recipes')
  })

  test('a Personal group says it is private, and points at Groups to share', () => {
    members.value = [{ userId: 'u_alice', name: 'Alice', role: 'admin' }]
    renderWithI18n(
      <GroupHome
        groupSlug="me-alice"
        groupName="Alice's things"
        isPersonal={true}
      />,
    )

    const who = screen.getByRole('region', { name: 'Who is here' })
    expect(within(who).getByText(/yours alone/i).textContent).toContain(
      "Alice's things",
    )
    // Inviting lives on /groups. The invite code is a capability and Home
    // never shows one.
    expect(
      within(who).getByRole('link', { name: 'Groups' }).getAttribute('href'),
    ).toBe('/groups')
    expect(screen.getByText(/only you will ever see it/i)).toBeDefined()
  })

  test('a shared group says everyone here sees everything', () => {
    renderWithI18n(<GroupHome {...HOUSEHOLD} />)

    const who = screen.getByRole('region', { name: 'Who is here' })
    expect(
      within(who).getByText(/everyone here sees everything/i),
    ).toBeDefined()
    expect(within(who).getByRole('link', { name: 'Groups' })).toBeDefined()
  })

  test('the Members are shown whether or not anything has happened', () => {
    activity.value = [entry()]
    renderWithI18n(<GroupHome {...HOUSEHOLD} />)

    const who = screen.getByRole('region', { name: 'Who is here' })
    expect(within(who).getByText('Alice')).toBeDefined()
    expect(within(who).getByText('Bob')).toBeDefined()
  })
})

describe('the stream', () => {
  test('asks for this Group and no other', () => {
    renderWithI18n(<GroupHome {...HOUSEHOLD} />)

    expect(queryArgs.value).toContainEqual({
      name: 'activity:forGroup',
      args: { groupSlug: 'jansen-household' },
    })
    expect(queryArgs.value).toContainEqual({
      name: 'groups:members',
      args: { slug: 'jansen-household' },
    })
  })

  test('says who did what, and in which module', () => {
    activity.value = [entry()]
    renderWithI18n(<GroupHome {...HOUSEHOLD} />)

    const card = screen.getByRole('region', { name: 'Recent activity' })
    expect(within(card).getByText('Bob')).toBeDefined()
    expect(within(card).getByText(/added the recipe/i)).toBeDefined()
    expect(
      within(card).getByRole('link', { name: 'Roast chicken' }),
    ).toBeDefined()
    expect(within(card).getByText('Recipes')).toBeDefined()
  })

  test('links a recipe to its page inside this Group', () => {
    activity.value = [entry()]
    renderWithI18n(<GroupHome {...HOUSEHOLD} />)

    expect(
      screen.getByRole('link', { name: 'Roast chicken' }).getAttribute('href'),
    ).toBe('/g/jansen-household/recipes/recipe_1')
  })

  test('links a log entry to the child it is about', () => {
    activity.value = [
      entry({
        id: 'e1',
        kind: 'babyEvent',
        title: 'Feeding',
        context: 'Noor',
        targetId: 'baby_1',
        byName: 'Alice',
      }),
    ]
    renderWithI18n(<GroupHome {...HOUSEHOLD} />)

    expect(
      screen.getByRole('link', { name: 'Feeding' }).getAttribute('href'),
    ).toBe('/g/jansen-household/baby/baby_1')
    expect(screen.getByText(/for Noor/)).toBeDefined()
    expect(screen.getByText('Baby log')).toBeDefined()
  })

  test('links a task to the Group’s Tasks page, and names its list', () => {
    activity.value = [
      entry({
        id: 't1',
        kind: 'task',
        title: 'Buy nappies',
        context: 'Shopping',
        targetId: null,
      }),
    ]
    renderWithI18n(<GroupHome {...HOUSEHOLD} />)

    expect(
      screen.getByRole('link', { name: 'Buy nappies' }).getAttribute('href'),
    ).toBe('/g/jansen-household/tasks')
    expect(screen.getByText(/to Shopping/)).toBeDefined()
  })

  test('an entry whose person has gone still says what happened', () => {
    activity.value = [entry({ byName: null })]
    renderWithI18n(<GroupHome {...HOUSEHOLD} />)

    expect(screen.getByText('Someone')).toBeDefined()
    expect(screen.getByRole('link', { name: 'Roast chicken' })).toBeDefined()
  })

  test('renders the stream in the order it arrived, newest first', () => {
    activity.value = [
      entry({ id: 'r2', title: 'Newest' }),
      entry({ id: 'r1', title: 'Oldest' }),
    ]
    renderWithI18n(<GroupHome {...HOUSEHOLD} />)

    const items = screen
      .getByRole('region', { name: 'Recent activity' })
      .querySelectorAll('li')
    expect([...items].map((li) => li.textContent)).toHaveLength(2)
    expect(items[0].textContent).toContain('Newest')
    expect(items[1].textContent).toContain('Oldest')
  })

  test('says it is still loading rather than that nothing has happened', () => {
    activity.value = undefined
    renderWithI18n(<GroupHome {...HOUSEHOLD} />)

    expect(screen.queryByText(/nothing has happened/i)).toBeNull()
  })
})

describe('nothing is stored per person, and nothing is editable', () => {
  test('there is no layout editor on the page', () => {
    activity.value = [entry()]
    renderWithI18n(<GroupHome {...HOUSEHOLD} />)

    // A configurable Home would need at least one control to configure it
    // with. There is none: Home is one owned surface, the same for everybody
    // in the Group.
    expect(screen.queryAllByRole('button')).toEqual([])
    expect(screen.queryAllByRole('checkbox')).toEqual([])
    expect(screen.queryAllByRole('combobox')).toEqual([])
  })

  test('nothing about the page is written back', () => {
    activity.value = [entry()]
    renderWithI18n(<GroupHome {...HOUSEHOLD} />)

    // `useMutation` is not even imported — the mock would throw if it were
    // called, and this asserts the page only ever reads.
    expect(
      queryArgs.value.every(
        ({ name }) => name === 'groups:members' || name === 'activity:forGroup',
      ),
    ).toBe(true)
  })
})

describe('what a phone has to survive', () => {
  // Every name here is one unbroken word on purpose. A long name *with spaces*
  // wraps by itself and proves nothing; the case that broke this page is the
  // one the browser cannot break for you.
  test('a long name and a long title wrap instead of setting a width', () => {
    activity.value = [
      entry({
        title: 'Slowroastedlambshoulderwithanchovyrosemaryandflatbreads',
      }),
    ]
    members.value = [
      {
        userId: 'u_long',
        name: 'Annabelle-Charlotte Van Der Meer-Jansen',
        role: 'admin',
      },
    ]
    renderWithI18n(
      <GroupHome
        groupSlug="jansen-household"
        groupName="Vandenbergenhuishoudenoverdewintermaanden"
        isPersonal={false}
      />,
    )

    // jsdom does no layout, so these are assertions about the two properties
    // that decide whether a long word can overflow — not about the width of
    // anything. Both are needed and neither is enough on its own: the track has
    // to be allowed to shrink, and the word has to be willing to break.
    //
    // `wrap-anywhere` and not `break-words`, which is the trap this page fell
    // into: `overflow-wrap: break-word` breaks the word when it is *drawn* but
    // still reports the unbroken word as its minimum size, so the grid track is
    // already too wide. Only `anywhere` lowers the minimum. The page overflowed
    // a 375px viewport with these tests passing.
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading.className).toContain('wrap-anywhere')
    expect(heading.closest('div')?.className).toContain('minmax(0,1fr)')

    const row = screen
      .getByRole('region', { name: 'Recent activity' })
      .querySelector('li')
    expect(row?.className).toContain('minmax(0,1fr)')
    expect(row?.querySelector('div')?.className).toContain('min-w-0')
    expect(row?.querySelector('p')?.className).toContain('wrap-anywhere')

    const name = screen.getByText('Annabelle-Charlotte Van Der Meer-Jansen')
    expect(name.className).toContain('wrap-anywhere')
  })

  test('the page never lays anything out in a table', () => {
    activity.value = [entry(), entry({ id: 'r2', title: 'Second' })]
    const { container } = renderWithI18n(<GroupHome {...HOUSEHOLD} />)

    // A table is the one layout that cannot be made to shrink below the sum of
    // its columns, which is how a page starts scrolling sideways on a phone.
    expect(container.querySelector('table')).toBeNull()
  })
})
