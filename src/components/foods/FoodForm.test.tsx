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

test('an imported product with no nutriments claims no source either', () => {
  // Open Food Facts holds plenty of products with a name, a picture and no
  // figures at all. The form is opened as `imported` because the row came from
  // there — but there is nothing for that to be true *of*, and a note over an
  // empty grid reads as though numbers had been supplied.
  renderWithI18n(
    <FoodForm
      onSubmit={vi.fn()}
      submitting={false}
      initial={{
        name: 'Volkoren crackers',
        brand: 'Plus',
        nutritionPer100: {},
        nutritionSource: 'imported',
      }}
    />,
  )
  expect(screen.queryByText(/Where these figures came from/)).toBeNull()
})

test('clearing the last figure takes the source note with it', () => {
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
    target: { value: '' },
  })
  expect(screen.queryByText(/Where these figures came from/)).toBeNull()

  fireEvent.click(screen.getByRole('button', { name: /save food/i }))
  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ nutritionSource: undefined }),
  )
})

/**
 * Open Food Facts holds products with no `product_name` at all, and
 * `mapOffProduct` maps them rather than rejecting them — deliberately leaving
 * the name "to the user on the confirmation screen". This form is that screen
 * (#93), so the one thing it must not do is let a food called "" through.
 */
test('a product Open Food Facts has no name for cannot be saved unnamed', () => {
  const onSubmit = vi.fn()
  renderWithI18n(
    <FoodForm
      onSubmit={onSubmit}
      submitting={false}
      initial={{
        name: '',
        brand: 'Plus',
        barcode: '8712345678901',
        nutritionPer100: { calories: 78 },
        nutritionSource: 'imported',
      }}
      sourceNote="From Open Food Facts — review before saving."
    />,
  )
  // It arrives with the name empty and asked for, rather than filled in with
  // something nobody chose.
  const name = screen.getByLabelText('Name')
  expect(name).toHaveValue('')
  expect(name).toBeRequired()
  expect(name).toBeInvalid()

  fireEvent.click(screen.getByRole('button', { name: /save food/i }))
  expect(onSubmit).not.toHaveBeenCalled()

  fireEvent.change(name, { target: { value: 'Volkoren crackers' } })
  fireEvent.click(screen.getByRole('button', { name: /save food/i }))
  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      name: 'Volkoren crackers',
      barcode: '8712345678901',
      nutritionSource: 'imported',
    }),
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

/**
 * The icon (#94). This form is also the Open Food Facts review screen (#93),
 * which is where an icon is most obviously missing: their products carry a
 * photograph or they carry nothing at all.
 */
test('an icon picked while reviewing is part of what is saved', () => {
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
      sourceNote="From Open Food Facts — review before saving."
    />,
  )

  fireEvent.click(screen.getByRole('button', { name: '🍫' }))
  fireEvent.click(screen.getByRole('button', { name: /save food/i }))

  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ icon: '🍫', nutritionSource: 'imported' }),
  )
})

test('a food that had one opens holding it, and can be given another', () => {
  const onSubmit = vi.fn()
  renderWithI18n(
    <FoodForm
      onSubmit={onSubmit}
      submitting={false}
      initial={{ name: 'Melk', icon: '🥛', nutritionPer100: {} }}
    />,
  )
  expect(screen.getByRole('button', { name: '🥛' }).ariaPressed).toBe('true')

  fireEvent.click(screen.getByRole('button', { name: '🧀' }))
  fireEvent.click(screen.getByRole('button', { name: /save food/i }))

  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ icon: '🧀' }))
})

// Nothing rather than '': an empty string is set as far as the tile's fallback
// chain can tell, and would render a blank square in front of the glyph.
test('clearing one submits no icon at all', () => {
  const onSubmit = vi.fn()
  renderWithI18n(
    <FoodForm
      onSubmit={onSubmit}
      submitting={false}
      initial={{ name: 'Melk', icon: '🥛', nutritionPer100: {} }}
    />,
  )

  fireEvent.click(screen.getByRole('button', { name: 'No icon' }))
  fireEvent.click(screen.getByRole('button', { name: /save food/i }))

  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ icon: undefined }),
  )
})

test('a food nobody gave an icon submits none', () => {
  const onSubmit = vi.fn()
  renderWithI18n(<FoodForm onSubmit={onSubmit} submitting={false} />)
  fireEvent.change(screen.getByLabelText('Name'), {
    target: { value: 'Water' },
  })
  fireEvent.click(screen.getByRole('button', { name: /save food/i }))

  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ icon: undefined }),
  )
})
