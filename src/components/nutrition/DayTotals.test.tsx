import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { DayTotals } from './DayTotals'

test('renders a total with a target as "value / target"', () => {
  render(<DayTotals totals={{ calories: 1500 }} targets={{ calories: 2000 }} />)
  expect(screen.getByText('Calories (kcal)')).toBeDefined()
  expect(screen.getByText('1500 / 2000')).toBeDefined()
})

test('renders a total without a target as a plain value', () => {
  render(<DayTotals totals={{ protein: 50 }} />)
  expect(screen.getByText('Protein (g)')).toBeDefined()
  expect(screen.getByText('50')).toBeDefined()
})

test('renders nothing when totals and targets are both empty', () => {
  const { container } = render(<DayTotals totals={{}} />)
  expect(container.innerHTML).toBe('')
})

test('renders a custom heading when provided', () => {
  render(<DayTotals totals={{ calories: 100 }} heading="Totals — 2026-07-17" />)
  expect(screen.getByText('Totals — 2026-07-17')).toBeDefined()
  expect(screen.queryByText("Today's totals")).toBeNull()
})
