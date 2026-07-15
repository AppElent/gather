import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { GatherPanel } from './GatherPanel'

test('does not render when closed', () => {
  render(
    <GatherPanel
      open={false}
      activeGroupName="Oak House"
      routeTitle="Recipes"
      onClose={() => {}}
    />,
  )

  expect(screen.queryByRole('dialog', { name: 'Ask Gather' })).toBeNull()
})

test('renders non-automated placeholder prompts when open', () => {
  render(
    <GatherPanel
      open={true}
      activeGroupName="Oak House"
      routeTitle="Recipes"
      onClose={() => {}}
    />,
  )

  expect(screen.getByRole('dialog', { name: 'Ask Gather' })).toBeDefined()
  expect(screen.getByText('Oak House')).toBeDefined()
  expect(screen.getByText('Context: Recipes')).toBeDefined()
  expect(screen.getByText(/automation is not connected yet/i)).toBeDefined()
  expect(screen.getByPlaceholderText(/ask gather/i)).toBeDefined()
})

test('calls onClose from close button and Escape', () => {
  const onClose = vi.fn()
  render(
    <GatherPanel
      open={true}
      activeGroupName="Oak House"
      routeTitle="Recipes"
      onClose={onClose}
    />,
  )

  fireEvent.click(screen.getByRole('button', { name: 'Close Ask Gather' }))
  fireEvent.keyDown(window, { key: 'Escape' })

  expect(onClose).toHaveBeenCalledTimes(2)
})
