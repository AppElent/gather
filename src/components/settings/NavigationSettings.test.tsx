import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { MODULES, type ModuleAvailability } from '../../lib/modules'
import { SpaceContextProvider } from '../spaces/SpaceContext'
import { NavigationSettings } from './NavigationSettings'

const saveNavigation = vi.fn()
const resetNavigation = vi.fn()
const saveDefaultNavigation = vi.fn()

vi.mock('convex/react', () => ({
  useMutation: (reference: { name?: string }) =>
    reference?.name === 'resetNavigation'
      ? resetNavigation
      : reference?.name === 'saveDefaultNavigation'
        ? saveDefaultNavigation
        : saveNavigation,
}))

vi.mock('../../../convex/_generated/api', () => ({
  api: {
    spacePreferences: {
      saveNavigation: { name: 'saveNavigation' },
      resetNavigation: { name: 'resetNavigation' },
    },
    spaces: { saveDefaultNavigation: { name: 'saveDefaultNavigation' } },
  },
}))

function renderNavigationSettings() {
  return render(
    <SpaceContextProvider
      value={{
        space: { slug: 'home', name: 'Home' },
        user: { name: 'Alex' },
        role: 'member',
        modules: [
          { moduleId: 'tasks', state: 'enabled' },
          { moduleId: 'notes', state: 'enabled' },
        ],
        navigation: { pinnedModuleIds: ['tasks', 'notes'] },
        dashboard: { widgets: [] },
      }}
    >
      <NavigationSettings />
    </SpaceContextProvider>,
  )
}

test('saves ordered pins and can reset to the Space default', async () => {
  const tasks = MODULES.find((module) => module.id === 'tasks')! as {
    availability: ModuleAvailability
  }
  const notes = MODULES.find((module) => module.id === 'notes')! as {
    availability: ModuleAvailability
  }
  const previous = [tasks.availability, notes.availability]
  tasks.availability = 'live'
  notes.availability = 'live'
  saveNavigation.mockReset()
  resetNavigation.mockReset()
  renderNavigationSettings()

  fireEvent.click(screen.getByRole('button', { name: 'Move Notes up' }))
  fireEvent.click(screen.getByRole('button', { name: 'Save my menu' }))
  expect(saveNavigation).toHaveBeenCalledWith({
    spaceSlug: 'home',
    pinnedModuleIds: ['notes', 'tasks'],
  })

  fireEvent.click(screen.getByRole('button', { name: 'Use Space default' }))
  expect(resetNavigation).toHaveBeenCalledWith({ spaceSlug: 'home' })
  tasks.availability = previous[0]
  notes.availability = previous[1]
})

test('uses the personal editor for an admin when the route selects personal mode', () => {
  saveNavigation.mockReset()
  render(
    <SpaceContextProvider
      value={{
        space: { slug: 'home', name: 'Home' },
        user: { name: 'Alex' },
        role: 'admin',
        modules: [{ moduleId: 'recipes', state: 'enabled' }],
        navigation: { pinnedModuleIds: ['recipes'] },
        dashboard: { widgets: [] },
      }}
    >
      <NavigationSettings mode="personal" />
    </SpaceContextProvider>,
  )

  fireEvent.click(screen.getByRole('button', { name: 'Save my menu' }))
  expect(saveNavigation).toHaveBeenCalledWith({
    spaceSlug: 'home',
    pinnedModuleIds: ['recipes'],
  })
  expect(
    screen.getByRole('button', { name: 'Use Space default' }),
  ).toBeDefined()
})

test('saves the shared Space menu only in shared mode', () => {
  saveDefaultNavigation.mockReset()
  render(
    <SpaceContextProvider
      value={{
        space: { slug: 'home', name: 'Home' },
        user: { name: 'Alex' },
        role: 'admin',
        modules: [{ moduleId: 'recipes', state: 'enabled' }],
        navigation: { pinnedModuleIds: ['recipes'] },
        dashboard: { widgets: [] },
      }}
    >
      <NavigationSettings mode="space" />
    </SpaceContextProvider>,
  )

  fireEvent.click(screen.getByRole('button', { name: 'Save Space menu' }))
  expect(saveDefaultNavigation).toHaveBeenCalledWith({
    spaceSlug: 'home',
    pinnedModuleIds: ['recipes'],
  })
  expect(screen.queryByRole('button', { name: 'Use Space default' })).toBeNull()
})
