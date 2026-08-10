import { fireEvent, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import type { ComboComponent } from '../../../convex/lib/combos'
import { renderWithI18n } from '../../lib/i18n/testing'
import { ComboCard } from './ComboCard'

/**
 * A Combo expands like everything else, because wanting to change something
 * small turned out to be routine: an extra slice today, no coffee this
 * morning. Stepping a component to zero is the only remove control there is.
 */

const components: ComboComponent[] = [
  {
    id: 'bread',
    label: 'Wholemeal bread',
    quantity: 70,
    quantityUnit: 'g',
    foodId: 'food-bread',
    food: { baseUnit: 'g', nutritionPer100: { calories: 250 } },
    available: true,
  },
  {
    id: 'coffee',
    label: 'Flat white',
    quantity: 1,
    quantityUnit: 'piece',
    nutrition: { calories: 120 },
    available: true,
  },
]

const combo = { _id: 'combo1', name: 'Usual breakfast', components }

function render(onLog = vi.fn()) {
  renderWithI18n(
    <ComboCard
      combo={combo}
      expanded
      onToggle={vi.fn()}
      busy={false}
      error={null}
      onLog={onLog}
    />,
  )
  return onLog
}

test('shows what is in it before anything is committed', () => {
  const onLog = render()
  expect(screen.getByText('Usual breakfast')).toBeDefined()
  expect(screen.getByText('🍱')).toBeDefined()
  expect(screen.getByText('2 items')).toBeDefined()
  expect(screen.getByText('Wholemeal bread')).toBeDefined()
  expect(screen.getByText('Flat white')).toBeDefined()
  expect(onLog).not.toHaveBeenCalled()
})

test('a stepper counts that component’s own serving', () => {
  render()
  expect(screen.getByText('70 g')).toBeDefined()
  fireEvent.click(screen.getByRole('button', { name: 'More Wholemeal bread' }))
  expect(screen.getByText('140 g')).toBeDefined()
})

test('stepping to zero drops a component from today’s logging', () => {
  const onLog = render()
  fireEvent.click(screen.getByRole('button', { name: 'Less Flat white' }))

  fireEvent.click(screen.getByText('Add to diary'))
  expect(onLog).toHaveBeenCalledWith({ coffee: 0 }, true)
})

test('a changed Combo can be put back without closing the sheet', () => {
  const onLog = render()
  fireEvent.click(screen.getByRole('button', { name: 'More Wholemeal bread' }))
  expect(screen.getByText('140 g')).toBeDefined()

  fireEvent.click(screen.getByText('Reset'))

  expect(screen.getByText('70 g')).toBeDefined()
  expect(screen.queryByText('Reset')).toBeNull()
  fireEvent.click(screen.getByText('Add to diary'))
  // Reset means as saved, so nothing is offered afterwards either.
  expect(onLog).toHaveBeenCalledWith({}, false)
})

test('a component nobody can reach any more says so and has no stepper', () => {
  renderWithI18n(
    <ComboCard
      combo={{
        ...combo,
        components: [
          components[0],
          {
            id: 'granola',
            label: 'Nora’s granola',
            quantity: 1,
            quantityUnit: 'serving',
            recipeId: 'recipe-granola',
            available: false,
          },
        ],
      }}
      expanded
      onToggle={vi.fn()}
      busy={false}
      error={null}
      onLog={vi.fn()}
    />,
  )

  expect(screen.getByText('Not available any more')).toBeDefined()
  expect(
    screen.queryByRole('button', { name: 'More Nora’s granola' }),
  ).toBeNull()
  // And the rest still logs.
  expect(screen.getByText('Add to diary')).not.toBeDisabled()
})
