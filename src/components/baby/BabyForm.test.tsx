import type { BabyBarSlot } from '@gather/core/domain'
import { fireEvent, screen, within } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { renderWithI18n } from '../../lib/i18n/testing'
import { BabyForm, type BabyFormValues } from './BabyForm'

function renderForm(
  initial: Partial<BabyFormValues> = {},
  ordersBar = true,
): ReturnType<typeof vi.fn> {
  const onSubmit = vi.fn()
  renderWithI18n(
    <BabyForm
      initial={{ name: 'Sam', birthDate: '2026-01-02', ...initial }}
      submitting={false}
      ordersBar={ordersBar}
      onSubmit={onSubmit}
    />,
  )
  return onSubmit
}

function barRows(): string[] {
  const list = screen.getByRole('list')
  return within(list)
    .getAllByRole('listitem')
    .map((row) => row.textContent?.replace(/^\d+/, '') ?? '')
}

function save(onSubmit: ReturnType<typeof vi.fn>): BabyFormValues {
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(onSubmit).toHaveBeenCalledTimes(1)
  return onSubmit.mock.calls[0][0] as BabyFormValues
}

const stored: BabyBarSlot[] = [
  'question',
  'feeding',
  'todo',
  'diaper',
  'sleep',
]

test('lists the tracked types in the stored order, without the shortcuts', () => {
  renderForm({
    untrackedTypes: [
      'temperature',
      'growth',
      'medication',
      'vaccination',
      'note',
      'memory',
    ],
    barOrder: stored,
  })
  expect(screen.getByText('Order on the log bar')).toBeDefined()
  expect(barRows()).toEqual(['Feeding', 'Diaper', 'Sleep'])
})

test('moves a type with its arrows and saves it around the shortcuts', () => {
  const onSubmit = renderForm({
    untrackedTypes: [
      'temperature',
      'growth',
      'medication',
      'vaccination',
      'note',
      'memory',
    ],
    barOrder: stored,
  })

  fireEvent.click(screen.getByRole('button', { name: 'Move Sleep up' }))
  fireEvent.click(screen.getByRole('button', { name: 'Move Sleep up' }))
  expect(barRows()).toEqual(['Sleep', 'Feeding', 'Diaper'])
  expect(screen.getByRole('status').textContent).toBe(
    'Sleep moved to position 1 of 3',
  )

  // The to-do and the question stay in the slots they held on the phone.
  expect(save(onSubmit).barOrder).toEqual([
    'question',
    'sleep',
    'todo',
    'feeding',
    'diaper',
  ])
})

test('the arrow at an end is disabled and focus moves to the other one', () => {
  renderForm({
    untrackedTypes: [
      'temperature',
      'growth',
      'medication',
      'vaccination',
      'note',
      'memory',
    ],
    barOrder: stored,
  })
  const up = screen.getByRole('button', { name: 'Move Diaper up' })
  up.focus()
  fireEvent.click(up)
  expect(
    (screen.getByRole('button', { name: 'Move Diaper up' }) as HTMLButtonElement)
      .disabled,
  ).toBe(true)
  expect(document.activeElement).toBe(
    screen.getByRole('button', { name: 'Move Diaper down' }),
  )
})

test('turning a type off takes it off the order, and the save drops it', () => {
  const onSubmit = renderForm({
    untrackedTypes: [
      'temperature',
      'growth',
      'medication',
      'vaccination',
      'note',
      'memory',
    ],
    barOrder: stored,
  })
  fireEvent.click(screen.getByRole('checkbox', { name: /Diaper/ }))
  expect(barRows()).toEqual(['Feeding', 'Sleep'])
  expect(save(onSubmit).barOrder).toEqual([
    'question',
    'feeding',
    'todo',
    'sleep',
  ])
})

test('a child with no arrangement saves both shortcuts last', () => {
  const onSubmit = renderForm({
    untrackedTypes: [
      'temperature',
      'growth',
      'medication',
      'vaccination',
      'note',
      'memory',
      'sleep',
    ],
  })
  fireEvent.click(screen.getByRole('button', { name: 'Move Diaper up' }))
  expect(save(onSubmit).barOrder).toEqual([
    'diaper',
    'feeding',
    'todo',
    'question',
  ])
})

test('the create form neither shows nor sends an order', () => {
  const onSubmit = renderForm({}, false)
  expect(screen.queryByText('Order on the log bar')).toBeNull()
  expect(save(onSubmit)).not.toHaveProperty('barOrder')
})
