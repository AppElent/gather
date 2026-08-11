import { fireEvent, screen, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
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

const entry = {
  _id: 'entry1',
  label: 'Oatmeal',
  quantity: 1,
  quantityUnit: 'serving' as const,
  meal: 'breakfast' as const,
  date: '2026-07-18',
  nutrition: { calories: 300 },
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
