import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { FoodForm } from './FoodForm'

test('submits name, brand, base unit, and per-100 nutrition', () => {
  const onSubmit = vi.fn()
  render(<FoodForm onSubmit={onSubmit} submitting={false} />)

  fireEvent.change(screen.getByLabelText('Name'), {
    target: { value: 'Hagelslag' },
  })
  fireEvent.change(screen.getByLabelText('Brand'), {
    target: { value: 'De Ruijter' },
  })
  fireEvent.click(screen.getByLabelText('milliliters'))
  fireEvent.change(screen.getByLabelText('Calories (kcal)'), {
    target: { value: '450' },
  })
  fireEvent.click(screen.getByRole('button', { name: /save food/i }))

  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      name: 'Hagelslag',
      brand: 'De Ruijter',
      baseUnit: 'ml',
      nutritionPer100: { calories: 450 },
    }),
  )
})

test('defaults to grams and omits optional fields when left blank', () => {
  const onSubmit = vi.fn()
  render(<FoodForm onSubmit={onSubmit} submitting={false} />)
  fireEvent.change(screen.getByLabelText('Name'), {
    target: { value: 'Water' },
  })
  fireEvent.click(screen.getByRole('button', { name: /save food/i }))
  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      name: 'Water',
      brand: undefined,
      baseUnit: 'g',
      barcode: undefined,
      servingSize: undefined,
      servingLabel: undefined,
      nutritionPer100: {},
    }),
  )
})

test('prefills from initial values, shows a read-only barcode and source note', () => {
  const onSubmit = vi.fn()
  render(
    <FoodForm
      onSubmit={onSubmit}
      submitting={false}
      initial={{
        name: 'Nutella',
        barcode: '3017620422003',
        nutritionPer100: { calories: 539 },
      }}
      sourceNote="From Open Food Facts — review before saving."
    />,
  )
  expect(screen.getByText(/From Open Food Facts/)).toBeDefined()
  expect(screen.getByText('Barcode: 3017620422003')).toBeDefined()
  expect(screen.getByDisplayValue('Nutella')).toBeDefined()
  fireEvent.click(screen.getByRole('button', { name: /save food/i }))
  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      name: 'Nutella',
      barcode: '3017620422003',
      nutritionPer100: { calories: 539 },
    }),
  )
})
