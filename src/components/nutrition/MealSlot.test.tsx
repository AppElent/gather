import { fireEvent, screen, waitFor } from '@testing-library/react'
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

const twoEntries = [
  entries[0],
  {
    _id: 'e2',
    label: 'Coffee',
    quantity: 1,
    quantityUnit: 'piece' as const,
    meal: 'breakfast' as const,
    date: '2026-07-18',
    nutrition: { calories: 5 },
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
    '/nutrition/add?date=2026-07-18&meal=breakfast',
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
  // 300 + 97.5 = 397.5, shown as a whole number: a fraction of a kcal is noise
  // nobody acts on, and the stored figure keeps its decimals either way.
  expect(screen.getByText('398 kcal')).toBeDefined()
})

test('rounds the subtotal to a whole number rather than showing decimals', () => {
  renderWithI18n(
    <MealSlot
      nav={nav}
      label="Breakfast"
      entries={[
        {
          _id: 'e1',
          label: 'Muesli',
          quantity: 60,
          quantityUnit: 'g' as const,
          meal: 'breakfast' as const,
          date: '2026-07-18',
          nutrition: { calories: 221.34 },
        },
      ]}
      addLink={addLink}
      onUpdateEntry={vi.fn()}
      onDeleteEntry={vi.fn()}
    />,
  )
  expect(screen.getByText('221 kcal')).toBeDefined()
  expect(screen.queryByText('221.34 kcal')).toBeNull()
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

/**
 * Saving a Combo starts by choosing (#99). The rows only grow checkboxes once
 * somebody has asked to save one — the diary is for reading the rest of the
 * time, and a permanent column of ticks would say otherwise.
 */
test('there are no selection controls until saving a combo is asked for', () => {
  renderWithI18n(
    <MealSlot
      nav={nav}
      label="Breakfast"
      entries={twoEntries}
      addLink={addLink}
      onSaveAsCombo={vi.fn()}
      onUpdateEntry={vi.fn()}
      onDeleteEntry={vi.fn()}
    />,
  )
  expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
})

test('saving a combo saves only the ticked entries', async () => {
  const onSaveAsCombo = vi.fn().mockResolvedValue(undefined)
  renderWithI18n(
    <MealSlot
      nav={nav}
      label="Breakfast"
      entries={twoEntries}
      addLink={addLink}
      onSaveAsCombo={onSaveAsCombo}
      onUpdateEntry={vi.fn()}
      onDeleteEntry={vi.fn()}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Save as combo' }))

  // Everything the meal holds starts ticked: saving the lot is the common
  // case, and untick is the smaller ask than tick-them-all-again.
  const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
  expect(boxes).toHaveLength(2)
  expect(boxes.every((box) => box.checked)).toBe(true)

  fireEvent.click(screen.getByLabelText('Include Coffee'))
  fireEvent.change(screen.getByLabelText('Save these entries as a combo'), {
    target: { value: 'Just oats' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Save as combo' }))

  await waitFor(() =>
    expect(onSaveAsCombo).toHaveBeenCalledWith('Just oats', ['e1']),
  )
})

test('an empty selection cannot be saved', () => {
  const onSaveAsCombo = vi.fn()
  renderWithI18n(
    <MealSlot
      nav={nav}
      label="Breakfast"
      entries={twoEntries}
      addLink={addLink}
      onSaveAsCombo={onSaveAsCombo}
      onUpdateEntry={vi.fn()}
      onDeleteEntry={vi.fn()}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Save as combo' }))
  fireEvent.click(screen.getByLabelText('Include Oatmeal'))
  fireEvent.click(screen.getByLabelText('Include Coffee'))
  fireEvent.change(screen.getByLabelText('Save these entries as a combo'), {
    target: { value: 'Nothing at all' },
  })

  expect(screen.getByText('Tick at least one entry.')).toBeDefined()
  const submit = screen.getByRole('button', { name: 'Save as combo' })
  expect(submit).toHaveProperty('disabled', true)
  fireEvent.click(submit)
  expect(onSaveAsCombo).not.toHaveBeenCalled()
})

test('cancelling puts the selection controls away again', () => {
  renderWithI18n(
    <MealSlot
      nav={nav}
      label="Breakfast"
      entries={twoEntries}
      addLink={addLink}
      onSaveAsCombo={vi.fn()}
      onUpdateEntry={vi.fn()}
      onDeleteEntry={vi.fn()}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Save as combo' }))
  expect(screen.getAllByRole('checkbox')).toHaveLength(2)
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
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
