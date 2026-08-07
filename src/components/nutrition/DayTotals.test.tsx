import { screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { renderWithI18n } from '../../lib/i18n/testing'
import { DayTotals, remainder } from './DayTotals'

// TanStack Router's <Link> requires a RouterProvider context to render (it
// reads router state via useLinkProps); this component test renders in
// isolation, so mock it out to a plain anchor, matching the same pattern used
// in ConsumptionEntryRow.test.tsx / AppShell.test.tsx.
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    hash,
    className,
  }: {
    children: React.ReactNode
    to: string
    hash?: string
    className?: string
  }) => (
    <a href={hash ? `${to}#${hash}` : to} className={className}>
      {children}
    </a>
  ),
}))

test('renders a total with a target as "value / target"', () => {
  renderWithI18n(
    <DayTotals totals={{ calories: 1500 }} targets={{ calories: 2000 }} />,
  )
  expect(screen.getByText('Calories (kcal)')).toBeDefined()
  expect(screen.getByText('1500 / 2000')).toBeDefined()
})

test('says what is left of a target, and what is over it', () => {
  const { rerender } = renderWithI18n(
    <DayTotals totals={{ calories: 1500 }} targets={{ calories: 2000 }} />,
  )
  expect(screen.getByText('500 left')).toBeDefined()
  rerender(
    <DayTotals totals={{ calories: 2300 }} targets={{ calories: 2000 }} />,
  )
  expect(screen.getByText('300 over')).toBeDefined()
})

test('offers a way through to editing targets', () => {
  renderWithI18n(<DayTotals totals={{ calories: 1500 }} />)
  expect(screen.getByRole('link', { name: 'Edit targets' })).toBeDefined()
})

test('a target of zero is somebody who cleared the field, not a target', () => {
  expect(remainder(50, 0)).toBeUndefined()
  expect(remainder(50, -1)).toBeUndefined()
})

test('a remainder is rounded the way the figures beside it are', () => {
  expect(remainder(0.1 + 0.2, 1)).toEqual({ amount: 0.7, over: false })
  expect(remainder(1.05, 1)).toEqual({ amount: 0.05, over: true })
})

test('renders a total without a target as a plain value', () => {
  renderWithI18n(<DayTotals totals={{ protein: 50 }} />)
  expect(screen.getByText('Protein (g)')).toBeDefined()
  expect(screen.getByText('50')).toBeDefined()
})

test('renders nothing when totals and targets are both empty', () => {
  const { container } = renderWithI18n(<DayTotals totals={{}} />)
  expect(container.innerHTML).toBe('')
})

test('renders a custom heading when provided', () => {
  renderWithI18n(
    <DayTotals totals={{ calories: 100 }} heading="Totals — 2026-07-17" />,
  )
  expect(screen.getByText('Totals — 2026-07-17')).toBeDefined()
  expect(screen.queryByText("Today's totals")).toBeNull()
})
