import { screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { renderWithI18n } from '../../lib/i18n/testing'
import { AppShell } from './AppShell'
import { useRequiredCurrentGroup } from './useCurrentGroup'

/**
 * A Group page reads its Group with `useRequiredCurrentGroup`, which throws
 * without one, so the shell is what keeps it from rendering before the Groups
 * have arrived, or for somebody in none.
 */

const state = vi.hoisted(() => ({
  pathname: '/baby',
  groups: undefined as unknown[] | undefined,
}))
const redirects = vi.hoisted(() => [] as unknown[])

vi.mock('convex/react', () => ({
  useQuery: (name: string) =>
    name === 'groups:myGroups' ? state.groups : undefined,
}))

vi.mock('../../../convex/_generated/api', () => ({
  api: {
    groups: { myGroups: 'groups:myGroups' },
    users: { myPins: 'users:myPins' },
  },
}))

vi.mock('@tanstack/react-router', () => ({
  useLocation: () => ({ pathname: state.pathname }),
  Navigate: (props: unknown) => {
    redirects.push(props)
    return null
  },
}))

// The chrome around the page is not what is under test.
vi.mock('./Sidebar', () => ({ Sidebar: () => null }))
vi.mock('./Topbar', () => ({ Topbar: () => null }))
vi.mock('./MobileDock', () => ({ MobileDock: () => null }))
vi.mock('./GatherPanel', () => ({ GatherPanel: () => null }))
vi.mock('./CommandPalette', () => ({ CommandPalette: () => null }))
vi.mock('./IssueReporterModal', () => ({ IssueReporterModal: () => null }))

const HOUSEHOLD = {
  _id: 'g_household',
  name: 'Jansen household',
  slug: 'jansen-household',
  role: 'admin',
}

function GroupPage() {
  return <p>In {useRequiredCurrentGroup().name}</p>
}

beforeEach(() => {
  state.pathname = '/baby'
  state.groups = undefined
  redirects.length = 0
  localStorage.clear()
})

test('holds a Group page while the Groups are loading', () => {
  renderWithI18n(
    <AppShell>
      <GroupPage />
    </AppShell>,
  )

  expect(screen.getByText('Loading…')).toBeInTheDocument()
  expect(redirects).toEqual([])
})

test('sends somebody in no Group from a Group page to Groups', () => {
  state.groups = []

  renderWithI18n(
    <AppShell>
      <GroupPage />
    </AppShell>,
  )

  expect(screen.queryByText(/^In /)).toBeNull()
  expect(redirects).toEqual([
    expect.objectContaining({ to: '/groups', replace: true }),
  ])
})

test('renders a Group page in the Current Group', () => {
  state.groups = [HOUSEHOLD]

  renderWithI18n(
    <AppShell>
      <GroupPage />
    </AppShell>,
  )

  expect(screen.getByText('In Jansen household')).toBeInTheDocument()
})

test('renders a page outside any Group without waiting for the Groups', () => {
  state.pathname = '/groups'

  renderWithI18n(
    <AppShell>
      <p>Your Groups</p>
    </AppShell>,
  )

  expect(screen.getByText('Your Groups')).toBeInTheDocument()
})
