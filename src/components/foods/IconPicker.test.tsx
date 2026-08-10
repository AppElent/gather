import { fireEvent, screen, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { renderWithI18n } from '../../lib/i18n/testing'
import { FOOD_ICONS, IconPicker } from './IconPicker'

test('starts collapsed and invites the person to choose an icon', () => {
  renderWithI18n(<IconPicker onChange={vi.fn()} />)

  const trigger = screen.getByRole('button', { name: 'Choose icon' })
  expect(trigger.ariaExpanded).toBe('false')
  expect(trigger).toHaveTextContent('🍽️')
  expect(screen.queryByRole('dialog')).toBeNull()
})

/**
 * The picker is a curated set, and clearing is a real answer (#94).
 *
 * The one behaviour worth defending in a test is what "no icon" is stored as:
 * `undefined`, never `''`. An empty string is set as far as the tile's fallback
 * chain can tell, so it would sit in front of the generic glyph and render a
 * blank square — a bug nobody would find by reading the picker.
 */

test('the set is curated rather than every emoji there is', () => {
  // Roughly forty was the decision (#75's triage), not an exact number — this
  // guards the shape of the answer, so that widening it later is a choice
  // somebody makes rather than something that drifts.
  expect(FOOD_ICONS.length).toBeGreaterThanOrEqual(30)
  expect(FOOD_ICONS.length).toBeLessThanOrEqual(50)
  expect(new Set(FOOD_ICONS).size).toBe(FOOD_ICONS.length)
})

test('choosing an icon in the sheet reports it and collapses the picker', () => {
  const onChange = vi.fn()
  renderWithI18n(<IconPicker onChange={onChange} />)

  fireEvent.click(screen.getByRole('button', { name: 'Choose icon' }))
  expect(screen.getByRole('dialog', { name: 'Choose an icon' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: '🍕' }))

  expect(onChange).toHaveBeenCalledWith('🍕')
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('choosing another replaces the first', () => {
  const onChange = vi.fn()
  renderWithI18n(<IconPicker value="🍕" onChange={onChange} />)

  fireEvent.click(screen.getByRole('button', { name: 'Change icon' }))
  fireEvent.click(screen.getByRole('button', { name: '🥗' }))

  expect(onChange).toHaveBeenCalledWith('🥗')
})

test('the chosen one says so', () => {
  renderWithI18n(<IconPicker value="🍕" onChange={vi.fn()} />)

  fireEvent.click(screen.getByRole('button', { name: 'Change icon' }))
  expect(screen.getByRole('button', { name: '🍕' }).ariaPressed).toBe('true')
  expect(screen.getByRole('button', { name: '🥗' }).ariaPressed).toBe('false')
})

test('clearing from the sheet reports undefined and collapses it', () => {
  const onChange = vi.fn()
  renderWithI18n(<IconPicker value="🍕" onChange={onChange} />)

  fireEvent.click(screen.getByRole('button', { name: 'Change icon' }))
  fireEvent.click(screen.getByRole('button', { name: 'No icon' }))

  expect(onChange).toHaveBeenCalledWith(undefined)
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('Escape dismisses without changing the icon and restores trigger focus', async () => {
  const onChange = vi.fn()
  renderWithI18n(<IconPicker value="🍕" onChange={onChange} />)

  const trigger = screen.getByRole('button', { name: 'Change icon' })
  fireEvent.click(trigger)
  fireEvent.keyDown(window, { key: 'Escape' })

  expect(onChange).not.toHaveBeenCalled()
  await waitFor(() => expect(trigger).toHaveFocus())
})

test('closing the sheet leaves the icon unchanged and restores trigger focus', async () => {
  const onChange = vi.fn()
  renderWithI18n(<IconPicker value="🍕" onChange={onChange} />)

  const trigger = screen.getByRole('button', { name: 'Change icon' })
  fireEvent.click(trigger)
  fireEvent.click(screen.getByRole('button', { name: 'Close icon picker' }))

  expect(onChange).not.toHaveBeenCalled()
  await waitFor(() => expect(trigger).toHaveFocus())
})

test('dismissing the sheet from its backdrop leaves the icon unchanged and restores trigger focus', async () => {
  const onChange = vi.fn()
  renderWithI18n(<IconPicker value="🍕" onChange={onChange} />)

  const trigger = screen.getByRole('button', { name: 'Change icon' })
  fireEvent.click(trigger)
  const backdrop = screen
    .getByRole('dialog')
    .parentElement?.querySelector<HTMLButtonElement>(
      'button[aria-hidden="true"]',
    )
  if (!backdrop) throw new Error('Icon picker backdrop was not rendered')
  fireEvent.click(backdrop)

  expect(onChange).not.toHaveBeenCalled()
  await waitFor(() => expect(trigger).toHaveFocus())
})

test('pressing the chosen one again clears it', () => {
  const onChange = vi.fn()
  renderWithI18n(<IconPicker value="🍕" onChange={onChange} />)

  fireEvent.click(screen.getByRole('button', { name: 'Change icon' }))
  fireEvent.click(screen.getByRole('button', { name: '🍕' }))

  expect(onChange).toHaveBeenCalledWith(undefined)
})

test('there is nothing to clear until something is chosen', () => {
  renderWithI18n(<IconPicker onChange={vi.fn()} />)

  fireEvent.click(screen.getByRole('button', { name: 'Choose icon' }))

  expect(screen.queryByRole('button', { name: 'No icon' })).toBeNull()
})
