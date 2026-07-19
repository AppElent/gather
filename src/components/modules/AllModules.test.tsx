import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { MODULES, type ModuleAvailability } from '../../lib/modules'
import { SpaceContextProvider } from '../spaces/SpaceContext'
import { AllModules } from './AllModules'

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

function renderAllModules(role: 'admin' | 'member' = 'member') {
  return render(
    <SpaceContextProvider
      value={{
        space: { slug: 'wine', name: 'Wine Club' },
        user: { name: 'Alex' },
        role,
        modules: [
          { moduleId: 'recipes', state: 'enabled' },
          { moduleId: 'calendar', state: 'preEnabled' },
        ],
        navigation: { pinnedModuleIds: [] },
        dashboard: { widgets: [] },
      }}
    >
      <AllModules />
    </SpaceContextProvider>,
  )
}

test('keeps enabled live modules reachable and hides coming-soon modules', () => {
  renderAllModules()

  expect(screen.getByRole('link', { name: 'Recipes' })).toHaveAttribute(
    'href',
    '/s/wine/recipes',
  )
  expect(screen.queryByRole('link', { name: 'Calendar' })).toBeNull()
})

test('shows Manage modules only to Space admins', () => {
  const { rerender } = renderAllModules()
  expect(screen.queryByRole('link', { name: 'Manage modules' })).toBeNull()

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
      <AllModules />
    </SpaceContextProvider>,
  )
  expect(screen.getByRole('link', { name: 'Manage modules' })).toHaveAttribute(
    'href',
    '/s/wine/settings/modules',
  )
})

test('shows mobile overflow pins before the deduplicated enabled module grid', () => {
  const promoted = MODULES.filter((module) =>
    ['tasks', 'notes', 'calendar'].includes(module.id),
  )
  const availability = promoted.map((module) => module.availability)
  for (const module of promoted)
    (module as { availability: ModuleAvailability }).availability = 'live'
  window.matchMedia = vi.fn().mockReturnValue({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
  render(
    <SpaceContextProvider
      value={{
        space: { slug: 'wine', name: 'Wine Club' },
        user: { name: 'Alex' },
        role: 'member',
        modules: [
          { moduleId: 'recipes', state: 'enabled' },
          { moduleId: 'tasks', state: 'enabled' },
          { moduleId: 'notes', state: 'enabled' },
          { moduleId: 'calendar', state: 'enabled' },
        ],
        navigation: {
          pinnedModuleIds: ['recipes', 'tasks', 'notes', 'calendar'],
        },
        dashboard: { widgets: [] },
      }}
    >
      <AllModules />
    </SpaceContextProvider>,
  )

  expect(
    screen.getByRole('heading', { name: 'More from your menu' }),
  ).toBeDefined()
  expect(screen.getAllByRole('link', { name: 'Calendar' })).toHaveLength(1)
  for (const [index, module] of promoted.entries())
    (module as { availability: ModuleAvailability }).availability =
      availability[index]
})
