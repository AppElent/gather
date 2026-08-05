import { fireEvent, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { renderWithI18n } from '../../lib/i18n/testing'
import { MealSlot } from './MealSlot'
import { groupNutritionNav } from './nutritionNav'

const nav = groupNutritionNav('jansen-household')

const entries = [
  {
    _id: 'e1',
    label: 'Oatmeal',
    quantity: 1,
    quantityUnit: 'serving' as const,
    meal: 'breakfast' as const,
    date: '2026-07-18',
    nutrition: { calories: 300 },
  },
]

test('shows a placeholder when there are no entries', () => {
  renderWithI18n(
    <MealSlot
      nav={nav}
      label="Breakfast"
      entries={[]}
      onAdd={vi.fn()}
      onUpdateEntry={vi.fn()}
      onDeleteEntry={vi.fn()}
    />,
  )
  expect(screen.getByText('Nothing logged yet.')).toBeDefined()
})

test('renders entries and clicking + Add calls onAdd', () => {
  const onAdd = vi.fn()
  renderWithI18n(
    <MealSlot
      nav={nav}
      label="Breakfast"
      entries={entries}
      onAdd={onAdd}
      onUpdateEntry={vi.fn()}
      onDeleteEntry={vi.fn()}
    />,
  )
  expect(screen.getByText('Oatmeal')).toBeDefined()
  fireEvent.click(screen.getByText('+ Add'))
  expect(onAdd).toHaveBeenCalled()
})

test('deleting an entry calls onDeleteEntry with its id', () => {
  const onDeleteEntry = vi.fn()
  renderWithI18n(
    <MealSlot
      nav={nav}
      label="Breakfast"
      entries={entries}
      onAdd={vi.fn()}
      onUpdateEntry={vi.fn()}
      onDeleteEntry={onDeleteEntry}
    />,
  )
  fireEvent.click(screen.getByText('Delete'))
  expect(onDeleteEntry).toHaveBeenCalledWith('e1')
})
