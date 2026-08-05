import { screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { GroupGate, useGroup } from '../components/app/GroupGate'
import { renderWithI18n } from '../lib/i18n/testing'

/**
 * The four states of the `/g/<slug>` gate, and nothing about how they look.
 * What matters is that a member gets the page, a stranger is refused without
 * being redirected somewhere they *are* allowed, and a slug that does not exist
 * says so instead of rendering a blank page.
 */

const resolution = vi.hoisted(() => ({ value: undefined as unknown }))

vi.mock('convex/react', () => ({ useQuery: () => resolution.value }))

vi.mock('../../convex/_generated/api', () => ({
  api: { groups: { bySlug: 'groups:bySlug' } },
}))

function ShowGroup() {
  const group = useGroup()
  return <p>{`${group.name} · ${group.role}`}</p>
}

beforeEach(() => {
  resolution.value = undefined
})

test('waits while the Group is still being resolved', () => {
  renderWithI18n(
    <GroupGate slug="jansen-household">
      <ShowGroup />
    </GroupGate>,
  )

  expect(screen.getByText('Loading…')).toBeInTheDocument()
})

test('renders the page for a member, and tells it which Group it is in', () => {
  resolution.value = {
    ok: true,
    group: {
      _id: 'group1',
      name: 'Jansen Household',
      slug: 'jansen-household',
      isPersonal: false,
    },
    role: 'admin',
  }

  renderWithI18n(
    <GroupGate slug="jansen-household">
      <ShowGroup />
    </GroupGate>,
  )

  expect(screen.getByText('Jansen Household · admin')).toBeInTheDocument()
})

test('refuses a Group you are not a member of, and stays put', () => {
  resolution.value = { ok: false, reason: 'not-a-member' }

  renderWithI18n(
    <GroupGate slug="someone-elses">
      <ShowGroup />
    </GroupGate>,
  )

  expect(
    screen.getByRole('heading', { name: /not yours/i }),
  ).toBeInTheDocument()
  expect(screen.queryByText(/·/)).toBeNull()
})

test('says plainly when no Group has that slug', () => {
  resolution.value = { ok: false, reason: 'unknown-slug' }

  renderWithI18n(
    <GroupGate slug="typo">
      <ShowGroup />
    </GroupGate>,
  )

  const heading = screen.getByRole('heading', { name: /no such group/i })
  expect(heading).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: /not yours/i })).toBeNull()
})

test('a Group-scoped page cannot render outside the gate', () => {
  // Keep React's own error logging out of the test output.
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  expect(() => renderWithI18n(<ShowGroup />)).toThrow(/useGroup/)
  error.mockRestore()
})
