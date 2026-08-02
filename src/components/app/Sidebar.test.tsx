import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { MobileDock } from './MobileDock'
import { Sidebar } from './Sidebar'

/**
 * What the shell shows when the address bar names no Group.
 *
 * Settings, Account and the Groups list are deliberately unscoped — Settings
 * and Account are Personal (ADR-0003), and Groups is where you pick a Group, so
 * it cannot require one. Standing on any of them, the navigation has nothing to
 * point at. These say what is shown instead, and — the part that is a
 * regression risk rather than a design choice — that a phone with no dock can
 * still reach all three.
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

  test('offers no Group settings, because there is no Group to settle', () => {
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

  test('and offers that Group its own settings, apart from your own', () => {
    location.pathname = '/g/me-alice/recipes'
    render(<Sidebar />)

    expect(
      screen.getByRole('link', { name: 'Group settings' }).getAttribute('href'),
    ).toBe('/g/me-alice/settings')
    // Two words that would otherwise be one meaning two things.
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

describe('the mobile dock off any Group route', () => {
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
