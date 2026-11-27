import { todayIn } from '@gather/core/civil-date'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { renderInGroup } from '../app/testing'
import { CalendarEventPage } from './CalendarNestedPages'
import { CalendarPage } from './CalendarPage'

const state = vi.hoisted(() => ({
  calls: [] as [string, Record<string, unknown>][],
  refuse: {} as Record<string, unknown>,
  navigated: [] as { to: string; search?: unknown; params?: unknown }[],
  desktop: true,
  preferences: {} as Record<string, unknown>,
  calendars: [] as Record<string, unknown>[],
  events: [] as Record<string, unknown>[],
  pages: new Map<string, unknown>(),
}))

vi.mock('../../../convex/_generated/api', () => {
  const module = (name: string) =>
    new Proxy({}, { get: (_, key) => `${name}:${String(key)}` })
  return { api: new Proxy({}, { get: (_, key) => module(String(key)) }) }
})

vi.mock('convex/react', () => {
  const eventById = (id: unknown) =>
    state.events.find((event) => event.id === id) ?? null
  return {
    useQuery: (name: string) =>
      name === 'calendar:preferences'
        ? state.preferences
        : name === "groups:members" ? MEMBERS : undefined,
    useQueries: (queries: { event?: { args: { id: string } } }) =>
      queries.event ? { event: eventById(queries.event.args.id) } : {},
    usePaginatedQuery: (
      name: string,
      args: { calendarId?: string; from?: string; toExclusive?: string },
    ) => {
      const key = name + JSON.stringify(args)
      const known = state.pages.get(key)
      if (known) return known
      const results =
        name === 'calendar:listCalendars'
          ? state.calendars
          : state.events.filter(
              (event) =>
                event.calendarId === args.calendarId &&
                String(event.date) >= String(args.from) &&
                String(event.date) < String(args.toExclusive),
            )
      const page = { results, status: 'Exhausted', loadMore: () => {} }
      state.pages.set(key, page)
      return page
    },
    useMutation: (name: string) => async (args: Record<string, unknown>) => {
      state.calls.push([name, args])
      if (state.refuse[name]) throw state.refuse[name]
      return name === 'calendar:updateEvent'
        ? { id: args.id, revision: 1 }
        : 'new-id'
    },
  }
})

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => async (to: (typeof state.navigated)[number]) => {
    state.navigated.push(to)
  },
  Link: ({
    children,
    to,
    params,
    search,
    onClick: _onClick,
    ...rest
  }: {
    children: ReactNode
    to: string
    params?: Record<string, string>
    search?: Record<string, string>
    onClick?: unknown
  }) => (
    <a
      {...rest}
      href={`${to.replace(/\$(\w+)/g, (_, key) => params?.[key] ?? '')}${search ? `?${new URLSearchParams(search)}` : ''}`}
    >
      {children}
    </a>
  ),
}))

const MEMBERS = [
  { userId: 'u1', name: 'Nora' },
  { userId: 'u2', name: 'Sam' },
]
const DAY = '2026-11-24'
const event = (id: string, title: string, more: object = {}) => ({
  id,
  _id: id,
  calendarId: 'family',
  calendarName: 'Family',
  color: 'home',
  title,
  date: DAY,
  allDay: false,
  startMinutes: 510,
  endMinutes: 540,
  assigneeIds: [],
  location: '',
  notes: '',
  revision: 3,
  ...more,
})

beforeEach(() => {
  localStorage.clear()
  state.calls = []
  state.refuse = {}
  state.navigated = []
  state.desktop = true
  state.pages = new Map()
  state.preferences = { view: 'week', hiddenCalendarIds: [], peopleFilter: null }
  state.calendars = [
    { _id: 'family', name: 'Family', color: 'home', source: 'local' },
    { _id: 'school', name: 'School', color: 'tasting', source: 'ical' },
  ]
  state.events = [
    event('e1', 'Doctor', { assigneeIds: ['u1', 'left'] }),
    event('e2', 'Lunch', { startMinutes: 720, endMinutes: 780 }),
    event('e3', 'Parents’ evening', {
      calendarId: 'school',
      startMinutes: 1170,
      endMinutes: 1200,
    }),
  ]
  window.matchMedia = ((query: string) => ({
    matches: state.desktop,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
})

const calls = (name: string) =>
  state.calls.filter(([called]) => called === name).map(([, args]) => args)
const panel = () => screen.getByRole('complementary')
const press = (key: string, target: Element = document.body) =>
  fireEvent.keyDown(target, { key })
const lastSearch = () => state.navigated.at(-1)?.search

describe('the views', () => {
  test('the month shows two events and how many more', () => {
    renderInGroup(<CalendarPage day={DAY} />)
    const cell = screen.getByRole('button', {
      name: 'Tuesday, November 24, 3 events',
    })
    expect(cell).toHaveAttribute('aria-pressed', 'true')
    expect(cell).toHaveTextContent('DoctorLunch+1 more')
    expect(cell).not.toHaveTextContent('Parents')
    fireEvent.click(
      screen.getByRole('button', { name: 'Wednesday, November 25' }),
    )
    expect(lastSearch()).toEqual({ day: '2026-11-25' })
  })

  test('desktop opens in Month, a phone in Agenda; the choice is kept', () => {
    const view = (name: string) => screen.getByRole('button', { name })
    const first = renderInGroup(<CalendarPage day={DAY} />)
    expect(view('Month')).toHaveAttribute('aria-pressed', 'true')
    first.unmount()
    state.desktop = false
    const second = renderInGroup(<CalendarPage day={DAY} />)
    expect(view('Agenda')).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(view('Week'))
    second.unmount()
    renderInGroup(<CalendarPage day={DAY} />)
    expect(view('Week')).toHaveAttribute('aria-pressed', 'true')
  })

  test('the week has seven days, each with its events by time', () => {
    localStorage.setItem('gather:calendar-view', 'week')
    renderInGroup(<CalendarPage day={DAY} />)
    const days = screen
      .getAllByRole('region')
      .filter((region) => region.closest('[data-week]'))
    expect(days).toHaveLength(7)
    expect(
      within(days[1])
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual([
      '08:30Doctor',
      '12:00Lunch',
      '19:30Parents’ evening',
    ])
    expect(screen.getByTestId('period')).toHaveTextContent('Nov 23 – 29, 2026')
  })

  test('next in the agenda starts at the next month', () => {
    localStorage.setItem('gather:calendar-view', 'agenda')
    const { rerender } = renderInGroup(<CalendarPage day={DAY} />)
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }))
    expect(lastSearch()).toEqual({ day: '2026-12-01' })
    rerender(<CalendarPage day="2026-12-01" />)
    expect(screen.getByTestId('period')).toHaveTextContent('December 2026')
  })

  test('below lg a day and an event go to pages of their own', () => {
    state.desktop = false
    localStorage.setItem('gather:calendar-view', 'month')
    const first = renderInGroup(<CalendarPage day={DAY} />)
    fireEvent.click(screen.getByRole('button', { name: /November 24/ }))
    expect(state.navigated.at(-1)).toMatchObject({
      to: '/calendar/day/$date',
      params: { date: DAY },
    })
    first.unmount()
    localStorage.setItem('gather:calendar-view', 'agenda')
    renderInGroup(<CalendarPage day={DAY} />)
    expect(
      screen.getAllByRole('link', { name: /^Doctor/ })[0],
    ).toHaveAttribute('href', '/calendar/event/e1')
  })
})

describe('the filters', () => {
  test('a chip hides and shows a calendar for this Member', async () => {
    state.preferences = { ...state.preferences, hiddenCalendarIds: ['school'] }
    renderInGroup(<CalendarPage day={DAY} />)
    expect(within(panel()).getAllByRole('link')).toHaveLength(2)
    const chips = screen.getByRole('group', { name: 'Show calendars' })
    const school = within(chips).getByRole('button', { name: 'School' })
    expect(school).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(school)
    fireEvent.click(within(chips).getByRole('button', { name: 'Family' }))
    expect(calls('calendar:setCalendarVisibility')).toEqual([
      { groupSlug: 'jansen-household', calendarId: 'school', visible: true },
      { groupSlug: 'jansen-household', calendarId: 'family', visible: false },
    ])
  })

  test('the people filter set on the phone applies and can be changed', () => {
    state.preferences = {
      ...state.preferences,
      peopleFilter: { userIds: ['u1'], includeUnassigned: false },
    }
    renderInGroup(<CalendarPage day={DAY} />)
    expect(
      within(panel())
        .getAllByRole('link')
        .map((link) => link.dataset.event),
    ).toEqual(['e1'])
    fireEvent.click(screen.getByRole('button', { name: 'Nora' }))
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Everyone' }))
    expect(calls('calendar:setPreferences')).toEqual([
      { groupSlug: 'jansen-household', peopleFilter: null },
    ])
  })
})

describe('an event', () => {
  test('opens in the panel with who, and goes back to its day', () => {
    renderInGroup(<CalendarPage day={DAY} event="e1" />)
    expect(
      within(panel()).getByRole('heading', { name: 'Doctor' }),
    ).toBeInTheDocument()
    expect(within(panel()).getByText('Nora, Former member')).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', { name: 'Back to Tuesday, November 24' }),
    )
    expect(lastSearch()).toEqual({ day: DAY })
  })

  test('opened without a day goes back to its own day', () => {
    renderInGroup(<CalendarPage event="e1" />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Back to Tuesday, November 24' }),
    )
    expect(lastSearch()).toEqual({ day: DAY })
  })

  test('from a subscribed calendar is read-only and says so', () => {
    renderInGroup(<CalendarPage day={DAY} event="e3" />)
    expect(within(panel()).getByText(/^Read-only/)).toBeInTheDocument()
    expect(within(panel()).queryByRole('button', { name: 'Edit' })).toBeNull()
    expect(
      within(panel()).queryByRole('button', { name: 'Delete event' }),
    ).toBeNull()
  })

  test('a subscribed calendar takes no new events', () => {
    renderInGroup(<CalendarPage day={DAY} />)
    press('n')
    const choices = within(
      screen.getByRole('combobox', { name: 'Calendar' }),
    ).getAllByRole('option')
    expect(choices.map((option) => option.textContent)).toEqual(['Family'])
  })

  test('that is gone says so', () => {
    renderInGroup(<CalendarPage day={DAY} event="nope" />)
    expect(
      screen.getByText('This event is no longer here'),
    ).toBeInTheDocument()
  })

  test('is deleted after asking', async () => {
    renderInGroup(<CalendarPage day={DAY} event="e1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete event' }))
    const ask = screen.getByRole('dialog', { name: 'Delete “Doctor”?' })
    expect(calls('calendar:removeCalendarEvent')).toEqual([])
    fireEvent.click(within(ask).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(lastSearch()).toEqual({ day: DAY }))
    expect(calls('calendar:removeCalendarEvent')).toEqual([
      { groupSlug: 'jansen-household', id: 'e1' },
    ])
  })

  test('has a page of its own with a trail', () => {
    renderInGroup(<CalendarEventPage eventId="e1" />)
    expect(
      screen.getByRole('navigation', { name: 'Breadcrumb' }),
    ).toHaveTextContent('CalendarTuesday, November 24Doctor')
  })
})

describe('the dialog', () => {
  const type = (name: string, value: string) =>
    fireEvent.change(screen.getByLabelText(name), { target: { value } })
  const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save' }))

  test('adds an event once, with a key, on the selected day', async () => {
    renderInGroup(<CalendarPage day={DAY} />)
    fireEvent.click(screen.getByRole('button', { name: 'Event on this day' }))
    save()
    expect(screen.getByText('Add a title.')).toBeInTheDocument()
    type('Title', ' Swimming ')
    fireEvent.click(screen.getByLabelText('All-day'))
    type('Start time', '10:15')
    fireEvent.click(screen.getByRole('button', { name: 'Sam' }))
    const button = screen.getByRole('button', { name: 'Save' })
    fireEvent.click(button)
    fireEvent.click(button)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(calls('calendar:addCalendarEvent')).toEqual([
      {
        groupSlug: 'jansen-household',
        calendarId: 'family',
        title: 'Swimming',
        date: DAY,
        allDay: false,
        startMinutes: 615,
        endMinutes: 675,
        assigneeIds: ['u2'],
        location: undefined,
        notes: undefined,
        idempotencyKey: expect.any(String),
      },
    ])
    expect(lastSearch()).toEqual({ day: DAY })
  })

  test('edits against the revision that was read', async () => {
    renderInGroup(<CalendarPage day={DAY} event="e2" />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    type('Title', 'Late lunch')
    type('Date', '2026-11-25')
    save()
    await waitFor(() =>
      expect(lastSearch()).toEqual({ day: '2026-11-25', event: 'e2' }),
    )
    expect(calls('calendar:updateEvent')[0]).toMatchObject({
      id: 'e2',
      expectedRevision: 3,
      title: 'Late lunch',
      date: '2026-11-25',
      location: null,
      notes: null,
    })
  })

  test('a conflict keeps the words; saving again replaces', async () => {
    const { ConvexError } = await import('convex/values')
    renderInGroup(<CalendarPage day={DAY} event="e2" />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    type('Title', 'Mine')
    state.refuse['calendar:updateEvent'] = new ConvexError({
      kind: 'calendar:conflict',
    })
    state.events = state.events.map((each) =>
      each.id === 'e2' ? { ...each, title: 'Theirs', revision: 7 } : each,
    )
    save()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Save again to replace',
    )
    expect(screen.getByLabelText('Title')).toHaveValue('Mine')
    state.refuse = {}
    save()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(
      calls('calendar:updateEvent').map((args) => args.expectedRevision),
    ).toEqual([3, 7])
  })

  test('closing with changes asks; without, it closes', () => {
    renderInGroup(<CalendarPage day={DAY} />)
    press('n')
    press('Escape')
    expect(screen.queryByRole('dialog')).toBeNull()
    press('n')
    type('Title', 'Half')
    press('Escape')
    const ask = screen.getByRole('dialog', {
      name: 'You have unsaved changes.',
    })
    fireEvent.click(within(ask).getByRole('button', { name: 'Cancel' }))
    expect(screen.getByLabelText('Title')).toHaveValue('Half')
  })

  test('without a calendar, adding one comes first', () => {
    state.calendars = []
    renderInGroup(<CalendarPage day={DAY} startCreating />)
    expect(
      screen.getByRole('dialog', { name: 'Calendars' }),
    ).toBeInTheDocument()
  })
})

describe('the keyboard', () => {
  test('arrows move between days, t is today', () => {
    renderInGroup(<CalendarPage day={DAY} />)
    for (const [key, day] of [
      ['ArrowRight', '2026-11-25'],
      ['ArrowLeft', '2026-11-23'],
      ['ArrowDown', '2026-12-01'],
      ['ArrowUp', '2026-11-17'],
      ['t', todayIn(undefined)],
    ]) {
      press(key)
      expect(lastSearch()).toEqual({ day })
    }
  })

  test('n adds an event; nothing happens in a field or a dialog', () => {
    renderInGroup(<CalendarPage day={DAY} />)
    press('n')
    const title = screen.getByLabelText('Title')
    press('ArrowRight', title)
    press('t', title)
    press('ArrowRight')
    expect(state.navigated).toEqual([])
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
  })

  test('Escape closes the open event', () => {
    renderInGroup(<CalendarPage day={DAY} event="e1" />)
    press('Escape', within(panel()).getByRole('button', { name: 'Edit' }))
    expect(lastSearch()).toEqual({ day: DAY })
  })
})
