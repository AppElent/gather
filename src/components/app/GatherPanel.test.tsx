import { fireEvent, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { renderWithI18n } from '../../lib/i18n/testing'
import { GatherPanel } from './GatherPanel'

test('does not render when closed', () => {
  renderWithI18n(
    <GatherPanel
      open={false}
      activeGroupName="Jansen Household"
      routeTitle="Recipes"
      onClose={() => {}}
    />,
  )

  expect(screen.queryByRole('dialog', { name: 'Ask Gather' })).toBeNull()
})

test('renders non-automated placeholder prompts when open', () => {
  renderWithI18n(
    <GatherPanel
      open={true}
      activeGroupName="Jansen Household"
      routeTitle="Recipes"
      onClose={() => {}}
    />,
  )

  expect(screen.getByRole('dialog', { name: 'Ask Gather' })).toBeDefined()
  expect(screen.getByText('Jansen Household')).toBeDefined()
  expect(screen.getByText('Context: Recipes')).toBeDefined()
  expect(screen.getByText(/automation is not connected yet/i)).toBeDefined()
  expect(screen.getByPlaceholderText(/ask gather/i)).toBeDefined()
})

test('names no group off a group route, rather than inventing one', () => {
  renderWithI18n(
    <GatherPanel
      open={true}
      activeGroupName={null}
      routeTitle="Settings"
      onClose={() => {}}
    />,
  )

  // The shell passes the Group the address bar names, and there is none on
  // Settings. This used to be the literal string "Preview group" on every
  // route, which named a Group that has never existed.
  expect(screen.getByText('No group')).toBeDefined()
})

test('calls onClose from close button and Escape', () => {
  const onClose = vi.fn()
  renderWithI18n(
    <GatherPanel
      open={true}
      activeGroupName="Jansen Household"
      routeTitle="Recipes"
      onClose={onClose}
    />,
  )

  fireEvent.click(screen.getByRole('button', { name: 'Close Ask Gather' }))
  fireEvent.keyDown(window, { key: 'Escape' })

  expect(onClose).toHaveBeenCalledTimes(2)
})

test('moves focus into the panel and traps Tab navigation', () => {
  renderWithI18n(
    <GatherPanel
      open={true}
      activeGroupName="Oak House"
      routeTitle="Recipes"
      onClose={() => {}}
    />,
  )

  const closeButton = screen.getByRole('button', { name: 'Close Ask Gather' })
  const textarea = screen.getByPlaceholderText(/ask gather/i)

  expect(document.activeElement).toBe(closeButton)

  textarea.focus()
  fireEvent.keyDown(textarea, { key: 'Tab' })
  expect(document.activeElement).toBe(closeButton)

  fireEvent.keyDown(closeButton, { key: 'Tab', shiftKey: true })
  expect(document.activeElement).toBe(textarea)
})

test('restores focus to the opener when it closes', () => {
  const renderPanel = (open: boolean) => (
    <>
      <button type="button">Open Gather</button>
      <GatherPanel
        open={open}
        activeGroupName="Jansen Household"
        routeTitle="Recipes"
        onClose={() => {}}
      />
    </>
  )
  const { rerender } = renderWithI18n(renderPanel(false))
  const opener = screen.getByRole('button', { name: 'Open Gather' })

  opener.focus()
  rerender(renderPanel(true))
  rerender(renderPanel(false))

  expect(document.activeElement).toBe(opener)
})
