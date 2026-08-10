import { fireEvent, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { renderWithI18n } from '../../lib/i18n/testing'
import { MealSlot } from './MealSlot'
import { groupNutritionNav } from './nutritionNav'

// TanStack Router's <Link> requires a RouterProvider context to render (it
// reads router state via useLinkProps); this component test renders in
// isolation, so mock it out to a plain anchor, matching the same pattern used
// in ConsumptionEntryRow.test.tsx / AppShell.test.tsx.
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    search,
    className,
  }: {
    children: React.ReactNode
    to: string
    params?: Record<string, string>
    search?: Record<string, string>
    className?: string
  }) => {
    const path = params
      ? Object.entries(params).reduce(
          (acc, [key, value]) => acc.replace(`$${key}`, value),
          to,
        )
      : to
    const query = search ? `?${new URLSearchParams(search).toString()}` : ''
    return (
      <a href={`${path}${query}`} className={className}>
        {children}
      </a>
    )
  },
}))

const nav = groupNutritionNav('jansen-household')
const addLink = nav.addEntry('2026-07-18', 'breakfast')

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
      addLink={addLink}
      onUpdateEntry={vi.fn()}
      onDeleteEntry={vi.fn()}
    />,
  )
  expect(screen.getByText('Nothing logged yet.')).toBeDefined()
})

test('renders entries, and + Add goes to the add sheet for this day and meal', () => {
  renderWithI18n(
    <MealSlot
      nav={nav}
      label="Breakfast"
      entries={entries}
      addLink={addLink}
      onUpdateEntry={vi.fn()}
      onDeleteEntry={vi.fn()}
    />,
  )
  expect(screen.getByText('Oatmeal')).toBeDefined()
  expect(screen.getByRole('link', { name: '+ Add' })).toHaveAttribute(
    'href',
    '/g/jansen-household/nutrition/add?date=2026-07-18&meal=breakfast',
  )
})

test('shows a kcal subtotal for the meal, summing the entries on show', () => {
  renderWithI18n(
    <MealSlot
      nav={nav}
      label="Breakfast"
      entries={[
        ...entries,
        {
          _id: 'e2',
          label: 'Banana',
          quantity: 1,
          quantityUnit: 'piece' as const,
          meal: 'breakfast' as const,
          date: '2026-07-18',
          // No calories on this one: a partial snapshot still contributes what
          // it has, and the entries that do have kcal still add up.
          nutrition: { protein: 1.3 },
        },
        {
          _id: 'e3',
          label: 'Yoghurt',
          quantity: 150,
          quantityUnit: 'g' as const,
          meal: 'breakfast' as const,
          date: '2026-07-18',
          nutrition: { calories: 97.5 },
        },
      ]}
      addLink={addLink}
      onUpdateEntry={vi.fn()}
      onDeleteEntry={vi.fn()}
    />,
  )
  expect(screen.getByText('397.5 kcal')).toBeDefined()
})

test('shows no subtotal when nothing in the meal has calories', () => {
  renderWithI18n(
    <MealSlot
      nav={nav}
      label="Breakfast"
      entries={[
        {
          _id: 'e2',
          label: 'Banana',
          quantity: 1,
          quantityUnit: 'piece' as const,
          meal: 'breakfast' as const,
          date: '2026-07-18',
          nutrition: { protein: 1.3 },
        },
      ]}
      addLink={addLink}
      onUpdateEntry={vi.fn()}
      onDeleteEntry={vi.fn()}
    />,
  )
  expect(screen.queryByText(/kcal/)).toBeNull()
})

test('shows no subtotal for an empty meal', () => {
  renderWithI18n(
    <MealSlot
      nav={nav}
      label="Breakfast"
      entries={[]}
      addLink={addLink}
      onUpdateEntry={vi.fn()}
      onDeleteEntry={vi.fn()}
    />,
  )
  expect(screen.queryByText(/kcal/)).toBeNull()
})

test('deleting an entry calls onDeleteEntry with its id', () => {
  const onDeleteEntry = vi.fn()
  renderWithI18n(
    <MealSlot
      nav={nav}
      label="Breakfast"
      entries={entries}
      addLink={addLink}
      onUpdateEntry={vi.fn()}
      onDeleteEntry={onDeleteEntry}
    />,
  )
  fireEvent.click(screen.getByText('Delete'))
  expect(onDeleteEntry).toHaveBeenCalledWith('e1')
})
