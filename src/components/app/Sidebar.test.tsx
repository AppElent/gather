import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { MobileDock } from './MobileDock'
import { ShellGroupProvider } from './ShellGroup'
import { Sidebar } from './Sidebar'

/**
 * What the shell shows when the address bar names no Group.
 *
 * Settings, Account and the Groups list are deliberately unscoped — Settings
 * and Account are Personal (ADR-0003), and Groups is where you pick a Group, so
 * it cannot require one. Standing on any of them, the URL names no Group.
 *
 * Two different situations hide behind that, and the shell now tells them
 * apart. Someone who has never been in a Group this session has nothing to
 * draw, and gets a sentence saying so — that is what the first block below
 * covers, rendering these surfaces bare, with no shell memory around them.
 * Someone who walked out of a Group to reach `/groups` has one, and the last
 * block covers that: the modules and the dock stay, so stepping out to pick a
 * Group does not blank the shell on the way.
 */

const location = vi.hoisted(() => ({ pathname: '/settings' }))
const me = vi.hoisted(() => ({
  value: { pinnedModuleIds: ['recipes', 'tasks'] } as unknown,
}))
const groups = vi.hoisted(() => ({ value: [] as unknown }))

vi.mock('@tanstack/react-router', () => ({
  useLocation: () => location,
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

vi.mock('convex/react', () => ({
  useQuery: (name: string) =>
    name === 'groups:myGroups' ? groups.value : me.value,
}))

vi.mock('../../../convex/_generated/api', () => ({
  api: { users: { me: 'users:me' }, groups: { myGroups: 'groups:myGroups' } },
}))

beforeEach(() => {
  location.pathname = '/settings'
  me.value = { pinnedModuleIds: ['recipes', 'tasks'] }
  groups.value = [
    { _id: 'g1', name: 'Alice', slug: 'me-alice', isPersonal: true },
  ]
})

describe('the sidebar off any Group route', () => {
  test('says why the modules are missing instead of listing none', () => {
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
   * The footer used to carry a "Group settings" link whose destination changed
   * with the address, directly above a "Settings" link whose destination never
   * did — two meanings of the word in two inches. A Group's settings hang off
   * the Group now: its row on `/groups` opens them. The assertion is kept and
   * inverted rather than deleted, because "no Group settings link here" is the
   * decision, and a deleted test would not notice it being undone.
   */
  test('offers no Group settings link, in or out of a Group', () => {
    render(<Sidebar />)
    expect(screen.queryByRole('link', { name: 'Group settings' })).toBeNull()

    location.pathname = '/g/me-alice/recipes'
    render(<Sidebar />)
    expect(screen.queryByRole('link', { name: 'Group settings' })).toBeNull()
  })

  test('lists the modules again as soon as the address names a Group', () => {
    location.pathname = '/g/me-alice/recipes'
    render(<Sidebar />)

    const nav = screen.getByRole('navigation', { name: 'Primary' })
    expect(nav).toBeDefined()
    expect(screen.getByRole('link', { name: /home/i })).toBeDefined()
  })

  test('and Settings still means yours, wherever you are standing', () => {
    location.pathname = '/g/me-alice/recipes'
    render(<Sidebar />)

    expect(
      screen.getByRole('link', { name: 'Settings' }).getAttribute('href'),
    ).toBe('/settings')
  })

  test('says nothing about preview data any more', () => {
    location.pathname = '/g/me-alice/recipes'
    const { container } = render(<Sidebar />)

    // The footer used to be a card headed "Preview group" promising that group
    // and member details would appear once connected. Home keeps that promise
    // now, with real names on it.
    expect(container.textContent).not.toMatch(/preview/i)
  })
})

describe('the mobile dock with no Group ever visited', () => {
  test('is not there at all, rather than an empty bar', () => {
    const { container } = render(<MobileDock />)

    expect(container.firstChild).toBeNull()
  })

  test('comes back inside a Group', () => {
    location.pathname = '/g/me-alice/recipes'
    render(<MobileDock />)

    expect(
      screen.getByRole('navigation', { name: 'Mobile navigation' }),
    ).toBeDefined()
  })
})

/**
 * Leaving *to* the list of Groups is not leaving your Group.
 *
 * `/groups` sits outside `/g/<slug>`, so the URL genuinely names no Group there
 * — and it must keep doing so, because ADR-0002 gives it the only say in what
 * the app reads and writes. What changes is only what the shell draws: it holds
 * on to the last Group the address named so the way back does not vanish while
 * you are looking for it.
 */
describe('stepping out of a Group and back', () => {
  // A fresh element each time, or React reuses the identical one and never
  // re-reads the pathname the rerender is there to change.
  function renderShell(ui: () => React.ReactNode) {
    // Standing in a Group first is what gives the shell something to remember;
    // the rerender is the navigation to a slugless route.
    location.pathname = '/g/me-alice/recipes'
    const view = render(<ShellGroupProvider>{ui()}</ShellGroupProvider>)
    location.pathname = '/groups'
    view.rerender(<ShellGroupProvider>{ui()}</ShellGroupProvider>)
    return view
  }

  test('the modules stay listed on the way to Groups', () => {
    renderShell(() => <Sidebar />)

    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeDefined()
    expect(screen.queryByText(/pick a group to see its modules/i)).toBeNull()
    expect(
      screen.getByRole('link', { name: /home/i }).getAttribute('href'),
    ).toBe('/g/me-alice')
  })

  test('and the dock stays with them', () => {
    renderShell(() => <MobileDock />)

    expect(
      screen.getByRole('navigation', { name: 'Mobile navigation' }),
    ).toBeDefined()
  })

  test('but nothing claims to be the page you are on', () => {
    const { container } = renderShell(() => <Sidebar />)

    expect(container.querySelector('[aria-current="page"]')).toBeNull()
  })
})
