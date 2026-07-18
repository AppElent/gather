import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { ConsumptionEntryRow } from './ConsumptionEntryRow'

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
  render(
    <ConsumptionEntryRow entry={entry} onUpdate={vi.fn()} onDelete={vi.fn()} />,
  )
  expect(screen.getByText('Oatmeal')).toBeDefined()
  expect(screen.getByText(/1 serving/)).toBeDefined()
  expect(screen.getByText(/300 kcal/)).toBeDefined()
})

test('clicking Delete calls onDelete', () => {
  const onDelete = vi.fn()
  render(
    <ConsumptionEntryRow
      entry={entry}
      onUpdate={vi.fn()}
      onDelete={onDelete}
    />,
  )
  fireEvent.click(screen.getByText('Delete'))
  expect(onDelete).toHaveBeenCalled()
})

test('shows no source link for a quick-add entry (no recipeId or foodId)', () => {
  render(
    <ConsumptionEntryRow entry={entry} onUpdate={vi.fn()} onDelete={vi.fn()} />,
  )
  expect(screen.queryByText('View recipe')).toBeNull()
  expect(screen.queryByText('View food')).toBeNull()
})

test('shows a View recipe link when recipeId is set', () => {
  render(
    <ConsumptionEntryRow
      entry={{ ...entry, recipeId: 'recipe1' }}
      onUpdate={vi.fn()}
      onDelete={vi.fn()}
    />,
  )
  const link = screen.getByText('View recipe')
  expect(link.closest('a')).toHaveAttribute('href', '/recipes/recipe1')
})

test('shows a View food link when foodId is set', () => {
  render(
    <ConsumptionEntryRow
      entry={{ ...entry, foodId: 'food1' }}
      onUpdate={vi.fn()}
      onDelete={vi.fn()}
    />,
  )
  const link = screen.getByText('View food')
  expect(link.closest('a')).toHaveAttribute('href', '/foods/food1')
})

test('editing quantity and saving calls onUpdate with the new quantity, current meal and date', () => {
  const onUpdate = vi.fn()
  render(
    <ConsumptionEntryRow
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
})

test('an invalid quantity does not call onUpdate', () => {
  const onUpdate = vi.fn()
  render(
    <ConsumptionEntryRow
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
