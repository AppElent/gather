import { fireEvent, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import type { OfferedServing } from '../../../convex/lib/servings'
import { renderWithI18n } from '../../lib/i18n/testing'
import {
  initialSelection,
  ServingPicker,
  selectionForAmount,
  toChoice,
} from './ServingPicker'

/**
 * The picker opens on a *choice*, and an editor opens on the choice that
 * already describes the amount the entry recorded — otherwise editing a
 * "1 slice" entry would present it as an anonymous 35 and quietly demote it
 * to a custom amount the moment anything else was touched.
 */

const offered: OfferedServing[] = [
  { label: '1 slice', amount: 35, own: false },
  { label: '2 slices', amount: 70, own: false },
  { label: '20 g', amount: 20, own: true },
]

test('an amount a serving names opens on that serving', () => {
  expect(selectionForAmount(offered, 70)).toEqual({ kind: 'serving', index: 1 })
})

test('an amount only your own logging names opens on that chip', () => {
  expect(selectionForAmount(offered, 20)).toEqual({ kind: 'serving', index: 2 })
})

test('an amount nothing names opens as the custom amount it is', () => {
  expect(selectionForAmount(offered, 43.5)).toEqual({
    kind: 'custom',
    input: '43.5',
    unit: 'base',
  })
})

test('a food with no servings at all opens on its own amount, not on 100', () => {
  expect(selectionForAmount([], 250)).toEqual({
    kind: 'custom',
    input: '250',
    unit: 'base',
  })
  // Which is the one thing `initialSelection` cannot do: logging something new
  // has no amount to open on, so it starts from a default.
  expect(initialSelection([])).toEqual({
    kind: 'custom',
    input: '100',
    unit: 'base',
  })
})

test('what it opens on resolves back to the amount it came from', () => {
  for (const amount of [35, 70, 20, 43.5]) {
    const choice = toChoice(offered, selectionForAmount(offered, amount))
    expect(choice).toBeDefined()
    expect(
      choice?.kind === 'serving' ? choice.serving.amount : choice?.value,
    ).toBe(amount)
  }
})

/**
 * While a save is in flight the picker is locked. The save handler has
 * already captured the amount it is writing, so a chip tapped now would move
 * what is on screen without moving what is being written — and the editor
 * closes over the difference, silently discarding the newer choice.
 */
test('every control is inert while a save is in flight', () => {
  renderWithI18n(
    <ServingPicker
      baseUnit="g"
      offered={offered}
      selection={{ kind: 'custom', input: '250', unit: 'base' }}
      onSelect={vi.fn()}
      disabled
    />,
  )

  for (const button of screen.getAllByRole('button')) {
    expect(button).toBeDisabled()
  }
  expect(screen.getByLabelText('Amount')).toBeDisabled()
})

test('the controls are live when nothing is being saved', () => {
  const onSelect = vi.fn()
  renderWithI18n(
    <ServingPicker
      baseUnit="g"
      offered={offered}
      selection={{ kind: 'serving', index: 0 }}
      onSelect={onSelect}
    />,
  )

  fireEvent.click(screen.getByRole('button', { name: '2 slices' }))
  expect(onSelect).toHaveBeenCalledWith({ kind: 'serving', index: 1 })
})
