import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { NutrientInputGrid } from './NutrientInputGrid'
import { toNutrientInputs } from './nutrientInputs'

test('renders a labeled input per nutrient and calls onChange with the key', () => {
  const onChange = vi.fn()
  render(
    <NutrientInputGrid
      values={toNutrientInputs(undefined)}
      onChange={onChange}
    />,
  )
  fireEvent.change(screen.getByLabelText('Calories (kcal)'), {
    target: { value: '520' },
  })
  expect(onChange).toHaveBeenCalledWith('calories', '520')
})

test('disables every input when disabled is true', () => {
  render(
    <NutrientInputGrid
      values={toNutrientInputs(undefined)}
      onChange={vi.fn()}
      disabled
    />,
  )
  expect(screen.getByLabelText('Calories (kcal)')).toBeDisabled()
  expect(screen.getByLabelText('Salt (g)')).toBeDisabled()
})
