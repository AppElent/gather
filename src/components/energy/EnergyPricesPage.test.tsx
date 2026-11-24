import { fireEvent, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { renderInGroup } from '../app/testing'
import { EnergyPricesPage } from './EnergyPricesPage'
import { priceDay, priceView } from './testing'

/** Prices per hour, today and tomorrow (APP-493). */

const state = vi.hoisted(() => ({ view: undefined as unknown }))

vi.mock('convex/react', () => ({ useQuery: () => state.view }))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))
vi.mock('../../../convex/_generated/api', () => ({
  api: { energyPrices: { view: 'energyPrices:view' } },
}))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-20T18:55:00Z'))
  state.view = priceView()
})
afterEach(() => {
  vi.useRealTimers()
})

const tomorrow = (name: string) =>
  fireEvent.click(screen.getByRole('tab', { name }))

describe('EnergyPricesPage', () => {
  test('today: the price now, the chart in words, the facts and the build-up', () => {
    renderInGroup(<EnergyPricesPage />)
    expect(
      screen.getByRole('heading', { name: 'Power now €0.40 per kWh' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Thuis · EnergyZero + Frank Energie')).toBeInTheDocument()
    const figure = screen.getByRole('figure', {
      name: 'Price per hour today. Now 40 cents. Cheapest 02:00 to 05:00, on average 20 cents. Most expensive at 19:00, 40 cents.',
    })
    expect(figure.querySelectorAll('[data-bar="cheapest"]')).toHaveLength(3)
    expect(figure.querySelectorAll('[data-bar="marked"]')).toHaveLength(1)
    expect(within(figure).getByText('Cheapest 3 hours')).toBeInTheDocument()
    expect(screen.getByText('02:00–05:00 · €0.20')).toBeInTheDocument()
    expect(screen.getByText('19:00 · €0.40')).toBeInTheDocument()
    const parts = screen.getByRole('figure', { name: /What makes up €0.40/ })
    expect(within(parts).getByText('Market price (EnergyZero)')).toBeInTheDocument()
    expect(within(parts).getByText('Markup Frank Energie')).toBeInTheDocument()
    expect(within(parts).getByText('VAT 21%')).toBeInTheDocument()
    expect(screen.getByText(/EnergyZero · tomorrow fetched/)).toBeInTheDocument()
  })

  test('tomorrow: its own hours, the most expensive outlined, no build-up', () => {
    renderInGroup(<EnergyPricesPage />, { locale: 'nl' })
    tomorrow('Morgen')
    const figure = screen.getByRole('figure', { name: /^Prijs per uur morgen\./ })
    expect(figure.querySelectorAll('[data-bar="marked"]')).toHaveLength(1)
    expect(figure.querySelectorAll('[data-bar="past"]')).toHaveLength(0)
    expect(screen.queryByText(/opgebouwd/)).not.toBeInTheDocument()
  })

  test('before tomorrow is in, it says when to expect it', () => {
    vi.setSystemTime(new Date('2026-11-20T09:00:00Z'))
    state.view = priceView({ tomorrow: null })
    renderInGroup(<EnergyPricesPage />)
    tomorrow('Tomorrow')
    expect(
      screen.getByText('Tomorrow’s prices are expected around 13:30.'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/has not given all prices/)).not.toBeInTheDocument()
  })

  test('overdue, it says so with when it last worked', () => {
    state.view = priceView({
      tomorrow: null,
      lastFetchedAt: Date.parse('2026-11-19T12:35:00Z'),
    })
    renderInGroup(<EnergyPricesPage />)
    tomorrow('Tomorrow')
    expect(screen.getByText('Tomorrow’s prices are not in yet.')).toBeInTheDocument()
    expect(
      screen.getAllByText(/EnergyZero has not given all prices yet\. Last worked:/).length,
    ).toBeGreaterThan(0)
  })

  test('a refused key is said in words, and today stays', () => {
    state.view = priceView({
      provider: 'tibber',
      hasKey: true,
      status: 'needsKey',
      lastError: 'keyRejected',
    })
    renderInGroup(<EnergyPricesPage />)
    expect(
      screen.getByText(/Tibber refuses the key\. Save a new one\. Last worked:/),
    ).toBeInTheDocument()
    expect(screen.getByRole('figure', { name: /^Price per hour today/ })).toBeInTheDocument()
  })

  test('a negative price says what sending back costs', () => {
    const today = priceDay('2026-11-20', {})
    today.hours = today.hours.map((hour, index) =>
      index === 13 ? { ...hour, market: -0.05 } : hour,
    )
    state.view = priceView({ today })
    renderInGroup(<EnergyPricesPage />)
    expect(
      screen.getByText('Sending power back costs money from 13:00 to 14:00.'),
    ).toBeInTheDocument()
    expect(screen.getByText(/you pay €0\.06 per kWh you send back/)).toBeInTheDocument()
  })

  test('without a dynamic contract it is the market price, and says so', () => {
    state.view = priceView({
      contract: null,
      today: priceDay('2026-11-20', {}, { basis: 'market', terms: null, exportFeeEurPerKwh: null }),
    })
    renderInGroup(<EnergyPricesPage />)
    expect(
      screen.getByRole('heading', { name: 'Market price now €0.30 per kWh' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Fill in a dynamic contract/)).toBeInTheDocument()
    expect(screen.queryByText(/What makes up/)).not.toBeInTheDocument()
  })
})
