import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { SpaceContextProvider } from '../spaces/SpaceContext'
import { ModuleSettings } from './ModuleSettings'

vi.mock('convex/react', () => ({
  useMutation: () => vi.fn(),
  useAction: () => vi.fn(),
}))

function renderModuleSettings(role: 'admin' | 'member') {
  return render(
    <SpaceContextProvider
      value={{
        space: { slug: 'wine', name: 'Wine Club' },
        user: { name: 'Alex' },
        role,
        modules: [{ moduleId: 'recipes', state: 'enabled' }],
        navigation: { pinnedModuleIds: [] },
        dashboard: { widgets: [] },
      }}
    >
      <ModuleSettings />
    </SpaceContextProvider>,
  )
}

test('shows coming-soon modules only to admins in module settings', () => {
  const { rerender } = renderModuleSettings('member')
  expect(screen.queryByText('Calendar')).toBeNull()
  expect(screen.getByText('Admin access required')).toBeDefined()
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
      <ModuleSettings />
    </SpaceContextProvider>,
  )
  expect(screen.getByText('Calendar')).toBeDefined()
  expect(
    screen.getAllByText('Enabled automatically when available').length,
  ).toBeGreaterThan(0)
})
