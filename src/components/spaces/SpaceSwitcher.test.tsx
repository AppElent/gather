import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { expect, test, vi } from 'vitest'

type LinkMockProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode
}

import { SpaceContextProvider } from './SpaceContext'
import { SpaceSwitcher } from './SpaceSwitcher'

const clerk = vi.hoisted(() => ({
  fetchNext: vi.fn(),
  setActive: vi.fn(),
}))

vi.mock('@clerk/clerk-react', () => ({
  useClerk: () => ({ setActive: clerk.setActive }),
  useOrganizationList: () => ({
    userMemberships: {
      data: [],
      hasNextPage: true,
      fetchNext: clerk.fetchNext,
    },
  }),
}))

vi.mock('convex/react', () => ({
  useQuery: () => [],
}))

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-router')>(
    '@tanstack/react-router',
  )
  return {
    ...actual,
    Link: ({ children, ...props }: LinkMockProps) => (
      <a href="/" {...props}>
        {children}
      </a>
    ),
    useLocation: () => ({ pathname: '/s/wine/home' }),
    useNavigate: () => vi.fn(),
  }
})

test('loads every Clerk membership page before filtering Gather Spaces', async () => {
  clerk.fetchNext.mockClear()
  render(
    <SpaceContextProvider
      value={{
        space: { slug: 'wine', name: 'Wine Club' },
        user: { name: 'Alex' },
        role: 'member',
        modules: [],
        navigation: { pinnedModuleIds: [] },
        dashboard: { widgets: [] },
      }}
    >
      <SpaceSwitcher />
    </SpaceContextProvider>,
  )

  fireEvent.click(screen.getByRole('button', { name: 'Switch Space' }))
  await waitFor(() => expect(clerk.fetchNext).toHaveBeenCalledTimes(1))
})
