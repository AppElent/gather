import { fireEvent, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { renderInGroup } from '../app/testing'
import { EnergyUsagePage } from './EnergyUsagePage'
import type { EnergyPeriod } from './energyShared'
import { CHANNELS, day, monthPeriod } from './testing'

/**
 * Usage (APP-494): a day per hour, a month per day and a year next to the
 * year before. A site with only typed readings has no hours.
 */

const state = vi.hoisted(() => ({
  day: null as unknown,
  months: {} as Record<string, unknown>,
}))

vi.mock('convex/react', () => ({
  useQuery: (name: string, args: { month?: string }) =>
    name === 'energyUsage:day'
      ? state.day
      : (state.months[args.month ?? ''] ?? null),
  useQueries: (queries: Record<string, { args: { month: string } }>) =>
    Object.fromEntries(
      Object.entries(queries).map(([key, entry]) => [
        key,
        state.months[entry.args.month] ?? null,
      ]),
    ),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))

vi.mock('../../../convex/_generated/api', () => ({
  api: {
    energyUsage: { month: 'energyUsage:month', day: 'energyUsage:day' },
  },
}))

const DAY_START = Date.parse('2026-11-19T23:00:00Z')

function hourlyDay(): EnergyPeriod {
  const today = day('2026-11-20', {
    importKwh: 8,
    exportKwh: 1,
    solarKwh: 3,
    consumptionKwh: 10,
  })
  return {
    ...monthPeriod('2026-11', '2026-11-20', {
      hasHourly: true,
      channels: { ...CHANNELS, solar: true, battery: true, batterySoc: true },
    }),
    days: [today],
    hours: Array.from({ length: 24 }, (_, index) => ({
      hourStart: DAY_START + index * 3_600_000,
      hasData: index < 20,
      importKwh: index === 18 ? 2 : 0.3,
        consumptionKwh: index === 18 ? 2 : 0.3,
        batteryChargeKwh: null,
        batteryDischargeKwh: null,
      exportKwh: 0,
      solarKwh: index === 12 ? 1.2 : 0.1,
      socPercent: index < 20 ? 20 + index * 3 : null,
    })),
    totals: {
      ...monthPeriod('2026-11', '2026-11-20').totals,
      importKwh: 8,
      exportKwh: 1,
      solarKwh: 3,
      consumptionKwh: 10,
      daysWithData: 1,
      firstDay: '2026-11-20',
      lastDay: '2026-11-20',
    },
  }
}

function manualDay(): EnergyPeriod {
  const today = day('2026-11-20', { estimated: true })
  const base = monthPeriod('2026-11', '2026-11-20', {}, { estimated: true })
  return {
    ...base,
    days: [today],
    totals: { ...base.totals, consumptionKwh: 10, daysWithData: 1 },
  }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-20T18:55:00Z'))
  state.day = hourlyDay()
  state.months = {}
  for (const month of ['2025-01', '2025-02', '2025-03', '2025-11']) {
    state.months[month] = monthPeriod(month, '2026-11-20', {}, {
      consumptionKwh: 12,
    })
  }
  for (const month of ['2026-01', '2026-02', '2026-03', '2026-10']) {
    state.months[month] = monthPeriod(month, '2026-11-20')
  }
  state.months['2026-11'] = monthPeriod('2026-11', '2026-11-20')
})

afterEach(() => {
  vi.useRealTimers()
})

describe('EnergyUsagePage', () => {
  test('a day per hour, with the charge level and the facts', () => {
    renderInGroup(<EnergyUsagePage />)
    expect(screen.getAllByRole('link', { name: 'Energy' })[0]).toHaveAttribute(
      'href',
      '/energy',
    )
    const tabs = screen.getByRole('tablist', { name: 'Period' })
    expect(within(tabs).getByRole('tab', { name: 'Day' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByText('Friday, November 20, so far')).toBeInTheDocument()
    expect(
      screen.getByRole('figure', {
        name: 'Usage per hour on November 20. Usage highest at 18:00, 2.0 kWh. Solar highest at 12:00, 1.2 kWh.',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('figure', {
        name: 'Battery charge level on November 20, from 20% to 77%.',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('From solar and battery')).toBeInTheDocument()
    expect(screen.getByText('2.0 kWh')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next day' })).toBeDisabled()
    expect(screen.getByRole('link', { name: /Costs per month/ })).toHaveAttribute(
      'href',
      '/energy/costs',
    )
  })

  test('a site with only typed readings has no hour chart', () => {
    state.day = manualDay()
    renderInGroup(<EnergyUsagePage />)
    expect(screen.queryByRole('figure')).not.toBeInTheDocument()
    expect(
      screen.getByText(/Meter readings give an estimate per day/),
    ).toBeInTheDocument()
    expect(screen.getByText(/Estimated from meter readings/)).toBeInTheDocument()
    expect(screen.queryByText('From solar and battery')).not.toBeInTheDocument()
  })

  test('a day no reading reaches yet shows a dash, not zero', () => {
    const base = manualDay()
    state.day = {
      ...base,
      days: [day('2026-11-20', { hasData: false })],
      totals: { ...base.totals, consumptionKwh: 0, daysWithData: 0 },
    }
    renderInGroup(<EnergyUsagePage />)
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.getByText('No usage in this period yet.')).toBeInTheDocument()
    expect(screen.queryByText('0.0')).not.toBeInTheDocument()
    expect(screen.queryByText('From the grid')).not.toBeInTheDocument()
  })

  test('a month per day', () => {
    renderInGroup(<EnergyUsagePage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Month' }))
    expect(screen.getByText('November 2026')).toBeInTheDocument()
    expect(
      screen.getByRole('figure', {
        name: 'Usage per day in November. Most usage on November 1, 10.0 kWh.',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('On average 10.0 kWh a day. October: 10.0 a day.'),
    ).toBeInTheDocument()
  })

  test('a year next to the year before, over the same completed months', () => {
    renderInGroup(<EnergyUsagePage initialRange="year" />)
    expect(screen.getByRole('tab', { name: 'Year' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('tablist', { name: 'Unit' })).toBeInTheDocument()
    // January–March: 310 + 280 + 310 kWh this year against 12 kWh a day.
    expect(
      screen.getByRole('figure', {
        name: 'Usage per month, 2026 next to 2025. January to March: 900 kWh, last year 1,080 kWh.',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('January to March: 900 kWh, last year 1,080 kWh.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Difference')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Euro' }))
    expect(
      screen.getByRole('figure', { name: /^Costs per month, 2026 next to 2025/ }),
    ).toBeInTheDocument()
  })
})
