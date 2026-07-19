import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { SpaceContextProvider } from '../spaces/SpaceContext'
import { MobileDock } from './MobileDock'

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-router')>(
    '@tanstack/react-router',
  )
  return {
    ...actual,
    Link: ({ children, to, params, ...props }: any) => (
      <a
        href={String(to).replace('$spaceSlug', params?.spaceSlug ?? '')}
        {...props}
      >
        {children}
      </a>
    ),
  }
})

test('limits mobile navigation to Home, three visible pins, and All', () => {
  render(
    <SpaceContextProvider
      value={{
        space: { slug: 'wine', name: 'Wine Club' },
        user: { name: 'Alex' },
        role: 'member',
        modules: [{ moduleId: 'recipes', state: 'enabled' }],
        navigation: {
          pinnedModuleIds: ['recipes', 'calendar', 'notes', 'tasks'],
        },
        dashboard: { widgets: [] },
      }}
    >
      <MobileDock location={{ pathname: '/s/wine/recipes' }} />
    </SpaceContextProvider>,
  )

  expect(screen.getAllByRole('link')).toHaveLength(3)
  expect(screen.getByRole('link', { name: 'Home' })).toBeDefined()
  expect(screen.getByRole('link', { name: 'Recipes' })).toBeDefined()
  expect(screen.getByRole('link', { name: 'All' })).toBeDefined()
})
