import { fireEvent, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { renderWithI18n } from '../../lib/i18n/testing'
import { FoodForm } from './FoodForm'

test('submits name, brand, base unit, and per-100 nutrition', () => {
  const onSubmit = vi.fn()
  renderWithI18n(<FoodForm onSubmit={onSubmit} submitting={false} />)

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
  renderWithI18n(<FoodForm onSubmit={onSubmit} submitting={false} />)
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
      servings: undefined,
      nutritionPer100: {},
    }),
  )
})

test('prefills from initial values, shows a read-only barcode and source note', () => {
  const onSubmit = vi.fn()
  renderWithI18n(
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

test('servings are typed as a list of named portions', () => {
  const onSubmit = vi.fn()
  renderWithI18n(<FoodForm onSubmit={onSubmit} submitting={false} />)
  fireEvent.change(screen.getByLabelText('Name'), {
    target: { value: 'Wholemeal bread' },
  })
  fireEvent.change(screen.getAllByLabelText('Serving label')[0], {
    target: { value: '1 slice' },
  })
  fireEvent.change(screen.getAllByLabelText('Amount (g)')[0], {
    target: { value: '35' },
  })
  // Typing in the last row offers another, so adding a second is not a step.
  fireEvent.change(screen.getAllByLabelText('Serving label')[1], {
    target: { value: '2 slices' },
  })
  fireEvent.change(screen.getAllByLabelText('Amount (g)')[1], {
    target: { value: '70' },
  })

  fireEvent.click(screen.getByRole('button', { name: /save food/i }))
  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      servings: [
        { label: '1 slice', amount: 35 },
        { label: '2 slices', amount: 70 },
      ],
    }),
  )
})

test('a half-typed serving row is not a serving', () => {
  const onSubmit = vi.fn()
  renderWithI18n(<FoodForm onSubmit={onSubmit} submitting={false} />)
  fireEvent.change(screen.getByLabelText('Name'), {
    target: { value: 'Water' },
  })
  fireEvent.change(screen.getAllByLabelText('Serving label')[0], {
    target: { value: '1 glass' },
  })

  fireEvent.click(screen.getByRole('button', { name: /save food/i }))
  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ servings: undefined }),
  )
})

/**
 * Where the figures came from is part of reading them, so the form says it
 * while somebody is looking at the numbers rather than only afterwards on the
 * food itself. Typing over one changes the answer in front of them — the same
 * conclusion `foods.update` reaches independently when the save lands, which
 * is what keeps the note honest rather than merely reassuring.
 */
test('says where the figures came from, and stops saying it once they are typed over', () => {
  const onSubmit = vi.fn()
  renderWithI18n(
    <FoodForm
      onSubmit={onSubmit}
      submitting={false}
      initial={{
        name: 'Nutella',
        nutritionPer100: { calories: 539 },
        nutritionSource: 'imported',
      }}
    />,
  )
  expect(
    screen.getByText('Where these figures came from: Imported'),
  ).toBeDefined()

  fireEvent.change(screen.getByLabelText('Calories (kcal)'), {
    target: { value: '530' },
  })

  expect(
    screen.getByText('Where these figures came from: Manual'),
  ).toBeDefined()
  fireEvent.click(screen.getByRole('button', { name: /save food/i }))
  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ nutritionSource: 'manual' }),
  )
})

test('an untouched import is still an import when it is saved', () => {
  const onSubmit = vi.fn()
  renderWithI18n(
    <FoodForm
      onSubmit={onSubmit}
      submitting={false}
      initial={{
        name: 'Nutella',
        brand: 'Ferrero',
        nutritionPer100: { calories: 539 },
        nutritionSource: 'imported',
      }}
    />,
  )
  // Editing something that is not a figure says nothing about the figures.
  fireEvent.change(screen.getByLabelText('Brand'), {
    target: { value: 'Ferrero Nederland' },
  })

  fireEvent.click(screen.getByRole('button', { name: /save food/i }))
  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ nutritionSource: 'imported' }),
  )
})

test('says it in Dutch too', () => {
  renderWithI18n(
    <FoodForm
      onSubmit={vi.fn()}
      submitting={false}
      initial={{
        name: 'Nutella',
        nutritionPer100: { calories: 539 },
        nutritionSource: 'ai',
      }}
    />,
    { locale: 'nl' },
  )
  expect(
    screen.getByText('Waar deze waarden vandaan komen: AI-schatting'),
  ).toBeDefined()
})

test('a food with no figures claims no source for them', () => {
  const onSubmit = vi.fn()
  renderWithI18n(<FoodForm onSubmit={onSubmit} submitting={false} />)
  expect(screen.queryByText(/Where these figures came from/)).toBeNull()

  fireEvent.change(screen.getByLabelText('Name'), {
    target: { value: 'Water' },
  })
  fireEvent.click(screen.getByRole('button', { name: /save food/i }))
  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ nutritionSource: undefined }),
  )
})

test('a serving can be taken off again', () => {
  const onSubmit = vi.fn()
  renderWithI18n(
    <FoodForm
      onSubmit={onSubmit}
      submitting={false}
      initial={{
        name: 'Wholemeal bread',
        baseUnit: 'g',
        servings: [{ label: '1 slice', amount: 35 }],
      }}
    />,
  )
  expect(screen.getAllByLabelText('Serving label')[0]).toHaveValue('1 slice')

  fireEvent.click(
    screen.getAllByRole('button', { name: 'Remove this serving' })[0],
  )

  fireEvent.click(screen.getByRole('button', { name: /save food/i }))
  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ servings: undefined }),
  )
})
