import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { SpaceContextProvider } from '../../../../../components/spaces/SpaceContext'
import { SpaceNavigationSettings } from './navigation'

const saveNavigation = vi.fn()
const resetNavigation = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({}),
}))

vi.mock('convex/react', () => ({
  useMutation: (reference: { name?: string }) =>
    reference?.name === 'resetNavigation' ? resetNavigation : saveNavigation,
}))

vi.mock('../../../../../../convex/_generated/api', () => ({
  api: {
    spacePreferences: {
      saveNavigation: { name: 'saveNavigation' },
      resetNavigation: { name: 'resetNavigation' },
    },
    spaces: { saveDefaultNavigation: { name: 'saveDefaultNavigation' } },
  },
}))

test('lets an admin edit and reset their personal navigation snapshot', () => {
  render(
    <SpaceContextProvider
      value={{
        space: { slug: 'wine', name: 'Wine Club' },
        user: { name: 'Alex' },
        role: 'admin',
        modules: [{ moduleId: 'recipes', state: 'enabled' }],
        navigation: { pinnedModuleIds: ['recipes'] },
        dashboard: { widgets: [] },
      }}
    >
      <SpaceNavigationSettings />
    </SpaceContextProvider>,
  )

  fireEvent.click(screen.getByRole('button', { name: 'My menu' }))
  fireEvent.click(screen.getByRole('button', { name: 'Save my menu' }))
  expect(saveNavigation).toHaveBeenCalledWith({
    spaceSlug: 'wine',
    pinnedModuleIds: ['recipes'],
  })
  fireEvent.click(screen.getByRole('button', { name: 'Use Space default' }))
  expect(resetNavigation).toHaveBeenCalledWith({ spaceSlug: 'wine' })
})
