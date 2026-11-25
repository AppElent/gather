import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { renderInGroup } from '../app/testing'
import { EnergyPage } from './EnergyPage'
import { batteryDay, monthPeriod, priceView, solarMonth } from './testing'

/**
 * The empty Energy Module offers one step, adding an address, and the form
 * sends what the person chose (APP-492). With an address, the page names it,
 * shows usage and links to the pages below it (APP-494).
 */

const state = vi.hoisted(() => ({
  overview: undefined as unknown,
  houses: [] as unknown[],
  form: null as unknown,
  month: null as unknown,
  day: null as unknown,
  solar: null as unknown,
  prices: null as unknown,
  calls: [] as unknown[],
  navigate: vi.fn(),
  result: Promise.resolve('site1') as Promise<unknown>,
}))

vi.mock('convex/react', () => ({
  useQuery: (name: string, args: unknown) => {
    if (args === 'skip') return undefined
    if (name === 'energy:overview') return state.overview
    if (name === 'energyReadings:form') return state.form
    if (name === 'energyUsage:month') return state.month
    if (name === 'energyUsage:day') return state.day
    if (name === 'energySolar:month') return state.solar
    if (name === 'energyPrices:view') return state.prices
    return state.houses
  },
  useMutation: () => (args: unknown) => {
    state.calls.push(args)
    return state.result
  },
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => state.navigate,
  Link: ({
    children,
    to,
    className,
  }: {
    children: ReactNode
    to: string
    className?: string
  }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}))

vi.mock('../../../convex/_generated/api', () => ({
  api: {
    energy: { overview: 'energy:overview', createSite: 'energy:createSite' },
    energyReadings: { form: 'energyReadings:form' },
    energyUsage: { month: 'energyUsage:month', day: 'energyUsage:day' },
    energySolar: { month: 'energySolar:month' },
    energyPrices: { view: 'energyPrices:view' },
    houses: { list: 'houses:list' },
  },
}))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-20T18:55:00Z'))
  state.overview = null
  state.houses = []
  state.form = null
  state.month = null
  state.day = null
  state.solar = null
  state.prices = null
  state.calls = []
  state.navigate.mockClear()
  state.result = Promise.resolve('site1')
})

afterEach(() => {
  vi.useRealTimers()
})

describe('EnergyPage', () => {
  test('empty, it says what the Module does and offers to add an address', () => {
    renderInGroup(<EnergyPage />)
    expect(screen.getByText('No address yet')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'What does your power cost, every hour?' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Add your first address' }),
    ).toBeInTheDocument()
  })

  test('the form saves meter readings as the source, with the chosen House', async () => {
    state.houses = [{ _id: 'house1', name: 'Dorpsstraat 1' }]
    renderInGroup(<EnergyPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Add your first address' }))

    expect(screen.getByLabelText('Name')).toHaveValue('Home')
    fireEvent.change(screen.getByLabelText('House'), {
      target: { value: 'house1' },
    })
    fireEvent.click(screen.getByRole('radio', { name: /Type meter readings/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => expect(state.calls).toHaveLength(1))
    expect(state.calls[0]).toEqual({
      groupSlug: expect.any(String),
      name: 'Home',
      houseId: 'house1',
      source: { kind: 'manual', label: 'Meter readings' },
    })
  })

  test('Home Assistant is the default and saves the address alone', async () => {
    renderInGroup(<EnergyPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Add your first address' }))
    expect(
      screen.getByRole('radio', { name: /Connect Home Assistant/ }),
    ).toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(state.calls).toHaveLength(1))
    expect(state.calls[0]).toMatchObject({
      houseId: undefined,
      source: { kind: 'homeAssistant' },
    })
    await waitFor(() =>
      expect(state.navigate).toHaveBeenCalledWith(
        expect.objectContaining({ to: '/energy/connect' }),
      ),
    )
  })

  test('an empty name is caught before anything is sent', () => {
    renderInGroup(<EnergyPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Add your first address' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Give the address a name.')
    expect(state.calls).toEqual([])
  })

  test('a refusal reads in words', async () => {
    state.result = Promise.reject(
      Object.assign(new Error('refused'), { data: { kind: 'energy:houseNotFound' } }),
    )
    state.result.catch(() => {})
    renderInGroup(<EnergyPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Add your first address' }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That house is not in this Group any more.',
    )
  })

  test('an address without a source asks to connect Home Assistant or type a reading', () => {
    state.overview = { site: { _id: 's1', name: 'Thuis' }, sources: [] }
    state.form = { hasManualSource: false, lastReadingAt: null, channels: [] }
    state.month = monthPeriod('2026-11', '2026-11-20')
    renderInGroup(<EnergyPage />, { locale: 'nl' })
    expect(screen.getByRole('heading', { name: 'Thuis' })).toBeInTheDocument()
    const links = screen.getAllByRole('link').map((link) => link.getAttribute('href'))
    expect(screen.getByRole('heading', { name: 'Nog één stap' })).toBeInTheDocument()
    expect(links).toContain('/energy/connect')
    expect(links).toContain('/energy/readings')
    expect(screen.getByText('Nog geen bron gekoppeld')).toBeInTheDocument()
  })

  test('typed readings without meters invite the first reading', () => {
    state.overview = {
      site: { _id: 's1', name: 'Thuis' },
      sources: [{ _id: 'src1', kind: 'manual', label: 'Meterstanden', status: 'ok' }],
    }
    state.form = { hasManualSource: true, lastReadingAt: null, channels: [] }
    state.month = monthPeriod('2026-11', '2026-11-20', {
      netMeteringChoice: false,
      contract: null,
    })
    renderInGroup(<EnergyPage />, { locale: 'nl' })
    expect(screen.getByText('Meterstanden · nog geen stand')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Typ je eerste meterstanden' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Binnenkort')).not.toBeInTheDocument()
  })

  test('with readings, it shows the days of this month and the rows', () => {
    state.overview = {
      site: { _id: 's1', name: 'Thuis' },
      sources: [{ _id: 'src1', kind: 'manual', label: 'Meter readings', status: 'ok' }],
    }
    state.form = {
      hasManualSource: true,
      lastReadingAt: Date.parse('2026-11-18T11:00:00Z'),
      channels: [{ _id: 'c1', kind: 'gridImport', unit: 'kWh' }],
    }
    state.month = monthPeriod('2026-11', '2026-11-20', {}, { estimated: true })
    renderInGroup(<EnergyPage />)

    expect(
      screen.getByText('Meter readings · last reading November 18, 2026'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Usage per day this month' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('figure', {
        name: /Usage per day in November/,
      }),
    ).toBeInTheDocument()

    const nav = screen.getByRole('navigation', { name: 'More about energy' })
    const rows = within(nav).getAllByRole('link')
    expect(rows.map((row) => row.getAttribute('href'))).toEqual([
      '/energy/usage',
      '/energy/prices',
      '/energy/costs',
      '/energy/solar',
      '/energy/readings',
      '/energy/contract',
      '/energy/sources',
    ])
    expect(within(nav).getByText('Per day, month and year')).toBeInTheDocument()
    expect(within(nav).getByText('€60.00 so far in November')).toBeInTheDocument()
    expect(
      within(nav).getByText('Last reading November 18, 2026'),
    ).toBeInTheDocument()
    expect(
      within(nav).getByText('Zonneplan, dynamic · since January 1, 2026'),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Type your first meter readings' }),
    ).not.toBeInTheDocument()
  })

  test('a source in error is said in words with when its data is from, and its data stays', () => {
    state.overview = {
      site: { _id: 's1', name: 'Thuis' },
      sources: [
        {
          _id: 'src1',
          kind: 'homeAssistant',
          label: 'Home Assistant',
          status: 'error',
          lastError: 'unreachable',
          lastSyncedAt: Date.parse('2026-11-20T09:15:00Z'),
        },
      ],
    }
    state.form = { hasManualSource: false, lastReadingAt: null, channels: [] }
    state.month = monthPeriod('2026-11', '2026-11-20')
    renderInGroup(<EnergyPage />, { locale: 'nl' })
    const line = screen.getByText(/Home Assistant antwoordt niet/)
    expect(line).toHaveTextContent('10:15')
    expect(screen.queryByText('Typ je eerste meterstanden')).not.toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Verbruik per dag deze maand' }),
    ).toBeInTheDocument()
  })

  test('an hourly site shows today per hour', () => {
    state.overview = {
      site: { _id: 's1', name: 'Thuis' },
      sources: [{ _id: 'src1', kind: 'homeAssistant', label: 'Home Assistant', status: 'ok' }],
    }
    state.form = { hasManualSource: false, lastReadingAt: null, channels: [] }
    state.month = monthPeriod('2026-11', '2026-11-20', { hasHourly: true })
    const start = Date.parse('2026-11-19T23:00:00Z')
    state.day = monthPeriod('2026-11', '2026-11-20', {
      hasHourly: true,
      days: [],
      hours: Array.from({ length: 24 }, (_, index) => ({
        hourStart: start + index * 3_600_000,
        hasData: index < 20,
        importKwh: index === 18 ? 2 : 0.5,
        consumptionKwh: index === 18 ? 2 : 0.5,
        batteryChargeKwh: null,
        batteryDischargeKwh: null,
        exportKwh: 0,
        solarKwh: null,
        socPercent: null,
      })),
    })
    ;(state.day as { days: unknown[] }).days = [
      (state.month as { days: unknown[] }).days[19],
    ]
    renderInGroup(<EnergyPage />)
    expect(
      screen.getByRole('heading', { name: 'Usage and solar per hour' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('figure', {
        name: 'Usage per hour on November 20. Usage highest at 18:00, 2.0 kWh.',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('Per hour, day, month and year')).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Type your first meter readings' }),
    ).not.toBeInTheDocument()
  })

  describe('prices', () => {
    beforeEach(() => {
      state.overview = {
        site: { _id: 's1', name: 'Thuis' },
        sources: [
          { _id: 'src1', kind: 'manual', label: 'Meter readings', status: 'ok' },
        ],
      }
      state.form = { hasManualSource: true, lastReadingAt: null, channels: [] }
      state.month = monthPeriod('2026-11', '2026-11-20')
      state.prices = priceView()
    })

    test('the Now card says the price, what it is against today, and when it is cheap', () => {
      renderInGroup(<EnergyPage />)
      const card = screen.getByRole('region', {
        name: 'Power price now: €0.40 per kWh. Expensive: 34% above today’s average. Cheapest tomorrow: 13:00–16:00, on average €0.10',
      })
      expect(within(card).getByText('Power now, 19:00–20:00')).toBeInTheDocument()
      expect(within(card).getByText('€0.40')).toBeInTheDocument()
      expect(within(card).getByText('Expensive').tagName).toBe('STRONG')
    })

    test('the price card opens Prices and says its answer', () => {
      renderInGroup(<EnergyPage />)
      const figure = screen.getByRole('figure', {
        name: 'Price per hour today. Now 40 cents. Cheapest 02:00 to 05:00, on average 20 cents. Most expensive at 19:00, 40 cents.',
      })
      expect(figure.closest('a')).toHaveAttribute('href', '/energy/prices')
      expect(figure.querySelectorAll('[data-bar]')).toHaveLength(24)
      expect(figure.querySelectorAll('[data-bar="marked"]')).toHaveLength(1)
      // Home leaves the cheapest hours uncoloured.
      expect(figure.querySelectorAll('[data-bar="cheapest"]')).toHaveLength(0)
      expect(
        screen.getByText(
          'Prices from EnergyZero with your contract from Frank Energie. Amounts include VAT and energy tax.',
        ),
      ).toBeInTheDocument()
    })

    test('in Dutch', () => {
      renderInGroup(<EnergyPage />, { locale: 'nl' })
      expect(screen.getByText('Duur')).toBeInTheDocument()
      expect(
        screen.getByRole('heading', { name: 'Prijs per uur vandaag' }),
      ).toBeInTheDocument()
    })

    test('without prices for today there are no cards, and the row says why', () => {
      state.prices = priceView({ today: null, tomorrow: null })
      renderInGroup(<EnergyPage />)
      expect(screen.queryByText('Price per hour today')).not.toBeInTheDocument()
      const nav = screen.getByRole('navigation', { name: 'More about energy' })
      expect(
        within(nav).getByText(/EnergyZero has not given all prices yet\./),
      ).toBeInTheDocument()
    })
  })

  test('a battery gets a card with what it does, and a row to its page', () => {
    state.overview = {
      site: { _id: 'site1', name: 'Thuis' },
      sources: [
        { _id: 's1', kind: 'homeAssistant', label: 'Home Assistant', status: 'ok' },
      ],
    }
    state.day = batteryDay()
    state.month = state.day
    state.solar = solarMonth()
    renderInGroup(<EnergyPage />)
    const card = screen.getByText('Home battery').closest('a')
    expect(card).toHaveAttribute('href', '/energy/solar')
    // 19:55 in Amsterdam; the latest hour with figures is 18:00.
    expect(card).toHaveTextContent('Around 18:00: discharging 1.5 kW')
    expect(card).toHaveTextContent('64%')
    expect(card).toHaveTextContent('Earned €0.59 today by charging cheap')
    expect(
      screen.getByRole('link', { name: /Solar and battery.*31%/ }),
    ).toBeInTheDocument()
  })
})
