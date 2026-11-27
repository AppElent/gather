import { fireEvent, screen, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { Locale } from '../../lib/i18n'
import { AccountMenu } from './AccountMenu'
import { GroupSwitcher } from './GroupSwitcher'
import { MobileDock } from './MobileDock'
import { Sidebar } from './Sidebar'
import { renderInGroup } from './testing'
import type { ShellGroup } from './useCurrentGroup'

/**
 * What the shell shows for the Current Group: the desktop sidebar, its account
 * menu and Add, and the phone-width tab bar (APP-638).
 *
 * The Group is ambient (ADR-0031): no address names it, and the shell draws the
 * Current Group's navigation on every page — Settings, Account and the Groups
 * list included. Only somebody with no Current Group at all has nothing to
 * draw, and gets a sentence saying so instead.
 */

const location = vi.hoisted(() => ({ pathname: '/settings' }))
const pins = vi.hoisted(() => ({ value: ['recipes', 'tasks'] as unknown }))
const groups = vi.hoisted(() => ({ value: [] as unknown }))
const clerk = vi.hoisted(() => ({
  session: { id: 'sess_current' },
  signOut: vi.fn(() => Promise.resolve()),
}))

/**
 * The router's `Link`, modelled rather than stubbed.
 *
 * A plain `<a>` would miss the thing that once broke. TanStack's `Link` decides
 * for itself whether it points at the current page — by segment prefix — and
 * when it decides yes it spreads `{ 'data-status': 'active', 'aria-current':
 * 'page' }` *after* the caller's own props, so it wins.
 *
 * This reproduces exactly that: the prefix rule, and the router's props landing
 * last. The shell passes no `activeOptions`, so the tests below hold only while
 * no nav item's address is a prefix of another item's page.
 */
vi.mock('@tanstack/react-router', () => ({
  useLocation: () => location,
  Link: ({
    children,
    to: href,
    search,
    ...rest
  }: {
    children: React.ReactNode
    to: string
    search?: Record<string, unknown>
  }) => {
    const path = location.pathname
    const isActive = path === href || path.startsWith(`${href}/`)
    const query = search ? `?${new URLSearchParams(search as never)}` : ''

    return (
      <a
        href={`${href}${query}`}
        {...rest}
        {...(isActive && { 'data-status': 'active', 'aria-current': 'page' })}
      >
        {children}
      </a>
    )
  },
}))

vi.mock('convex/react', () => ({
  // Pins are asked for per Group since ADR-0005, and not asked for at all when
  // there is no Group to ask about — `'skip'` is Convex's token for that, and
  // the mock honours it so a test cannot pass on pins the app never requested.
  useQuery: (name: string, args: unknown) => {
    if (args === 'skip') return undefined
    if (name === 'groups:myGroups') return groups.value
    if (name === 'users:myPins') return pins.value
    if (name === 'groups:members')
      return [{ name: 'A' }, { name: 'B' }, { name: 'C' }]
    if (name === 'tasks:openCounts')
      return [
        { listId: 'l1', open: 4 },
        { listId: 'l2', open: 12, done: 1, total: 13 },
      ]
    return undefined
  },
}))

vi.mock('../../../convex/_generated/api', () => ({
  api: {
    users: { myPins: 'users:myPins' },
    groups: { myGroups: 'groups:myGroups', members: 'groups:members' },
    tasks: { openCounts: 'tasks:openCounts' },
  },
}))

vi.mock('@clerk/react', () => ({
  useUser: () => ({
    user: {
      fullName: 'Test User',
      primaryEmailAddress: { emailAddress: 'test@example.com' },
    },
  }),
  useClerk: () => clerk,
}))

const noop = () => {}

function sidebar(handlers: Partial<Parameters<typeof Sidebar>[0]> = {}) {
  return (
    <Sidebar
      onOpenPalette={noop}
      onOpenGather={noop}
      onReportIssue={noop}
      {...handlers}
    />
  )
}

/** Rendered with the first of `groups` as the Current Group, or none. */
function render(ui: ReactElement, locale?: Locale) {
  const list = groups.value as ShellGroup[]
  return renderInGroup(ui, { group: list[0] ?? null, groups: list, locale })
}

beforeEach(() => {
  location.pathname = '/settings'
  pins.value = ['recipes', 'tasks']
  groups.value = [{ _id: 'g1', name: 'Alice', slug: 'alice', role: 'admin' }]
  clerk.signOut.mockReset()
})

describe('the sidebar', () => {
  test('says why the modules are missing instead of listing none', () => {
    groups.value = []
    render(sidebar())

    expect(screen.getByText(/pick a group to see its modules/i)).toBeDefined()
    expect(screen.queryByRole('navigation', { name: 'Primary' })).toBeNull()
  })

  test('still reaches Settings, Groups, the account menu and the switcher with no Group', () => {
    groups.value = []
    render(sidebar())

    expect(screen.getByRole('link', { name: 'Settings' })).toBeDefined()
    expect(screen.getByRole('button', { name: /account menu/i })).toBeDefined()
    // Groups hang off the switcher, the way back into a Group.
    fireEvent.click(screen.getByRole('button', { name: /switch group/i }))
    expect(screen.getByRole('link', { name: 'Manage groups' })).toBeDefined()
  })

  test('names the switcher after the Current Group, at every width', () => {
    render(<GroupSwitcher variant="round" />)
    expect(
      screen.getByRole('button', { name: 'Alice, switch group' }),
    ).toBeDefined()
  })

  test('is Start, Add, the pins under Pinned, then All modules', () => {
    render(sidebar())

    const nav = screen.getByRole('navigation', { name: 'Primary' })
    const names = Array.from(nav.querySelectorAll('a, button')).map(
      (el) => el.textContent,
    )
    expect(names).toEqual(['Home', 'Add', 'Recipes', 'Tasks 16', 'All modules'])
    const pinned = within(nav).getByRole('group', { name: 'Pinned' })
    expect(within(pinned).getAllByRole('link')).toHaveLength(2)
  })

  test('draws each pin’s tile in its group colour, and the shell’s own rows quiet', () => {
    render(sidebar())

    const tileOf = (name: string) =>
      screen.getByRole('link', { name }).querySelector('[data-tile]')
    expect(tileOf('Recipes')?.getAttribute('data-group')).toBe('kitchen')
    expect(tileOf('Tasks 16')?.getAttribute('data-group')).toBe('home')
    expect(tileOf('Home')?.getAttribute('data-group')).toBeNull()
    expect(tileOf('All modules')?.getAttribute('data-group')).toBeNull()
    expect(tileOf('Settings')?.getAttribute('data-group')).toBeNull()
  })

  test('counts a pin’s open items where its Module has a count', () => {
    render(sidebar())

    // 4 + 12 open over the Group's two local lists; Recipes counts nothing.
    expect(screen.getByRole('link', { name: 'Tasks 16' })).toBeDefined()
    expect(screen.getByRole('link', { name: 'Recipes' })).toBeDefined()
  })

  test('puts the current item on a surface pill, never a group colour', () => {
    location.pathname = '/recipes'
    render(sidebar())

    const current = screen.getByRole('link', { name: 'Recipes' })
    expect(current.getAttribute('aria-current')).toBe('page')
    expect(current.className).toContain('bg-[var(--surface)]')
    expect(current.className).not.toMatch(/kitchen|accent|-fill/)
  })

  test('opens the jump-to palette from its search field', () => {
    const onOpenPalette = vi.fn()
    render(sidebar({ onOpenPalette }))

    fireEvent.click(screen.getByRole('button', { name: /search gather/i }))
    expect(onOpenPalette).toHaveBeenCalledOnce()
  })

  test('names the Group and how many are in it', () => {
    render(sidebar())

    const switcher = screen.getByRole('button', { name: /switch group/i })
    expect(switcher.textContent).toContain('Alice')
    expect(switcher.textContent).toContain('3 members')
  })

  /**
   * A Module's name reaches the sidebar through `navItems` and `moduleText`,
   * neither of which is a component, so nothing else here would notice if the
   * registry started handing back English again.
   */
  test('speaks the reader’s language', () => {
    location.pathname = '/recipes'
    render(sidebar(), 'nl')

    const nav = screen.getByRole('navigation', { name: 'Hoofdnavigatie' })
    expect(within(nav).getByRole('link', { name: 'Start' })).toBeDefined()
    expect(within(nav).getByRole('button', { name: 'Toevoegen' })).toBeDefined()
    expect(within(nav).getByRole('group', { name: 'Vastgezet' })).toBeDefined()
    expect(within(nav).getByRole('link', { name: 'Recepten' })).toBeDefined()
    expect(within(nav).getByRole('link', { name: 'Alle modules' })).toBeDefined()
    expect(screen.getByRole('button', { name: /zoeken in gather/i })).toBeDefined()
    expect(screen.getByRole('link', { name: 'Instellingen' })).toBeDefined()
    expect(screen.getByRole('button', { name: /accountmenu/i })).toBeDefined()
  })

  /**
   * A "Group settings" link directly above "Settings" would be two meanings of
   * the word in two inches. A Group's settings hang off the Group: its row on
   * `/groups` opens them.
   */
  test('offers no Group settings link, in or out of a Group', () => {
    render(sidebar())
    expect(screen.queryByRole('link', { name: 'Group settings' })).toBeNull()

    groups.value = []
    render(sidebar())
    expect(screen.queryByRole('link', { name: 'Group settings' })).toBeNull()
  })

  test('and Settings still means yours, lit only on it', () => {
    location.pathname = '/recipes'
    render(sidebar())
    const settings = screen.getByRole('link', { name: 'Settings' })
    expect(settings.getAttribute('href')).toBe('/settings')
    expect(settings.getAttribute('aria-current')).toBeNull()
  })
})

describe('the account menu', () => {
  function open(handlers: Partial<Parameters<typeof Sidebar>[0]> = {}) {
    render(sidebar(handlers))
    const button = screen.getByRole('button', { name: /account menu/i })
    expect(button.getAttribute('aria-haspopup')).toBe('menu')
    fireEvent.click(button)
    return { button, menu: screen.getByRole('menu', { name: /account menu/i }) }
  }

  test('carries what the topbar did: account, language, Ask Gather, report, sign out', () => {
    const { button, menu } = open()

    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual([
      'Account',
      'Switch to Nederlands',
      'Ask Gather',
      'Report a problem',
      'Sign out',
    ])
  })

  test('is operable from the keyboard and gives focus back on Escape', () => {
    const { button, menu } = open()
    const items = within(menu).getAllByRole('menuitem')

    expect(document.activeElement).toBe(items[0])
    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[1])
    fireEvent.keyDown(menu, { key: 'End' })
    expect(document.activeElement).toBe(items[4])
    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[0])
    fireEvent.keyDown(menu, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(items[4])

    fireEvent.keyDown(menu, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(button)
  })

  test('opens from the keyboard on the last item with ArrowUp', () => {
    render(sidebar())
    fireEvent.keyDown(screen.getByRole('button', { name: /account menu/i }), {
      key: 'ArrowUp',
    })
    expect(document.activeElement?.textContent).toBe('Sign out')
  })

  test('reports a problem, closing first', () => {
    const onReportIssue = vi.fn()
    const { button } = open({ onReportIssue })

    fireEvent.click(screen.getByRole('menuitem', { name: 'Report a problem' }))
    expect(onReportIssue).toHaveBeenCalledOnce()
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(button)
  })

  test('switches the language', () => {
    open()
    fireEvent.click(
      screen.getByRole('menuitem', { name: 'Switch to Nederlands' }),
    )
    expect(screen.getByRole('link', { name: 'Instellingen' })).toBeDefined()
  })

  test('names the sidebar button after what it shows: your name', () => {
    render(sidebar())
    expect(
      screen.getByRole('button', { name: 'Test User, account menu' }),
    ).toBeDefined()
  })

  /**
   * At phone width Settings is otherwise only a tab, and the tab bar is not
   * drawn without a Current Group — yet Settings is where somebody new loads
   * the Sample household. The round account button carries it at every width.
   */
  test('reaches Settings from the round button with no Current Group', () => {
    groups.value = []
    render(
      <AccountMenu variant="round" onOpenGather={noop} onReportIssue={noop} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }))
    expect(
      screen.getByRole('menuitem', { name: 'Settings' }).getAttribute('href'),
    ).toBe('/settings')
  })

  test('signs out of the current session only (APP-872)', () => {
    open()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }))
    expect(clerk.signOut).toHaveBeenCalledExactlyOnceWith({
      sessionId: 'sess_current',
    })
  })
})

describe('Add', () => {
  test('offers a create action per pinned Module, going to its own flow', () => {
    render(sidebar())
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    const menu = screen.getByRole('menu', { name: 'Add' })

    const items = within(menu).getAllByRole('menuitem')
    expect(items.map((item) => item.textContent)).toEqual([
      'Add recipeRecipes',
      'Add listTasks',
    ])
    expect(items.map((item) => item.getAttribute('href'))).toEqual([
      '/recipes/new',
      '/tasks?new=true',
    ])
    expect(items[0]?.querySelector('[data-tile]')?.getAttribute('data-group')).toBe(
      'kitchen',
    )
  })

  /**
   * A phone held sideways is 375 px tall; with the bar at the bottom there are
   * a few hundred pixels above Add for however many pins. The menu is held to
   * that room and scrolls inside it rather than running off the top.
   */
  test('fits above the tab bar however many pins, and scrolls', () => {
    pins.value = ['recipes', 'tasks', 'baby-log', 'loyalty-cards', 'cheeses', 'wines', 'beers']
    window.innerHeight = 375
    render(<MobileDock onOpenPalette={noop} />)
    const button = screen.getByRole('button', { name: 'Add' })
    button.getBoundingClientRect = () => ({ top: 290, bottom: 340 }) as DOMRect
    fireEvent.click(button)

    const menu = screen.getByRole('menu', { name: 'Add' })
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(7)
    expect(menu.style.maxHeight).toBe('258px')
    expect(menu.className).toContain('overflow-y-auto')
  })

  test('holds a menu that opens downwards to the room below it', () => {
    window.innerHeight = 800
    render(sidebar())
    const button = screen.getByRole('button', { name: 'Add' })
    button.getBoundingClientRect = () => ({ top: 150, bottom: 194 }) as DOMRect
    fireEvent.click(button)
    expect(screen.getByRole('menu', { name: 'Add' }).style.maxHeight).toBe(
      '574px',
    )
  })

  test('sends somebody with nothing to add to All modules', () => {
    pins.value = ['energy']
    render(sidebar())
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    const menu = screen.getByRole('menu', { name: 'Add' })

    expect(within(menu).getByText(/pin a module/i)).toBeDefined()
    expect(
      within(menu)
        .getByRole('menuitem', { name: /all modules/i })
        .getAttribute('href'),
    ).toBe('/all')
  })
})

/**
 * Exactly one thing is the page you are on.
 *
 * The router marks a link active on a prefix by default, and the bar colours
 * itself from `aria-current`; a screen reader reads the attribute. Each
 * surface must name a single item, and the router must not add a second.
 */
describe('which item claims to be the page you are on', () => {
  const tabBar = () => <MobileDock onOpenPalette={noop} />
  const current = () =>
    screen
      .queryAllByRole('link', { current: 'page' })
      .map((el) => el.textContent)

  test('the sidebar lights the Module, not Home above it, attribute and all', () => {
    location.pathname = '/tasks'
    render(sidebar())
    expect(current()).toEqual(['Tasks 16'])
  })

  test('a page of a Module nobody pinned lights All modules alone', () => {
    pins.value = ['tasks']
    location.pathname = '/recipes/rec_1'
    render(sidebar())
    expect(current()).toEqual(['All modules'])
  })

  test('the tab bar puts a Module page under All, as the phone does', () => {
    location.pathname = '/tasks'
    render(tabBar())
    expect(current()).toEqual(['All'])
  })

  test('Home is lit on Home, and only there', () => {
    location.pathname = '/home'
    render(tabBar())
    expect(current()).toEqual(['Home'])
  })

  test('Settings is a tab of its own', () => {
    location.pathname = '/settings'
    render(tabBar())
    expect(current()).toEqual(['Settings'])
  })

  test('a page that is no tab lights none', () => {
    location.pathname = '/groups'
    render(tabBar())
    expect(current()).toEqual([])
  })
})

describe('the phone-width tab bar', () => {
  test('is the phone’s destinations, with Search apart', () => {
    const onOpenPalette = vi.fn()
    location.pathname = '/recipes'
    render(<MobileDock onOpenPalette={onOpenPalette} />)

    const nav = screen.getByRole('navigation', { name: 'Tabs' })
    expect(
      Array.from(nav.querySelectorAll('a, button')).map(
        (el) => el.textContent || el.getAttribute('aria-label'),
      ),
    ).toEqual(['Home', 'Add', 'Settings', 'All', 'Search'])

    fireEvent.click(within(nav).getByRole('button', { name: 'Search' }))
    expect(onOpenPalette).toHaveBeenCalledOnce()
  })

  test('opens Add as a menu', () => {
    render(<MobileDock onOpenPalette={noop} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(screen.getByRole('menu', { name: 'Add' })).toBeDefined()
  })

  test('is not there at all with no Current Group, rather than an empty bar', () => {
    groups.value = []
    const { container } = render(<MobileDock onOpenPalette={noop} />)
    expect(container.firstChild).toBeNull()
  })

  test('stays on the list of Groups, where the Group is still current', () => {
    location.pathname = '/groups'
    render(<MobileDock onOpenPalette={noop} />)
    expect(screen.getByRole('navigation', { name: 'Tabs' })).toBeDefined()
  })
})

/**
 * Going to the list of Groups is not leaving your Group.
 *
 * `/groups` belongs to no Group, but the Current Group is still the Current
 * Group there (ADR-0031), so the way back stays drawn. Which item is *active*
 * is still decided against the real pathname: standing on `/groups`
 * highlights no Module.
 */
describe('on the list of Groups', () => {
  beforeEach(() => {
    location.pathname = '/groups'
  })

  test('the modules stay listed', () => {
    render(sidebar())

    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeDefined()
    expect(screen.queryByText(/pick a group to see its modules/i)).toBeNull()
    expect(
      screen.getByRole('link', { name: 'Home' }).getAttribute('href'),
    ).toBe('/home')
  })

  test('but no Module claims to be the page you are on', () => {
    render(sidebar())

    const modules = screen.getByRole('navigation', { name: 'Primary' })
    expect(modules.querySelector('[aria-current="page"]')).toBeNull()
  })
})
