import { fireEvent, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { renderInGroup } from '../app/testing'
import { EnergyCostsPage } from './EnergyCostsPage'
import type { EnergyPeriod } from './energyShared'
import { cost, monthPeriod } from './testing'

/**
 * Costs per month (APP-494): with or without net metering before 2027, only
 * without from 2027, and a missing cost said in words rather than as a number.
 */

const state = vi.hoisted(() => ({
  months: {} as Record<string, unknown>,
  today: '2026-11-20',
}))

vi.mock('convex/react', () => ({
  useQuery: (_name: string, args: { month: string }) =>
    state.months[args.month] ?? null,
  useQueries: (queries: Record<string, { args: { month: string } }>) =>
    Object.fromEntries(
      Object.entries(queries).map(([key, entry]) => [
        key,
        state.months[entry.args.month] ?? null,
      ]),
    ),
  useMutation: () => () => Promise.resolve(null),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    search,
  }: {
    children: ReactNode
    to: string
    search?: { range?: string }
  }) => (
    <a href={search?.range ? `${to}?range=${search.range}` : to}>{children}</a>
  ),
}))

vi.mock('../../../convex/_generated/api', () => ({
  api: { energyUsage: { month: 'energyUsage:month' } },
}))

function setToday(today: string) {
  state.today = today
  vi.setSystemTime(new Date(`${today}T18:55:00Z`))
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  setToday('2026-11-20')
  state.months = {
    '2026-11': monthPeriod('2026-11', '2026-11-20'),
    '2026-10': monthPeriod('2026-10', '2026-11-20'),
  }
})

afterEach(() => {
  vi.useRealTimers()
})

describe('EnergyCostsPage', () => {
  test('with net metering, the month total, the previous month and a forecast', () => {
    renderInGroup(<EnergyCostsPage />)
    expect(screen.getAllByRole('link', { name: 'Energy' })[0]).toHaveAttribute(
      'href',
      '/energy',
    )
    const tabs = screen.getByRole('tablist', { name: 'Calculation' })
    expect(
      within(tabs).getByRole('tab', { name: 'With net metering' }),
    ).toHaveAttribute('aria-selected', 'true')
    const total = screen.getByRole('region', { name: 'Total' })
    expect(within(total).getByText('November 1 to November 20')).toBeInTheDocument()
    expect(within(total).getByText('€60.00')).toBeInTheDocument()
    // October: 31 days of €3.00; November forecast: €3.00 × 30.
    expect(
      within(total).getByText(
        'October was €93.00. Expected for all of November: €90.00.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('figure', {
        name: 'Costs per day in November.',
      }),
    ).toBeInTheDocument()
    // Every day costs the same, so no day is the highest.
    expect(screen.queryByText(/Highest on/)).toBeNull()
    expect(screen.getByRole('link', { name: 'Year ›' })).toHaveAttribute(
      'href',
      '/energy/usage?range=year',
    )
    expect(screen.getByText('40.0 kWh, netted against usage')).toBeInTheDocument()
  })

  test('the day that costs the most is named when days differ', () => {
    const period = monthPeriod('2026-11', '2026-11-20')
    const fifth = period.days[4]
    if (fifth) fifth.cost = cost(500)
    state.months['2026-11'] = period
    renderInGroup(<EnergyCostsPage />)
    expect(
      screen.getByText('Costs per day in November. Highest on November 5: €5.00.'),
    ).toBeInTheDocument()
  })

  test('without net metering, what the month costs from 2027 and the difference', () => {
    renderInGroup(<EnergyCostsPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Without net metering' }))
    const total = screen.getByRole('region', { name: 'Total' })
    expect(within(total).getByText('€70.00')).toBeInTheDocument()
    expect(
      within(total).getByText(
        'What November would have cost without net metering, as it will from 1 January 2027: €10.00 more.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('40.0 kWh at the export price')).toBeInTheDocument()
  })

  test('from 2027 the choice is gone and every cost is without', () => {
    setToday('2027-01-15')
    state.months = {
      '2027-01': monthPeriod('2027-01', '2027-01-15', {
        netMeteringChoice: false,
      }),
    }
    renderInGroup(<EnergyCostsPage />)
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(
      screen.getByText(/Net metering ended on 1 January 2027/),
    ).toBeInTheDocument()
  })

  test('prices not in yet read as a sentence, never a number', () => {
    const period = monthPeriod('2026-11', '2026-11-20', {}, {
      cost: null,
      costWithoutNet: null,
      costStatus: 'noPrices',
    }) as EnergyPeriod
    period.totals = {
      ...period.totals,
      cost: null,
      costWithoutNet: null,
      costMissingDays: 20,
      costStatus: 'noPrices',
    }
    state.months = { '2026-11': period }
    renderInGroup(<EnergyCostsPage />)
    const total = screen.getByRole('region', { name: 'Total' })
    expect(total).toHaveTextContent(
      'The costs for November are not available yet: the prices of your dynamic contract have not come in.',
    )
    expect(total).not.toHaveTextContent('€')
    expect(
      screen.queryByText('Electricity from the grid'),
    ).not.toBeInTheDocument()
  })

  test('a month without usage lists only its fixed costs', () => {
    const period = monthPeriod('2026-11', '2026-11-20', {}, {
      hasData: false,
      costStatus: 'noData',
    })
    for (const each of period.days) {
      each.cost = each.day <= '2026-11-20' ? cost(-61) : null
    }
    period.totals.cost = {
      ...cost(-1220),
      fixedCents: 2260,
      creditCents: -3480,
    }
    state.months = { '2026-11': period }
    renderInGroup(<EnergyCostsPage />)
    expect(screen.getByRole('region', { name: 'Total' })).not.toHaveTextContent('€')
    expect(screen.getByText('€22.60')).toBeInTheDocument()
    expect(screen.getAllByText('20 days')).toHaveLength(2)
    expect(
      screen.queryByText('Electricity from the grid'),
    ).not.toBeInTheDocument()
  })

  test('a previous month with only fixed costs is not compared with', () => {
    const october = monthPeriod('2026-10', '2026-11-20')
    october.totals.costStatus = 'noPrices'
    state.months['2026-10'] = october
    renderInGroup(<EnergyCostsPage />)
    expect(screen.queryByText(/October was/)).toBeNull()
  })

  test('the forecast extends usage from priced days only', () => {
    const period = monthPeriod('2026-11', '2026-11-20')
    period.totals.costMissingDays = 5
    state.months['2026-11'] = period
    renderInGroup(<EnergyCostsPage />)
    // €60.00 of usage over 15 priced days, for 30 days.
    expect(screen.getByText(/€120\.00/)).toBeInTheDocument()
  })

  test('no month after the running one', () => {
    renderInGroup(<EnergyCostsPage />)
    expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(screen.getByText('October 2026')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next month' })).toBeEnabled()
  })
})
