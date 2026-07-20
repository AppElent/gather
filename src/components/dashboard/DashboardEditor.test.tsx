import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import type { WidgetDefinition } from '../../lib/modules'
import { DashboardEditor } from './DashboardEditor'

const saveDashboard = vi.fn()
const resetDashboard = vi.fn()
const saveDefaultDashboard = vi.fn()

vi.mock('convex/react', () => ({
  useMutation: (reference: { name?: string }) =>
    reference?.name === 'resetDashboard'
      ? resetDashboard
      : reference?.name === 'saveDefaultDashboard'
        ? saveDefaultDashboard
        : saveDashboard,
}))

vi.mock('../../../convex/_generated/api', () => ({
  api: {
    spacePreferences: {
      saveDashboard: { name: 'saveDashboard' },
      resetDashboard: { name: 'resetDashboard' },
    },
    spaces: { saveDefaultDashboard: { name: 'saveDefaultDashboard' } },
  },
}))

const definitions: WidgetDefinition[] = [
  {
    id: 'calendar.upcoming',
    moduleId: 'calendar',
    label: 'Upcoming events',
    allowedSizes: ['standard', 'wide'],
    defaultSize: 'standard',
    allowMultiple: false,
  },
  {
    id: 'notes.note',
    moduleId: 'notes',
    label: 'Note',
    allowedSizes: ['compact', 'standard'],
    defaultSize: 'compact',
    allowMultiple: true,
  },
]

test('duplicates only widgets whose definition allows multiples', () => {
  render(
    <DashboardEditor
      spaceSlug="wine"
      mode="personal"
      initialWidgets={[]}
      definitions={definitions}
      availableRendererIds={definitions.map((definition) => definition.id)}
    />,
  )

  fireEvent.click(screen.getByRole('button', { name: 'Add Upcoming events' }))
  expect(
    screen.getByRole('button', { name: 'Add Upcoming events' }),
  ).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Add Note' }))
  expect(screen.getByRole('button', { name: 'Add Note' })).toBeEnabled()
})

test('saves and resets a personal snapshot', () => {
  saveDashboard.mockReset()
  resetDashboard.mockReset()
  render(
    <DashboardEditor
      spaceSlug="wine"
      mode="personal"
      initialWidgets={[]}
      definitions={definitions}
      availableRendererIds={definitions.map((definition) => definition.id)}
    />,
  )

  fireEvent.click(screen.getByRole('button', { name: 'Save my dashboard' }))
  expect(saveDashboard).toHaveBeenCalledWith({
    spaceSlug: 'wine',
    dashboard: [],
  })
  fireEvent.click(screen.getByRole('button', { name: 'Use Space default' }))
  expect(resetDashboard).toHaveBeenCalledWith({ spaceSlug: 'wine' })
})

test('saves the shared snapshot in Space mode', () => {
  saveDefaultDashboard.mockReset()
  render(
    <DashboardEditor
      spaceSlug="wine"
      mode="space"
      initialWidgets={[]}
      definitions={definitions}
      availableRendererIds={definitions.map((definition) => definition.id)}
    />,
  )

  fireEvent.click(screen.getByRole('button', { name: 'Save Space dashboard' }))
  expect(saveDefaultDashboard).toHaveBeenCalledWith({
    spaceSlug: 'wine',
    dashboard: [],
  })
})
