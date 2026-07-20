import { render, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { LegacySpaceRedirect } from './LegacySpaceRedirect'

const navigate = vi.hoisted(() => vi.fn())
const clerkState = vi.hoisted(() => ({
  organization: { id: 'org_wine' } as { id: string } | null,
  setActive: vi.fn(),
  getToken: vi.fn(),
}))
const convexState = vi.hoisted(() => ({
  spaces: [{ slug: 'wine', clerkOrganizationId: 'org_wine' }],
  context: { modules: [{ moduleId: 'recipes', state: 'enabled' }] },
}))
const apiState = vi.hoisted(() => ({
  api: { spaces: { mine: Symbol('mine'), context: Symbol('context') } },
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
}))

vi.mock('@clerk/clerk-react', () => ({
  useOrganization: () => ({ organization: clerkState.organization }),
  useClerk: () => ({ setActive: clerkState.setActive }),
  useAuth: () => ({ getToken: clerkState.getToken }),
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

function resetRedirect() {
  navigate.mockReset()
  clerkState.setActive.mockReset()
  clerkState.setActive.mockResolvedValue(undefined)
  clerkState.getToken.mockReset()
  clerkState.getToken.mockResolvedValue('token')
  clerkState.organization = { id: 'org_wine' }
  convexState.spaces = [{ slug: 'wine', clerkOrganizationId: 'org_wine' }]
  convexState.context = {
    modules: [{ moduleId: 'recipes', state: 'enabled' }],
  }
}

test('redirects /dashboard to the active Space Home', async () => {
  resetRedirect()
  render(<LegacySpaceRedirect from="/dashboard" />)

  await waitFor(() => {
    expect(navigate).toHaveBeenCalledWith({
      to: '/s/$spaceSlug/home',
      params: { spaceSlug: 'wine' },
      replace: true,
    })
  })
})

test('sends a disabled legacy module route to All', async () => {
  resetRedirect()
  convexState.context = { modules: [] }
  render(<LegacySpaceRedirect from="/calendar" />)

  await waitFor(() => {
    expect(navigate).toHaveBeenCalledWith({
      to: '/s/$spaceSlug/modules',
      params: { spaceSlug: 'wine' },
      replace: true,
    })
  })
})

test('preserves a visible legacy Recipes bookmark inside its Space', async () => {
  resetRedirect()
  render(<LegacySpaceRedirect from="/modules/recipes" />)

  await waitFor(() => {
    expect(navigate).toHaveBeenCalledWith({
      to: '/s/$spaceSlug/recipes',
      params: { spaceSlug: 'wine' },
      replace: true,
    })
  })
})

test('activates a fallback Gather Space before resolving a visible legacy Recipes bookmark', async () => {
  resetRedirect()
  clerkState.organization = { id: 'org_other' }
  const view = render(<LegacySpaceRedirect from="/modules/recipes" />)

  await waitFor(() => {
    expect(clerkState.setActive).toHaveBeenCalledWith({
      organization: 'org_wine',
    })
  })
  expect(navigate).not.toHaveBeenCalled()

  clerkState.organization = { id: 'org_wine' }
  view.rerender(<LegacySpaceRedirect from="/modules/recipes" />)

  await waitFor(() => {
    expect(clerkState.getToken).toHaveBeenCalledWith({
      template: 'convex',
      skipCache: true,
    })
    expect(navigate).toHaveBeenCalledWith({
      to: '/s/$spaceSlug/recipes',
      params: { spaceSlug: 'wine' },
      replace: true,
    })
  })
})
