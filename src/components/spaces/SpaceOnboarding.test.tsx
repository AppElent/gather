import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { SpaceOnboarding } from './SpaceOnboarding'

const clerkState = vi.hoisted(() => ({
  organization: null as { id: string; name: string } | null,
  createOrganization: vi.fn(),
  setActive: vi.fn(),
  memberships: [] as Array<{ organization: { id: string; name: string } }>,
  activeSpace: undefined as { spaceSlug: string } | undefined,
  invitations: [] as Array<{
    id: string
    organization: { id: string; name: string }
    inviterName: string
    accept: ReturnType<typeof vi.fn>
  }>,
}))

const createSpace = vi.hoisted(() => vi.fn())
const ensureMembershipProjection = vi.hoisted(() => vi.fn())
const navigate = vi.hoisted(() => vi.fn())
const hookState = vi.hoisted(() => ({
  actionReferences: [] as symbol[],
  mutationReferences: [] as symbol[],
}))
const apiState = vi.hoisted(() => ({
  api: {
    spaceAdmin: { create: Symbol('create') },
    spaces: {
      ensureMembershipProjection: Symbol('ensureMembershipProjection'),
      activeSpace: Symbol('activeSpace'),
    },
  },
}))

vi.mock('@clerk/clerk-react', () => ({
  useClerk: () => ({ setActive: clerkState.setActive }),
  useOrganization: () => ({ organization: clerkState.organization }),
  useOrganizationList: () => ({
    isLoaded: true,
    createOrganization: clerkState.createOrganization,
    userMemberships: { data: clerkState.memberships },
    userInvitations: { data: clerkState.invitations },
  }),
}))

vi.mock('convex/react', () => ({
  useQuery: (reference: symbol, args: unknown) =>
    reference === apiState.api.spaces.activeSpace && args !== 'skip'
      ? clerkState.activeSpace
      : undefined,
  useAction: (reference: symbol) => {
    hookState.actionReferences.push(reference)
    return createSpace
  },
  useMutation: (reference: symbol) => {
    hookState.mutationReferences.push(reference)
    return ensureMembershipProjection
  },
}))
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }))
vi.mock('../../../convex/_generated/api', () => apiState)

test('creates through the Gather backend, activates, and navigates to a Space', async () => {
  clerkState.organization = null
  clerkState.activeSpace = undefined
  clerkState.memberships = []
  clerkState.invitations = []
  clerkState.createOrganization.mockReset()
  clerkState.setActive.mockReset()
  createSpace.mockReset()
  ensureMembershipProjection.mockReset()
  navigate.mockReset()
  hookState.actionReferences = []
  hookState.mutationReferences = []
  clerkState.createOrganization.mockResolvedValue({
    id: 'org_wine',
    name: 'Wine Club',
  })
  clerkState.setActive.mockImplementation(async ({ organization }) => {
    clerkState.organization = { id: organization, name: 'Wine Club' }
  })
  createSpace.mockResolvedValue({
    clerkOrganizationId: 'org_wine',
    spaceSlug: 'wine-club',
  })

  render(<SpaceOnboarding />)
  fireEvent.change(screen.getByLabelText('Space name'), {
    target: { value: 'Wine Club' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Create Space' }))

  await waitFor(() => {
    expect(createSpace).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Wine Club' }),
    )
    expect(clerkState.setActive).toHaveBeenCalledWith({
      organization: 'org_wine',
    })
    expect(navigate).toHaveBeenCalledWith({
      to: '/s/$spaceSlug/home',
      params: { spaceSlug: 'wine-club' },
    })
  })
  expect(hookState.actionReferences).toContain(apiState.api.spaceAdmin.create)
  expect(hookState.mutationReferences).not.toContain(
    apiState.api.spaceAdmin.create,
  )
})

test('shows a create form when the user has no memberships or invitations', () => {
  clerkState.organization = null
  clerkState.activeSpace = undefined
  clerkState.memberships = []
  clerkState.invitations = []

  render(<SpaceOnboarding />)

  expect(screen.getByLabelText('Space name')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Create Space' })).toBeDisabled()
})

test('joins a marked invitation, repairs its membership projection, and navigates', async () => {
  clerkState.organization = null
  clerkState.activeSpace = { spaceSlug: 'wine-club' }
  clerkState.memberships = []
  const accept = vi.fn().mockResolvedValue(undefined)
  clerkState.invitations = [
    {
      id: 'inv_wine',
      organization: { id: 'org_wine', name: 'Wine Club' },
      publicMetadata: { gather: { kind: 'spaceInvitation', schemaVersion: 1 } },
      accept,
    } as never,
  ]
  clerkState.setActive.mockReset()
  clerkState.setActive.mockImplementation(async ({ organization }) => {
    clerkState.organization = { id: organization, name: 'Wine Club' }
  })
  ensureMembershipProjection.mockReset()
  ensureMembershipProjection.mockResolvedValue(undefined)
  navigate.mockReset()

  render(<SpaceOnboarding />)
  fireEvent.click(screen.getByRole('button', { name: 'Join' }))

  await waitFor(() => {
    expect(accept).toHaveBeenCalled()
    expect(clerkState.setActive).toHaveBeenCalledWith({
      organization: 'org_wine',
    })
    expect(ensureMembershipProjection).toHaveBeenCalledWith({
      spaceSlug: 'wine-club',
    })
    expect(navigate).toHaveBeenCalledWith({
      to: '/s/$spaceSlug/home',
      params: { spaceSlug: 'wine-club' },
    })
  })
})

test('automatically opens the active marked Space for an existing member', async () => {
  clerkState.organization = { id: 'org_wine', name: 'Wine Club' }
  clerkState.activeSpace = { spaceSlug: 'wine-club' }
  clerkState.memberships = [
    {
      organization: {
        id: 'org_wine',
        name: 'Wine Club',
        publicMetadata: { gather: { kind: 'space', schemaVersion: 1 } },
      },
    } as never,
  ]
  clerkState.invitations = []
  navigate.mockReset()

  render(<SpaceOnboarding />)

  await waitFor(() => {
    expect(navigate).toHaveBeenCalledWith({
      to: '/s/$spaceSlug/home',
      params: { spaceSlug: 'wine-club' },
    })
  })
})

test('shows the inviter name for a marked invitation', () => {
  clerkState.organization = null
  clerkState.activeSpace = undefined
  clerkState.memberships = []
  clerkState.invitations = [
    {
      id: 'inv_wine',
      organization: { id: 'org_wine', name: 'Wine Club' },
      inviterName: 'Alice',
      publicMetadata: { gather: { kind: 'spaceInvitation', schemaVersion: 1 } },
      accept: vi.fn(),
    } as never,
  ]

  render(<SpaceOnboarding />)

  expect(screen.getByText('Invited by Alice')).toBeInTheDocument()
})

test('hides unmarked memberships and invitations from onboarding', () => {
  clerkState.organization = null
  clerkState.activeSpace = undefined
  clerkState.memberships = [
    {
      organization: {
        id: 'org_other',
        name: 'Other Product',
        publicMetadata: {},
      },
    },
  ] as never
  clerkState.invitations = [
    {
      id: 'inv_other',
      organization: { id: 'org_other', name: 'Other Product' },
      inviterName: 'Alice',
      publicMetadata: {},
      accept: vi.fn(),
    } as never,
  ]

  render(<SpaceOnboarding />)

  expect(screen.queryByText('Other Product')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Join' })).not.toBeInTheDocument()
})

test('reuses the creation request ID when retrying the same Space name', async () => {
  clerkState.organization = null
  clerkState.activeSpace = undefined
  clerkState.memberships = []
  clerkState.invitations = []
  createSpace.mockReset()
  createSpace
    .mockRejectedValueOnce(new Error('Temporary failure'))
    .mockResolvedValueOnce({
      clerkOrganizationId: 'org_wine',
      spaceSlug: 'wine-club',
    })
  clerkState.setActive.mockReset()
  clerkState.setActive.mockImplementation(async ({ organization }) => {
    clerkState.organization = { id: organization, name: 'Wine Club' }
  })

  render(<SpaceOnboarding />)
  fireEvent.change(screen.getByLabelText('Space name'), {
    target: { value: 'Wine Club' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Create Space' }))
  await screen.findByRole('alert')
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

  await waitFor(() => expect(createSpace).toHaveBeenCalledTimes(2))
  expect(createSpace.mock.calls[1][0].requestId).toBe(
    createSpace.mock.calls[0][0].requestId,
  )
})
