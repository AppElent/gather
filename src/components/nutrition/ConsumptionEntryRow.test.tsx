import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { renderWithI18n } from '../../lib/i18n/testing'
import { ConsumptionEntryRow } from './ConsumptionEntryRow'
import { groupNutritionNav } from './nutritionNav'

const nav = groupNutritionNav('jansen-household')

// TanStack Router's <Link> requires a RouterProvider context to render (it
// reads router state via useLinkProps); this component test renders in
// isolation, so mock it out to a plain anchor, matching the same pattern
// used in AppShell.test.tsx / CommandFeed.test.tsx / PublicPageFrame.test.tsx.
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    className,
  }: {
    children: React.ReactNode
    to: string
    params?: Record<string, string>
    className?: string
  }) => {
    const href = params
      ? Object.entries(params).reduce(
          (path, [key, value]) => path.replace(`$${key}`, value),
          to,
        )
      : to
    return (
      <a href={href} className={className}>
        {children}
      </a>
    )
  },
}))

/**
 * The food an entry points at, as `foods.get` answers it: `undefined` while the
 * query is in flight, `null` for a food that is not there any more.
 */
const food = vi.hoisted(() => ({ value: undefined as unknown }))
/** What this person has logged for that food before — their own amounts (#68). */
const loggedAmounts = vi.hoisted(() => ({
  value: [] as Array<{ label: string; amount: number }>,
}))

vi.mock('convex/react', () => ({
  useQuery: (name: string) => {
    if (name === 'foods:get') return food.value
    if (name === 'consumption:loggedAmountsForFood') return loggedAmounts.value
    return undefined
  },
}))

vi.mock('../../../convex/_generated/api', () => ({
  api: {
    foods: { get: 'foods:get' },
    consumption: { loggedAmountsForFood: 'consumption:loggedAmountsForFood' },
  },
}))

beforeEach(() => {
  food.value = undefined
  loggedAmounts.value = []
})

const entry = {
  _id: 'entry1',
  label: 'Oatmeal',
  quantity: 1,
  quantityUnit: 'serving' as const,
  meal: 'breakfast' as const,
  date: '2026-07-18',
  nutrition: { calories: 300 },
}

/** A Catalog food: authored servings, owned by nobody, editable by nobody. */
const CATALOG_BREAD = {
  _id: 'food2',
  name: 'Volkorenbrood',
  baseUnit: 'g' as const,
  nutritionPer100: { calories: 250 },
  servings: [
    { label: '1 slice', amount: 35 },
    { label: '2 slices', amount: 70 },
  ],
  seedKey: 'bread-wholemeal',
}

/** A food somebody added themselves, with no named servings at all. */
const MY_YOGHURT = {
  _id: 'food3',
  name: 'Yoghurt',
  baseUnit: 'ml' as const,
  nutritionPer100: { calories: 60 },
  createdBy: 'user1',
}

/** One slice of the Catalog bread, as the add sheet would have written it. */
const breadEntry = {
  ...entry,
  label: 'Volkorenbrood',
  foodId: 'food2',
  quantity: 35,
  quantityUnit: 'g' as const,
  nutrition: { calories: 87.5 },
}

function renderRow(
  props: Partial<Parameters<typeof ConsumptionEntryRow>[0]> = {},
) {
  return renderWithI18n(
    <ConsumptionEntryRow
      nav={nav}
      entry={entry}
      onUpdate={vi.fn()}
      onDelete={vi.fn()}
      {...props}
    />,
  )
}

test('renders label, quantity, unit, and calories', () => {
  renderWithI18n(
    <ConsumptionEntryRow
      nav={nav}
      entry={entry}
      onUpdate={vi.fn()}
      onDelete={vi.fn()}
    />,
  )
  expect(screen.getByText('Oatmeal')).toBeDefined()
  expect(screen.getByText(/1 serving/)).toBeDefined()
  expect(screen.getByText(/300 kcal/)).toBeDefined()
})

test('clicking Delete calls onDelete', () => {
  const onDelete = vi.fn()
  renderWithI18n(
    <ConsumptionEntryRow
      nav={nav}
      entry={entry}
      onUpdate={vi.fn()}
      onDelete={onDelete}
    />,
  )
  fireEvent.click(screen.getByText('Delete'))
  expect(onDelete).toHaveBeenCalled()
})

test('shows no source link for a quick-add entry (no recipeId or foodId)', () => {
  renderWithI18n(
    <ConsumptionEntryRow
      nav={nav}
      entry={entry}
      onUpdate={vi.fn()}
      onDelete={vi.fn()}
    />,
  )
  expect(screen.queryByText('View recipe')).toBeNull()
  expect(screen.queryByText('View food')).toBeNull()
})

test('shows a View recipe link when recipeId is set', () => {
  renderWithI18n(
    <ConsumptionEntryRow
      nav={nav}
      entry={{ ...entry, recipeId: 'recipe1' }}
      onUpdate={vi.fn()}
      onDelete={vi.fn()}
    />,
  )
  const link = screen.getByText('View recipe')
  expect(link.closest('a')).toHaveAttribute(
    'href',
    '/g/jansen-household/recipes/recipe1',
  )
})

test('shows a View food link when foodId is set', () => {
  renderWithI18n(
    <ConsumptionEntryRow
      nav={nav}
      entry={{ ...entry, foodId: 'food1' }}
      onUpdate={vi.fn()}
      onDelete={vi.fn()}
    />,
  )
  const link = screen.getByText('View food')
  expect(link.closest('a')).toHaveAttribute(
    'href',
    '/g/jansen-household/foods/food1',
  )
})

test('editing quantity and saving calls onUpdate with the new quantity, current meal and date', async () => {
  const onUpdate = vi.fn().mockResolvedValue(undefined)
  renderWithI18n(
    <ConsumptionEntryRow
      nav={nav}
      entry={entry}
      onUpdate={onUpdate}
      onDelete={vi.fn()}
    />,
  )
  fireEvent.click(screen.getByText('Edit'))
  fireEvent.change(screen.getByDisplayValue('1'), { target: { value: '2' } })
  fireEvent.click(screen.getByText('Save'))
  expect(onUpdate).toHaveBeenCalledWith({
    quantity: 2,
    meal: 'breakfast',
    date: '2026-07-18',
  })
  // Editing closes only after the mutation resolves.
  await waitFor(() => expect(screen.queryByText('Save')).toBeNull())
})

test('a failed save keeps the row in edit mode and shows an error', async () => {
  const onUpdate = vi.fn().mockRejectedValue(new Error('Network error'))
  renderWithI18n(
    <ConsumptionEntryRow
      nav={nav}
      entry={entry}
      onUpdate={onUpdate}
      onDelete={vi.fn()}
    />,
  )
  fireEvent.click(screen.getByText('Edit'))
  fireEvent.click(screen.getByText('Save'))
  await waitFor(() => expect(screen.getByText('Network error')).toBeDefined())
  expect(screen.getByText('Save')).toBeDefined()
})

/**
 * The diary row is the whole argument for decorating a one-off (#94): it is
 * logged once and never reused, so this is the only place the icon is ever
 * seen. An entry that was given none reads exactly as it did before.
 */
test('a one-off shows the icon it was logged with', () => {
  renderWithI18n(
    <ConsumptionEntryRow
      nav={nav}
      entry={{ ...entry, label: 'Poffertjes at the fair', icon: '🍬' }}
      onUpdate={vi.fn()}
      onDelete={vi.fn()}
    />,
  )
  expect(screen.getByText('🍬')).toBeDefined()
  expect(screen.getByText('Poffertjes at the fair')).toBeDefined()
})

test('a food entry uses the food icon when it has no photograph', () => {
  renderWithI18n(
    <ConsumptionEntryRow
      nav={nav}
      entry={{
        ...entry,
        foodId: 'food1',
        sourceIcon: '🥣',
        thumbnailKind: 'food',
      }}
      onUpdate={vi.fn()}
      onDelete={vi.fn()}
    />,
  )

  expect(screen.getByText('🥣')).toBeDefined()
})

test('a one-off with no icon falls back to the food glyph', () => {
  renderWithI18n(
    <ConsumptionEntryRow
      nav={nav}
      entry={entry}
      onUpdate={vi.fn()}
      onDelete={vi.fn()}
    />,
  )
  expect(screen.getByText('🍽')).toBeDefined()
})

/**
 * The tick that puts a row into a Combo being saved (#99). It is named after
 * the row rather than "select", because a screen reader hears it out of the
 * column it is in.
 */
test('a selectable row offers a tick named after what it holds', () => {
  const onChange = vi.fn()
  renderWithI18n(
    <ConsumptionEntryRow
      nav={nav}
      entry={entry}
      selection={{ selected: false, onChange }}
      onUpdate={vi.fn()}
      onDelete={vi.fn()}
    />,
  )
  const box = screen.getByLabelText('Include Oatmeal') as HTMLInputElement
  expect(box.checked).toBe(false)
  fireEvent.click(box)
  expect(onChange).toHaveBeenCalledWith(true)
})

test('a row nobody is choosing from has no tick at all', () => {
  renderWithI18n(
    <ConsumptionEntryRow
      nav={nav}
      entry={entry}
      onUpdate={vi.fn()}
      onDelete={vi.fn()}
    />,
  )
  expect(screen.queryByRole('checkbox')).toBeNull()
})

test('an invalid quantity does not call onUpdate', () => {
  const onUpdate = vi.fn()
  renderWithI18n(
    <ConsumptionEntryRow
      nav={nav}
      entry={entry}
      onUpdate={onUpdate}
      onDelete={vi.fn()}
    />,
  )
  fireEvent.click(screen.getByText('Edit'))
  fireEvent.change(screen.getByDisplayValue('1'), { target: { value: '0' } })
  fireEvent.click(screen.getByText('Save'))
  expect(onUpdate).not.toHaveBeenCalled()
})

/**
 * Editing a food entry is the same question as logging one (#102): the amount
 * is *chosen*, from what the food declares, from what you have logged before,
 * or as a plain amount you type. What is stored stays what was always stored —
 * one canonical amount in the food's base unit — and the nutrition is
 * recomputed from the food on the server, not sent along from here.
 */
test('a food entry offers the servings the food declares, opening on the one it recorded', () => {
  food.value = CATALOG_BREAD
  renderRow({ entry: breadEntry })

  fireEvent.click(screen.getByText('Edit'))
  expect(screen.getByRole('button', { name: '1 slice' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(screen.getByRole('button', { name: '2 slices' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  expect(screen.getByRole('button', { name: 'Custom' })).toBeDefined()
})

test('a food entry can be changed to an authored named serving', () => {
  food.value = CATALOG_BREAD
  const onUpdate = vi.fn().mockResolvedValue(undefined)
  renderRow({ entry: breadEntry, onUpdate })

  fireEvent.click(screen.getByText('Edit'))
  fireEvent.click(screen.getByRole('button', { name: '2 slices' }))
  fireEvent.click(screen.getByText('Save'))

  expect(onUpdate).toHaveBeenCalledWith({
    quantity: 70,
    meal: 'breakfast',
    date: '2026-07-18',
  })
})

test('a food entry can be changed to an amount it was logged with before', () => {
  food.value = CATALOG_BREAD
  loggedAmounts.value = [{ label: '20 g', amount: 20 }]
  const onUpdate = vi.fn().mockResolvedValue(undefined)
  renderRow({ entry: breadEntry, onUpdate })

  fireEvent.click(screen.getByText('Edit'))
  const own = screen.getByRole('button', { name: /20 g/ })
  expect(own.textContent).toContain('(yours)')
  fireEvent.click(own)
  fireEvent.click(screen.getByText('Save'))

  expect(onUpdate).toHaveBeenCalledWith({
    quantity: 20,
    meal: 'breakfast',
    date: '2026-07-18',
  })
})

test('a food entry can be changed to a custom base-unit amount', () => {
  food.value = CATALOG_BREAD
  const onUpdate = vi.fn().mockResolvedValue(undefined)
  renderRow({ entry: breadEntry, onUpdate })

  fireEvent.click(screen.getByText('Edit'))
  fireEvent.click(screen.getByRole('button', { name: 'Custom' }))
  fireEvent.change(screen.getByLabelText('Amount'), {
    target: { value: '45' },
  })
  fireEvent.click(screen.getByText('Save'))

  expect(onUpdate).toHaveBeenCalledWith({
    quantity: 45,
    meal: 'breakfast',
    date: '2026-07-18',
  })
})

test('a food with no named servings still edits by a custom base-unit amount', () => {
  food.value = MY_YOGHURT
  const onUpdate = vi.fn().mockResolvedValue(undefined)
  const yoghurt = {
    ...entry,
    label: 'Yoghurt',
    foodId: 'food3',
    quantity: 250,
    quantityUnit: 'ml' as const,
    nutrition: { calories: 150 },
  }
  renderRow({ entry: yoghurt, onUpdate })

  fireEvent.click(screen.getByText('Edit'))
  // Nothing to choose from, so it opens on the amount it recorded rather than
  // on the default a fresh log would start from.
  expect(screen.getByLabelText('Amount')).toHaveValue('250')
  fireEvent.change(screen.getByLabelText('Amount'), {
    target: { value: '200' },
  })
  fireEvent.click(screen.getByText('Save'))

  expect(onUpdate).toHaveBeenCalledWith({
    quantity: 200,
    meal: 'breakfast',
    date: '2026-07-18',
  })
})

test.each([
  '0',
  '-5',
  'abc',
  '',
])('a food entry refuses the amount %p, exactly as the numeric editor always did', (typed) => {
  food.value = CATALOG_BREAD
  const onUpdate = vi.fn()
  renderRow({ entry: breadEntry, onUpdate })

  fireEvent.click(screen.getByText('Edit'))
  fireEvent.click(screen.getByRole('button', { name: 'Custom' }))
  fireEvent.change(screen.getByLabelText('Amount'), {
    target: { value: typed },
  })
  fireEvent.click(screen.getByText('Save'))

  expect(onUpdate).not.toHaveBeenCalled()
})

/**
 * A recipe entry counts servings of the recipe, and there is nothing to choose
 * from — the servings a food declares are amounts of a food.
 */
test('a recipe entry still edits by servings', () => {
  const onUpdate = vi.fn().mockResolvedValue(undefined)
  renderRow({ entry: { ...entry, recipeId: 'recipe1' }, onUpdate })

  fireEvent.click(screen.getByText('Edit'))
  expect(screen.queryByRole('button', { name: 'Custom' })).toBeNull()
  fireEvent.change(screen.getByDisplayValue('1'), { target: { value: '2' } })
  fireEvent.click(screen.getByText('Save'))

  expect(onUpdate).toHaveBeenCalledWith({
    quantity: 2,
    meal: 'breakfast',
    date: '2026-07-18',
  })
})

/**
 * A food that is gone leaves nothing to choose from, so the plain amount field
 * is what is left — and the server scales the snapshot it already has, which is
 * the fallback that was always there.
 */
test('a food entry whose food is gone keeps the plain amount field', () => {
  food.value = null
  const onUpdate = vi.fn().mockResolvedValue(undefined)
  renderRow({ entry: breadEntry, onUpdate })

  fireEvent.click(screen.getByText('Edit'))
  expect(screen.queryByRole('button', { name: 'Custom' })).toBeNull()
  fireEvent.change(screen.getByDisplayValue('35'), { target: { value: '50' } })
  fireEvent.click(screen.getByText('Save'))

  expect(onUpdate).toHaveBeenCalledWith({
    quantity: 50,
    meal: 'breakfast',
    date: '2026-07-18',
  })
})

/**
 * An entry counted in the food's *portions* rather than its base unit — the
 * shape the sample household seeds, and so the shape most people meet first.
 *
 * It used to keep the plain grams box, on the grounds that its number counts
 * something the chips do not. But a piece *is* an amount: `quantity` lots of
 * the food's first serving. Leaving it out meant the seeded diary showed the
 * old editor and a freshly logged food showed the new one, which is what was
 * reported on #126. It converts, so it is offered.
 */
test('a food entry counted in pieces is offered the servings too', () => {
  food.value = CATALOG_BREAD
  renderRow({
    entry: { ...breadEntry, quantity: 2, quantityUnit: 'piece' as const },
  })

  fireEvent.click(screen.getByText('Edit'))
  // 2 pieces of a food whose first serving is 35 g is 70 g, which is exactly
  // what "2 slices" names — so that is the chip it opens on.
  expect(
    screen
      .getByRole('button', { name: '2 slices' })
      .getAttribute('aria-pressed'),
  ).toBe('true')
})

test('re-choosing a piece entry moves it onto the food’s base unit', async () => {
  food.value = CATALOG_BREAD
  const onUpdate = vi.fn().mockResolvedValue(undefined)
  renderRow({
    entry: { ...breadEntry, quantity: 2, quantityUnit: 'piece' as const },
    onUpdate,
  })

  fireEvent.click(screen.getByText('Edit'))
  fireEvent.click(screen.getByRole('button', { name: '1 slice' }))
  fireEvent.click(screen.getByText('Save'))

  // The picker answers in grams, so the entry has to stop counting pieces —
  // otherwise 35 would be reread as 35 portions.
  await waitFor(() =>
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 35, quantityUnit: 'g' }),
    ),
  )
})

test('a piece entry whose food declares no serving keeps the plain field', () => {
  // Nothing to count, so the number converts to nothing and the chips would
  // be answering a different question than the one on screen.
  food.value = MY_YOGHURT
  renderRow({
    entry: {
      ...breadEntry,
      foodId: MY_YOGHURT._id,
      quantity: 2,
      quantityUnit: 'piece' as const,
    },
  })

  fireEvent.click(screen.getByText('Edit'))
  expect(screen.queryByRole('button', { name: 'Custom' })).toBeNull()
  expect(screen.getByDisplayValue('2')).toBeDefined()
})

test('editing an entry already in base units does not send a unit', async () => {
  food.value = CATALOG_BREAD
  const onUpdate = vi.fn().mockResolvedValue(undefined)
  renderRow({ entry: breadEntry, onUpdate })

  fireEvent.click(screen.getByText('Edit'))
  fireEvent.click(screen.getByRole('button', { name: '2 slices' }))
  fireEvent.click(screen.getByText('Save'))

  await waitFor(() => expect(onUpdate).toHaveBeenCalled())
  expect(onUpdate.mock.calls[0][0].quantityUnit).toBeUndefined()
})

/**
 * A Combo expands to the entries it was made from, so saving one changes the
 * rows underneath without changing how they read. The badge is the only thing
 * that says it happened (#99).
 */
test('a row a Combo logged is badged with its name', () => {
  renderWithI18n(
    <ConsumptionEntryRow
      nav={nav}
      entry={{ ...entry, comboLabel: 'Usual breakfast' }}
      onUpdate={vi.fn()}
      onDelete={vi.fn()}
    />,
  )
  expect(screen.getByText('Usual breakfast')).toBeDefined()
  expect(
    screen.getByTitle('Logged by the combo “Usual breakfast”'),
  ).toBeDefined()
})

test('a row logged one thing at a time carries no badge', () => {
  renderWithI18n(
    <ConsumptionEntryRow
      nav={nav}
      entry={entry}
      onUpdate={vi.fn()}
      onDelete={vi.fn()}
    />,
  )
  expect(screen.queryByTitle(/Logged by the combo/)).toBeNull()
})
