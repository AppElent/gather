import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { NutritionPanel } from './NutritionPanel'

test('renders present nutrients with labels and the source badge', () => {
  render(
    <NutritionPanel
      nutrition={{ calories: 520, protein: 18.5 }}
      servings={4}
      source="imported"
    />,
  )
  expect(screen.getByText('Calories (kcal)')).toBeDefined()
  expect(screen.getByText('520')).toBeDefined()
  expect(screen.getByText('Protein (g)')).toBeDefined()
  expect(screen.getByText('18.5')).toBeDefined()
  expect(screen.getByText('Imported')).toBeDefined()
  expect(screen.getByText(/4 servings/)).toBeDefined()
})

test('hides absent nutrients and badge when source is missing', () => {
  render(<NutritionPanel nutrition={{ fat: 10 }} />)
  expect(screen.queryByText('Calories (kcal)')).toBeNull()
  expect(screen.queryByText('Imported')).toBeNull()
  expect(screen.getByText('Fat (g)')).toBeDefined()
})

test('renders nothing for empty nutrition', () => {
  const { container } = render(<NutritionPanel nutrition={{}} />)
  expect(container.innerHTML).toBe('')
})
