import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { SpaceContextProvider } from '../spaces/SpaceContext'
import { SpaceMembers } from './SpaceMembers'

const changeRole = vi.fn()
const removeMember = vi.fn()

vi.mock('convex/react', () => ({
  useAction: (reference: { name?: string }) =>
    reference?.name === 'changeRole'
      ? changeRole
      : reference?.name === 'removeMember'
        ? removeMember
        : vi.fn(),
}))
vi.mock('@clerk/clerk-react', () => ({
  useOrganization: () => ({
    organization: { id: 'org_wine' },
    memberships: {
      data: [
        {
          id: 'admin',
          role: 'org:admin',
          publicUserData: {
            firstName: 'Alex',
            lastName: 'Smith',
            identifier: 'alex@example.com',
          },
        },
        {
          id: 'member',
          role: 'org:member',
          publicUserData: {
            firstName: 'Sam',
            lastName: 'Jones',
            identifier: 'sam@example.com',
          },
        },
      ],
    },
    invitations: {
      data: [{ id: 'invite_1', emailAddress: 'new@example.com' }],
    },
  }),
}))
vi.mock('../../../convex/_generated/api', () => ({
  api: {
    spaceAdmin: {
      changeRole: { name: 'changeRole' },
      removeMember: { name: 'removeMember' },
      invite: { name: 'invite' },
      revokeInvitation: { name: 'revokeInvitation' },
      reconcile: { name: 'reconcile' },
    },
  },
}))

function renderMembers() {
  return render(
    <SpaceContextProvider
      value={{
        space: { slug: 'wine', name: 'Wine Club' },
        user: { name: 'Alex' },
        role: 'admin',
        modules: [],
        navigation: { pinnedModuleIds: [] },
        dashboard: { widgets: [] },
      }}
    >
      <SpaceMembers />
    </SpaceContextProvider>,
  )
}

test('uses Clerk as the membership source and protects the last admin', () => {
  changeRole.mockReset()
  removeMember.mockReset()
  renderMembers()
  expect(
    screen.getByText('Clerk is the source of truth for memberships.'),
  ).toBeDefined()
  expect(
    screen.getByRole('button', { name: 'Demote Alex Smith' }),
  ).toBeDisabled()
  expect(
    screen.getByRole('button', { name: 'Remove Alex Smith' }),
  ).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Promote Sam Jones' }))
  expect(changeRole).toHaveBeenCalledWith({
    spaceSlug: 'wine',
    clerkMembershipId: 'member',
    role: 'admin',
  })
})
