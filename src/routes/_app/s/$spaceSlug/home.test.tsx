import { render, screen } from '@testing-library/react'
import type { ComponentType, ReactNode } from 'react'
import { expect, test, vi } from 'vitest'
import { SpaceContextProvider } from '../../../../components/spaces/SpaceContext'

let HomeRouteComponent: ComponentType | undefined

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  createFileRoute: () => (options: { component: ComponentType }) => {
    HomeRouteComponent = options.component
    return {}
  },
}))

const { Route } = await import('./home')
void Route

function renderHome(role: 'admin' | 'member') {
  const Home = HomeRouteComponent!
  return render(
    <SpaceContextProvider
      value={{
        space: { slug: 'wine', name: 'Wine Club' },
        user: { name: 'Alex' },
        role,
        modules: [],
        navigation: { pinnedModuleIds: [] },
        dashboard: { widgets: [] },
      }}
    >
      <Home />
    </SpaceContextProvider>,
  )
}

test('guides admins to configure an empty Space dashboard', () => {
  renderHome('admin')

  expect(screen.getByText('No dashboard widgets yet.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Manage modules' })).toHaveAttribute(
    'href',
    '/s/$spaceSlug/settings/modules',
  )
  expect(
    screen.getByRole('link', { name: 'Edit Space dashboard' }),
  ).toHaveAttribute('href', '/s/$spaceSlug/settings/dashboard')
})

test('guides members to add widgets to an empty personal dashboard', () => {
  renderHome('member')

  expect(screen.getByText('No dashboard widgets yet.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Add widgets' })).toHaveAttribute(
    'href',
    '/s/$spaceSlug/settings/dashboard',
  )
  expect(screen.queryByRole('link', { name: 'Manage modules' })).toBeNull()
})
