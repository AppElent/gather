import { render, screen } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { expect, test, vi } from 'vitest'

type LinkMockProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode
  to?: unknown
  params?: { spaceSlug?: string }
}

import { SpaceContextProvider } from '../spaces/SpaceContext'
import { Sidebar } from './Sidebar'

const routerState = vi.hoisted(() => ({ pathname: '/s/wine/home' }))

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-router')>(
    '@tanstack/react-router',
  )
  return {
    ...actual,
    Link: ({ children, to, params, ...props }: LinkMockProps) => (
      <a
        href={String(to).replace('$spaceSlug', params?.spaceSlug ?? '')}
        {...props}
      >
        {children}
      </a>
    ),
    useLocation: () => routerState,
  }
})

vi.mock('../spaces/SpaceSwitcher', () => ({
  SpaceSwitcher: () => <div>Wine Club</div>,
}))

test('renders only visible Space pins and Space administration for admins', () => {
  render(
    <SpaceContextProvider
      value={{
        space: { slug: 'wine', name: 'Wine Club' },
        user: { name: 'Alex' },
        role: 'admin',
        modules: [
          { moduleId: 'recipes', state: 'enabled' },
          { moduleId: 'calendar', state: 'preEnabled' },
        ],
        navigation: { pinnedModuleIds: ['recipes', 'calendar'] },
        dashboard: { widgets: [] },
      }}
    >
      <Sidebar />
    </SpaceContextProvider>,
  )

  expect(screen.getByRole('link', { name: 'Recipes' })).toBeDefined()
  expect(screen.queryByRole('link', { name: 'Calendar' })).toBeNull()
  expect(screen.getByRole('link', { name: 'Members' })).toBeDefined()
  expect(screen.getByRole('link', { name: 'Settings' })).toBeDefined()
})

test('marks All active only for All and enabled unpinned module destinations', () => {
  routerState.pathname = '/s/wine/home'
  const { rerender } = render(
    <SpaceContextProvider
      value={{
        space: { slug: 'wine', name: 'Wine Club' },
        user: { name: 'Alex' },
        role: 'admin',
        modules: [{ moduleId: 'recipes', state: 'enabled' }],
        navigation: { pinnedModuleIds: [] },
        dashboard: { widgets: [] },
      }}
    >
      <Sidebar />
    </SpaceContextProvider>,
  )

  expect(screen.getByRole('link', { name: 'All' }).className).not.toContain(
    'border-[var(--app-fg)]',
  )
  routerState.pathname = '/s/wine/recipes'
  rerender(
    <SpaceContextProvider
      value={{
        space: { slug: 'wine', name: 'Wine Club' },
        user: { name: 'Alex' },
        role: 'admin',
        modules: [{ moduleId: 'recipes', state: 'enabled' }],
        navigation: { pinnedModuleIds: [] },
        dashboard: { widgets: [] },
      }}
    >
      <Sidebar />
    </SpaceContextProvider>,
  )
  expect(screen.getByRole('link', { name: 'All' }).className).toContain(
    'border-[var(--app-fg)]',
  )
})
