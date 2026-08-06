import { fireEvent, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { renderWithI18n } from '../../lib/i18n/testing'
import { NutritionTargetsForm } from './NutritionTargetsSettings'

test('shows the nutrient grid without anything to expand first', () => {
  renderWithI18n(<NutritionTargetsForm saving={false} onSave={vi.fn()} />)
  expect(screen.getByText('Daily targets')).toBeDefined()
  expect(screen.getByText('Calories (kcal)')).toBeDefined()
})

test('prefills from targets and calls onSave with parsed values', () => {
  const onSave = vi.fn()
  renderWithI18n(
    <NutritionTargetsForm
      targets={{ calories: 2000 }}
      saving={false}
      onSave={onSave}
    />,
  )
  expect(screen.getByLabelText('Calories (kcal)')).toHaveValue('2000')
  fireEvent.change(screen.getByLabelText('Protein (g)'), {
    target: { value: '120' },
  })
  fireEvent.click(screen.getByRole('button', { name: /save targets/i }))
  expect(onSave).toHaveBeenCalledWith({ calories: 2000, protein: 120 })
})

test('syncs the form when targets arrives after mount (e.g. the parent query was still loading)', () => {
  const { rerender } = renderWithI18n(
    <NutritionTargetsForm saving={false} onSave={vi.fn()} />,
  )
  expect(screen.getByLabelText('Calories (kcal)')).toHaveValue('')
  rerender(
    <NutritionTargetsForm
      targets={{ calories: 1800 }}
      saving={false}
      onSave={vi.fn()}
    />,
  )
  expect(screen.getByLabelText('Calories (kcal)')).toHaveValue('1800')
})

test('reports a failed save where the person just pressed save', () => {
  renderWithI18n(
    <NutritionTargetsForm
      saving={false}
      error="Could not save targets"
      onSave={vi.fn()}
    />,
  )
  expect(screen.getByText('Could not save targets')).toBeDefined()
})
