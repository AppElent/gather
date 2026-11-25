import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { renderInGroup } from '../app/testing'
import { EnergySolarPage } from './EnergySolarPage'
import { batteryDay, solarMonth } from './testing'

/**
 * Solar and battery (APP-496): today and this month, payback per asset, and
 * no zeros for a site that cannot measure them.
 */

const state = vi.hoisted(() => ({
  solar: null as unknown,
  day: null as unknown,
  months: {} as Record<string, unknown>,
  calls: [] as { name: string; args: unknown }[],
}))

vi.mock('convex/react', () => ({
  useQuery: (name: string) =>
    name === 'energySolar:month' ? state.solar : state.day,
  useQueries: (queries: Record<string, { args: { month: string } }>) =>
    Object.fromEntries(
      Object.entries(queries).map(([key, entry]) => [
        key,
        entry.args.month in state.months
          ? state.months[entry.args.month]
          : state.solar,
      ]),
    ),
  useMutation: (name: string) => async (args: unknown) => {
    state.calls.push({ name, args })
  },
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))

vi.mock('../../../convex/_generated/api', () => ({
  api: {
    energySolar: { month: 'energySolar:month' },
    energyUsage: { day: 'energyUsage:day' },
    energyAssets: { save: 'energyAssets:save', remove: 'energyAssets:remove' },
  },
}))

const ROOF = {
  _id: 'asset1' as never,
  asset: {
    kind: 'solar' as const,
    name: 'Roof',
    peakWatt: 4200,
    installedOn: '2023-03-01',
    purchaseCents: 520_000,
  },
}
const BATTERY = {
  _id: 'asset2' as never,
  asset: { kind: 'battery' as const, name: 'Sessy', capacityKwh: 10 },
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-20T18:55:00Z'))
  state.solar = solarMonth()
  state.day = batteryDay()
  state.months = {}
  state.calls = []
})

afterEach(() => {
  vi.useRealTimers()
})

describe('EnergySolarPage', () => {
  test('today: self-use, the peak hour, the battery and its strip', () => {
    state.solar = solarMonth({ assets: [ROOF, BATTERY] })
    renderInGroup(<EnergySolarPage />)
    expect(screen.getByText('Thuis · 4,200 Wp solar · 10 kWh battery')).toBeVisible()
    expect(screen.getByText('kWh · 67%')).toBeVisible()
    expect(
      screen.getByText('Today 31% of your usage came from your roof and your battery.'),
    ).toBeVisible()
    expect(
      screen.getByRole('figure', { name: 'Peak at 12:00, 0.95 kWh per hour.' }),
    ).toBeVisible()
    const battery = screen.getByRole('region', { name: 'Battery' })
    expect(battery).toHaveTextContent('64%')
    expect(battery).toHaveTextContent('6.4 of 10 kWh')
    expect(battery).toHaveTextContent('4.8 kWh · avg. €0.20')
    expect(battery).toHaveTextContent('Earned€0.59')
    const charge = screen.getByRole('figure', {
      name: /Charged 02:00–04:00. Discharged 17:00–19:00./,
    })
    const modes = [...charge.querySelectorAll('[data-mode]')].map((each) =>
      each.getAttribute('data-mode'),
    )
    expect(modes).toHaveLength(24)
    expect(modes[2]).toBe('charging')
    expect(modes[17]).toBe('discharging')
    expect(modes[5]).toBe('idle')
    expect(modes[19]).toBe('unknown')
    expect(modes[20]).toBe('future')
  })

  test('the month: self-sufficiency per day against its average', () => {
    renderInGroup(<EnergySolarPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'November' }))
    expect(screen.getByText(/Self-sufficiency this month 31%/)).toBeVisible()
    const figure = screen.getByRole('figure', {
      name: 'Average 31% (dashed line).',
    })
    expect(figure.querySelectorAll('[data-bar]')).toHaveLength(30)
    expect(figure.querySelector('[data-average]')).not.toBeNull()
  })

  test('earnings without a price say they are not known', () => {
    const month = solarMonth()
    const day = month.days[0]
    if (day?.battery) {
      day.battery = { ...day.battery, chargeEur: null, dischargeEur: null }
    }
    state.solar = month
    renderInGroup(<EnergySolarPage />)
    const battery = screen.getByRole('region', { name: 'Battery' })
    expect(battery).toHaveTextContent('EarnedNot available yet')
    expect(battery).not.toHaveTextContent('Earned =')
  })

  test('without a charge level there is no charge level card', () => {
    state.solar = solarMonth({ batterySoc: false })
    renderInGroup(<EnergySolarPage />)
    expect(screen.getByRole('region', { name: 'Battery' })).toBeVisible()
    expect(screen.queryByRole('figure', { name: /Charged/ })).toBeNull()
  })

  test('facts the site cannot measure are left out, not zero', () => {
    const month = solarMonth({ battery: false, batterySoc: false })
    month.days = month.days.map((day) => ({
      ...day,
      selfUsedKwh: null,
      returnedKwh: null,
      consumptionKwh: null,
      ownKwh: null,
      battery: null,
    }))
    state.solar = month
    renderInGroup(<EnergySolarPage />)
    expect(screen.getByText('Generated')).toBeVisible()
    expect(screen.queryByText('Self-used')).toBeNull()
    expect(screen.queryByRole('region', { name: 'Battery' })).toBeNull()
    expect(screen.getByText(/does not measure power from or to the grid/)).toBeVisible()
  })

  test('typed readings: why there is nothing, and no zeros', () => {
    state.solar = solarMonth({ status: 'noHourly', days: [], firstDay: null })
    renderInGroup(<EnergySolarPage />)
    expect(
      screen.getByRole('heading', { name: 'This needs hourly figures' }),
    ).toBeVisible()
    expect(screen.queryByRole('tab')).toBeNull()
    expect(document.body).not.toHaveTextContent('0.0')
  })

  test('payback shows for an asset with a price only', () => {
    state.solar = solarMonth({
      assets: [ROOF, BATTERY],
      firstDay: '2026-10-31',
    })
    const october = solarMonth()
    state.months = {
      '2026-10': {
        ...october,
        days: october.days.map((day) => ({
          ...day,
          day: '2026-10-31',
          solarEur: 100,
        })),
      },
    }
    renderInGroup(<EnergySolarPage />)
    const roof = screen.getByRole('button', { name: /Roof/ })
    expect(roof).toHaveTextContent('€101 of €5,200 paid back')
    expect(roof).toHaveTextContent('4,200 Wp · since March 2023')
    expect(roof).toHaveTextContent('Counted since October 2026')
    expect(screen.getByRole('button', { name: /Sessy/ })).not.toHaveTextContent(
      'paid back',
    )
  })

  test('adds a battery, and asks before removing one', async () => {
    state.solar = solarMonth({ assets: [BATTERY] })
    renderInGroup(<EnergySolarPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Add panels or a battery' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Home battery' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Give it a name.')
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Sessy 2' } })
    fireEvent.change(screen.getByLabelText('Capacity'), { target: { value: '5' } })
    fireEvent.change(screen.getByLabelText('Purchase price'), {
      target: { value: '3200' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(state.calls).toHaveLength(1))
    expect(state.calls[0]).toMatchObject({
      name: 'energyAssets:save',
      args: {
        assetId: undefined,
        today: '2026-11-20',
        asset: {
          kind: 'battery',
          name: 'Sessy 2',
          capacityKwh: 5,
          purchaseCents: 320_000,
        },
      },
    })

    fireEvent.click(await screen.findByRole('button', { name: /Sessy/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(state.calls).toHaveLength(1)
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(state.calls).toHaveLength(2))
    expect(state.calls[1]).toMatchObject({
      name: 'energyAssets:remove',
      args: { assetId: 'asset2' },
    })
  })
})
