import { screen, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { Locale } from '../../lib/i18n'
import { MobileDock } from './MobileDock'
import { Sidebar } from './Sidebar'
import { renderInGroup } from './testing'
import type { ShellGroup } from './useCurrentGroup'

/**
 * What the shell shows for the Current Group.
 *
 * The Group is ambient (ADR-0031): no address names it, and the shell draws the
 * Current Group's navigation on every page — Settings, Account and the Groups
 * list included. Only somebody with no Current Group at all has nothing to
 * draw, and gets a sentence saying so instead.
 */

const location = vi.hoisted(() => ({ pathname: '/settings' }))
const pins = vi.hoisted(() => ({ value: ['recipes', 'tasks'] as unknown }))
const groups = vi.hoisted(() => ({ value: [] as unknown }))

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
  Link: ({ children, to: href, ...rest }: { children: React.ReactNode; to: string }) => {
    const path = location.pathname
    const isActive = path === href || path.startsWith(`${href}/`)

    return (
      <a
        href={href}
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
    if (name === 'groups:myGroups') return groups.value
    if (name === 'users:myPins') return args === 'skip' ? undefined : pins.value
    return undefined
  },
}))

vi.mock('../../../convex/_generated/api', () => ({
  api: {
    users: { myPins: 'users:myPins' },
    groups: { myGroups: 'groups:myGroups' },
  },
}))

/** Rendered with the first of `groups` as the Current Group, or none. */
function render(ui: ReactElement, locale?: Locale) {
  const list = groups.value as ShellGroup[]
  return renderInGroup(ui, { group: list[0] ?? null, groups: list, locale })
}

beforeEach(() => {
  location.pathname = '/settings'
  pins.value = ['recipes', 'tasks']
  groups.value = [{ _id: 'g1', name: 'Alice', slug: 'alice', role: 'admin' }]
})

describe('the sidebar', () => {
  test('says why the modules are missing instead of listing none', () => {
    groups.value = []
    render(<Sidebar />)

    expect(screen.getByText(/pick a group to see its modules/i)).toBeDefined()
    expect(screen.queryByRole('navigation', { name: 'Primary' })).toBeNull()
  })

  test('still reaches the pages that do not need a Group', () => {
    render(<Sidebar variant="drawer" />)

    expect(screen.getByRole('link', { name: 'Groups' })).toBeDefined()
    expect(screen.getByRole('link', { name: 'Settings' })).toBeDefined()
    // The way back into a Group, on the phone's drawer as on the desktop.
    expect(screen.getByRole('button', { name: /switch group/i })).toBeDefined()
  })

  /**
   * A "Group settings" link directly above "Settings" would be two meanings of
   * the word in two inches. A Group's settings hang off the Group: its row on
   * `/groups` opens them.
   */
  test('offers no Group settings link, in or out of a Group', () => {
    render(<Sidebar />)
    expect(screen.queryByRole('link', { name: 'Group settings' })).toBeNull()

    groups.value = []
    render(<Sidebar />)
    expect(screen.queryByRole('link', { name: 'Group settings' })).toBeNull()
  })

  test('lists the modules on a page that is not a Module', () => {
    render(<Sidebar />)

    const nav = screen.getByRole('navigation', { name: 'Primary' })
    expect(nav).toBeDefined()
    expect(screen.getByRole('link', { name: /home/i })).toBeDefined()
  })

  /**
   * A Module's name reaches the sidebar through `navItems` and `moduleText`,
   * neither of which is a component, so nothing else here would notice if the
   * registry started handing back English again.
   */
  test('names the modules in the reader’s language', () => {
    location.pathname = '/recipes'
    render(<Sidebar />, 'nl')

    const nav = screen.getByRole('navigation', { name: 'Hoofdnavigatie' })
    expect(within(nav).getByRole('link', { name: 'Recepten' })).toBeDefined()
    expect(within(nav).getByRole('link', { name: 'Taken' })).toBeDefined()
    expect(screen.getByRole('link', { name: 'Instellingen' })).toBeDefined()
  })

  test('and Settings still means yours, wherever you are standing', () => {
    location.pathname = '/recipes'
    render(<Sidebar />)

    expect(
      screen.getByRole('link', { name: 'Settings' }).getAttribute('href'),
    ).toBe('/settings')
  })
})

/**
 * Exactly one thing is the page you are on.
 *
 * The router marks a link active on a prefix by default, and the dock colours
 * itself from `aria-current`; the sidebar colours itself from `activeId`, but a
 * screen reader reads the attribute. Both must name the same single item.
 */
describe('which item claims to be the page you are on', () => {
  test('the dock lights the Module, not Home above it', () => {
    location.pathname = '/tasks'
    render(<MobileDock />)

    const current = screen.getAllByRole('link', { current: 'page' })
    expect(current.map((el) => el.textContent)).toEqual(['Tasks'])
  })

  test('the sidebar agrees, attribute and all', () => {
    location.pathname = '/tasks'
    render(<Sidebar />)

    const current = screen.getAllByRole('link', { current: 'page' })
    expect(current.map((el) => el.textContent)).toEqual(['Tasks'])
  })

  test('a Module page below its index still belongs to that Module', () => {
    // `/recipes/<id>` is Recipes, and the router's prefix rule agrees with
    // `activeNavItemId` about it.
    location.pathname = '/recipes/rec_1'
    render(<MobileDock />)

    const current = screen.getAllByRole('link', { current: 'page' })
    expect(current.map((el) => el.textContent)).toEqual(['Recipes'])
  })

  test('a page of a Module nobody pinned lights All alone', () => {
    pins.value = ['tasks']
    location.pathname = '/recipes/rec_1'
    render(<Sidebar />)

    const current = screen.getAllByRole('link', { current: 'page' })
    expect(current.map((el) => el.textContent)).toEqual(['All'])
  })

  test('Home is lit on Home, and only there', () => {
    location.pathname = '/home'
    render(<MobileDock />)

    const current = screen.getAllByRole('link', { current: 'page' })
    expect(current.map((el) => el.textContent)).toEqual(['Home'])
  })
})

describe('the mobile dock with no Current Group', () => {
  test('is not there at all, rather than an empty bar', () => {
    groups.value = []
    const { container } = render(<MobileDock />)

    expect(container.firstChild).toBeNull()
  })

  test('comes back with one', () => {
    location.pathname = '/recipes'
    render(<MobileDock />)

    expect(
      screen.getByRole('navigation', { name: 'Mobile navigation' }),
    ).toBeDefined()
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
    render(<Sidebar />)

    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeDefined()
    expect(screen.queryByText(/pick a group to see its modules/i)).toBeNull()
    expect(
      screen.getByRole('link', { name: /home/i }).getAttribute('href'),
    ).toBe('/home')
  })

  test('and the dock stays with them', () => {
    render(<MobileDock />)

    expect(
      screen.getByRole('navigation', { name: 'Mobile navigation' }),
    ).toBeDefined()
  })

  test('but no Module claims to be the page you are on', () => {
    render(<Sidebar />)

    // The footer's own "Groups" link is a different matter — that one really is
    // the page. It is the Module list that must not pretend you are elsewhere.
    const modules = screen.getByRole('navigation', { name: 'Primary' })
    expect(modules.querySelector('[aria-current="page"]')).toBeNull()
  })
})
