import { screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { renderWithI18n } from '../../lib/i18n/testing'
import { NutritionPage } from './NutritionPage'

/**
 * The diary is also where the two libraries beside it are reached from (#100).
 * Foods is the Catalog everybody shares; Combos is the person's own. Neither
 * had a way in from Nutrition before, so both were addresses you had to know.
 */

vi.mock('convex/react', () => ({
  useQuery: () => undefined,
  useMutation: () => vi.fn(),
}))

vi.mock('../../../convex/_generated/api', () => ({
  api: {
    users: { me: 'users:me' },
    consumption: {
      listForDay: 'consumption:listForDay',
      update: 'consumption:update',
      remove: 'consumption:remove',
    },
    combos: { saveFromMeal: 'combos:saveFromMeal' },
  },
}))

// TanStack Router's <Link> reads router state, which a component test has no
// provider for — the same plain-anchor stand-in the sibling suites use.
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

function renderDiary() {
  renderWithI18n(<NutritionPage date="2026-07-18" onDateChange={vi.fn()} />)
}

test('offers the Foods catalog without anybody having to know its address', () => {
  renderDiary()

  expect(screen.getByRole('link', { name: /foods/i })).toHaveAttribute(
    'href',
    '/foods',
  )
})

test('offers the Combos library beside it', () => {
  renderDiary()

  expect(screen.getByRole('link', { name: /combos/i })).toHaveAttribute(
    'href',
    '/combos',
  )
})
