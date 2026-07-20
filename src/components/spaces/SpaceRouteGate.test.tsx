import { render, screen, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { SpaceRouteGate } from './SpaceRouteGate'

const clerkState = vi.hoisted(() => ({
  isLoaded: true,
  organization: { id: 'org_home' } as { id: string } | null,
  setActive: vi.fn(),
  memberships: [] as Array<{
    organization: { id: string; name: string; publicMetadata: unknown }
  }>,
  hasNextPage: false,
  fetchNext: vi.fn(),
}))

const convexState = vi.hoisted(() => ({
  spaces: [
    { slug: 'wine', clerkOrganizationId: 'org_wine' },
    { slug: 'home', clerkOrganizationId: 'org_home' },
  ],
  context: {
    space: { slug: 'wine' },
    user: { name: 'Eric' },
    role: 'admin',
    modules: [],
    navigation: { pinnedModuleIds: [] },
    dashboard: { widgets: [] },
  },
}))

const apiState = vi.hoisted(() => ({
  api: { spaces: { mine: Symbol('mine'), context: Symbol('context') } },
}))

vi.mock('@clerk/clerk-react', () => ({
  useClerk: () => ({ setActive: clerkState.setActive }),
  useAuth: () => ({ getToken: () => Promise.resolve('token') }),
  useOrganizationList: () => ({
    isLoaded: true,
    userMemberships: {
      data: clerkState.memberships,
      hasNextPage: clerkState.hasNextPage,
      fetchNext: clerkState.fetchNext,
    },
  }),
  useOrganization: () => ({
    isLoaded: clerkState.isLoaded,
    organization: clerkState.organization,
  }),
}))

vi.mock('convex/react', () => ({
  useQuery: (reference: symbol, args: unknown) => {
    if (args === 'skip') return undefined
    if (reference === apiState.api.spaces.mine) return convexState.spaces
    if (reference === apiState.api.spaces.context) return convexState.context
    return undefined
  },
}))

vi.mock('../../../convex/_generated/api', () => apiState)

function markedMembership(id: string, name: string) {
  return {
    organization: {
      id,
      name,
      publicMetadata: { gather: { kind: 'space', schemaVersion: 1 } },
    },
  }
}

function resetGate() {
  clerkState.isLoaded = true
  clerkState.organization = { id: 'org_home' }
  clerkState.setActive.mockReset()
  clerkState.setActive.mockResolvedValue(undefined)
  clerkState.memberships = [markedMembership('org_wine', 'Wine')]
  clerkState.hasNextPage = false
  clerkState.fetchNext.mockReset()
}

test('activates the URL organization before rendering children', async () => {
  resetGate()

  const view = render(
    <SpaceRouteGate spaceSlug="wine">
      <p>Space child</p>
    </SpaceRouteGate>,
  )

  await waitFor(() => {
    expect(clerkState.setActive).toHaveBeenCalledWith({
      organization: 'org_wine',
    })
  })
  expect(screen.queryByText('Space child')).not.toBeInTheDocument()

  clerkState.organization = { id: 'org_wine' }
  view.rerender(
    <SpaceRouteGate spaceSlug="wine">
      <p>Space child</p>
    </SpaceRouteGate>,
  )

  expect(await screen.findByText('Space child')).toBeInTheDocument()
})

test('loads later membership pages before activating a listed Gather Space', async () => {
  resetGate()
  clerkState.memberships = [
    { organization: { id: 'org_other', name: 'Other', publicMetadata: {} } },
  ]
  clerkState.hasNextPage = true
  clerkState.fetchNext.mockImplementation(async () => {
    clerkState.memberships = [
      ...clerkState.memberships,
      markedMembership('org_wine', 'Wine'),
    ]
    clerkState.hasNextPage = false
  })

  const view = render(
    <SpaceRouteGate spaceSlug="wine">
      <p>Space child</p>
    </SpaceRouteGate>,
  )

  await waitFor(() => expect(clerkState.fetchNext).toHaveBeenCalledTimes(1))
  view.rerender(
    <SpaceRouteGate spaceSlug="wine">
      <p>Space child</p>
    </SpaceRouteGate>,
  )
  await waitFor(() => {
    expect(clerkState.setActive).toHaveBeenCalledWith({
      organization: 'org_wine',
    })
  })
})

test('refuses to activate a Space not present in the marked Clerk membership list', () => {
  resetGate()
  clerkState.memberships = [
    { organization: { id: 'org_wine', name: 'Wine', publicMetadata: {} } },
  ]

  render(
    <SpaceRouteGate spaceSlug="wine">
      <p>Space child</p>
    </SpaceRouteGate>,
  )

  expect(
    screen.getByText('Choose a Gather Space to continue.'),
  ).toBeInTheDocument()
  expect(clerkState.setActive).not.toHaveBeenCalled()
})
