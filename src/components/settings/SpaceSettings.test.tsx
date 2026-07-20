import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { SpaceContextProvider } from '../spaces/SpaceContext'
import { SpaceSettings } from './SpaceSettings'

const rename = vi.fn()
const deleteSpace = vi.fn()
vi.mock('convex/react', () => ({
  useAction: (reference: { name?: string }) =>
    reference?.name === 'rename' ? rename : deleteSpace,
}))
vi.mock('../../../convex/_generated/api', () => ({
  api: {
    spaceAdmin: {
      rename: { name: 'rename' },
      deleteSpace: { name: 'deleteSpace' },
    },
  },
}))

test('renames a Space and requires exact deletion confirmation', () => {
  rename.mockReset()
  deleteSpace.mockReset()
  render(
    <SpaceContextProvider
      value={{
        space: { slug: 'wine', name: 'Wine Club' },
        user: { name: 'Alex' },
        role: 'admin',
        modules: [],
        navigation: { pinnedModuleIds: [] },
        dashboard: { widgets: [] },
      }}
    >
      <SpaceSettings />
    </SpaceContextProvider>,
  )
  fireEvent.change(screen.getByLabelText('Space name'), {
    target: { value: 'Wine Society' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Rename Space' }))
  expect(rename).toHaveBeenCalledWith({
    spaceSlug: 'wine',
    name: 'Wine Society',
  })
  const remove = screen.getByRole('button', { name: 'Delete Space' })
  expect(remove).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Type DELETE Wine Club to confirm'), {
    target: { value: 'DELETE Wine Club' },
  })
  fireEvent.click(remove)
  expect(deleteSpace).toHaveBeenCalledWith({
    spaceSlug: 'wine',
    confirmation: 'DELETE Wine Club',
  })
})
