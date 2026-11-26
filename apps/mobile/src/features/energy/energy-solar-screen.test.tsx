// @vitest-environment jsdom
/**
 * Solar and battery (APP-496): today and the month, the battery's earnings
 * and strip, payback per asset, and the form to keep them. A site that cannot
 * measure something says so and never shows a zero for it.
 */
import { createElement } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { mount, settle } from '../../testing/dom'
import { EnergyAssetScreen } from './energy-asset-screen'
import { EnergySolarScreen } from './energy-solar-screen'
import {
  batteryHours,
  byTestId,
  callsTo,
  energyState,
  resetEnergyState,
  solarMonth,
  typeInto,
  usagePeriod,
} from './energy-test-mocks'

vi.mock('react-native', async () => (await import('./energy-test-mocks')).reactNativeMock())
vi.mock('react-native-svg', async () => (await import('./energy-test-mocks')).svgMock())
vi.mock('react-native-safe-area-context', async () =>
  (await import('./energy-test-mocks')).safeAreaMock(),
)
vi.mock('expo-router', async () => (await import('./energy-test-mocks')).routerMock())
vi.mock('convex/react', async () => (await import('./energy-test-mocks')).convexReactMock())
vi.mock('../../convex/api', async () => (await import('./energy-test-mocks')).apiMock())
vi.mock('../../convex/queries', async () => (await import('./energy-test-mocks')).queriesMock())
vi.mock('../../group/GroupProvider', async () => (await import('./energy-test-mocks')).groupMock())
vi.mock('../../i18n', async () => (await import('./energy-test-mocks')).i18nMock())
vi.mock('../../theme/icons', async () => (await import('./energy-test-mocks')).iconsMock())
vi.mock('../../theme/tokens', async () => (await import('./energy-test-mocks')).tokensMock())
vi.mock('../../feedback/haptics', async () => (await import('./energy-test-mocks')).hapticsMock())
vi.mock('../../components/LoadingSkeleton', async () =>
  (await import('./energy-test-mocks')).skeletonMock(),
)
vi.mock('../../components/DateTimeField', async () =>
  (await import('./energy-test-mocks')).dateTimeMock(),
)
vi.mock('../../ui/button', async () => (await import('./energy-test-mocks')).buttonMock())
vi.mock('../../ui/card', async () => (await import('./energy-test-mocks')).cardMock())
vi.mock('../../ui/section-label', async () =>
  (await import('./energy-test-mocks')).sectionLabelMock(),
)
vi.mock('../../ui/inset-list', async () => (await import('./energy-test-mocks')).insetListMock())
vi.mock('../../ui/text-scale', async () => (await import('./energy-test-mocks')).textScaleMock())
vi.mock('../../modules/moduleDestination', async () =>
  (await import('./energy-test-mocks')).moduleDestinationMock(),
)
vi.mock('../../feedback/confirmDestructive', async () =>
  (await import('./energy-test-mocks')).confirmMock(),
)
vi.mock('../../components/Segmented', async () =>
  (await import('./energy-test-mocks')).segmentedMock(),
)

const NOW = Date.parse('2026-11-23T12:00:00Z')
const TODAY = '2026-11-23'
const ROOF = {
  _id: 'roof',
  asset: {
    kind: 'solar',
    name: 'Roof',
    peakWatt: 4200,
    installedOn: '2023-03-01',
    purchaseCents: 520_000,
  },
}
const BATTERY = {
  _id: 'sessy',
  asset: { kind: 'battery', name: 'Sessy', capacityKwh: 10 },
}

beforeEach(() => {
  resetEnergyState()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  energyState.queries['energySolar:month'] = solarMonth()
  energyState.queries['energyUsage:day'] = usagePeriod({
    days: [TODAY],
    lastDay: TODAY,
    hasHourly: true,
    channels: { solar: true, battery: true, batterySoc: true },
    hours: batteryHours(NOW),
  })
})
afterEach(() => {
  vi.useRealTimers()
})

const open = () => mount(createElement(EnergySolarScreen))
const click = async (id: string) => {
  byTestId(id)?.click()
  await settle()
}

test('today: self-use, the peak hour, the battery and its strip', () => {
  energyState.queries['energySolar:month'] = solarMonth({
    assets: [ROOF, BATTERY],
  })
  const view = open()
  expect(document.body.textContent).toContain('4,200 Wp solar · 10 kWh battery')
  expect(byTestId('energy-solar-fact-self')?.getAttribute('aria-label')).toBe(
    'Self-used, 4.0 kWh · 67%',
  )
  expect(document.body.textContent).toContain(
    'Today 31% of your usage came from your roof and your battery.',
  )
  const chart = byTestId('energy-solar-hours')
  expect(chart?.getAttribute('aria-label')).toBe('Peak at 11:00, 0.95 kWh per hour.')
  expect(chart?.querySelector('[aria-hidden="true"]')).not.toBeNull()
  const battery = byTestId('energy-solar-battery')?.textContent
  expect(battery).toContain('64%')
  expect(battery).toContain('6.4 of 10 kWh')
  expect(battery).toContain('Earned€0.59')
  const charge = byTestId('energy-soc-chart')
  expect(charge?.getAttribute('aria-label')).toContain('Charged 02:00–04:00.')
  const cells = charge?.querySelectorAll('[data-testid^="energy-strip-"]') ?? []
  expect(cells).toHaveLength(24)
  expect(cells[2]?.getAttribute('data-testid')).toBe('energy-strip-charging')
  expect(cells[8]?.getAttribute('data-testid')).toBe('energy-strip-discharging')
  expect(cells[20]?.getAttribute('data-border-style')).toBe('dashed')
  view.unmount()
})

test('the month: a bar per day against the average', async () => {
  const view = open()
  await click('segment-month')
  expect(byTestId('energy-solar-days')?.getAttribute('aria-label')).toBe(
    'Average 31% (dashed line).',
  )
  expect(byTestId('energy-average')).not.toBeNull()
  expect(byTestId('energy-soc-chart')).toBeNull()
  view.unmount()
})

test('typed readings: why there is nothing, and no zeros', () => {
  energyState.queries['energySolar:month'] = solarMonth({
    status: 'noHourly',
    days: [],
    firstDay: null,
  })
  const view = open()
  expect(byTestId('energy-solar-why')?.textContent).toContain(
    'This needs hourly figures',
  )
  expect(byTestId('segment-today')).toBeNull()
  expect(document.body.textContent).not.toMatch(/0\.0/)
  byTestId('energy-solar-fix')?.click()
  expect(energyState.pushes).toEqual(['/all/energy/connect'])
  view.unmount()
})

test('earnings without a price say they are not known', () => {
  const month = solarMonth()
  const day = month.days[0]
  energyState.queries['energySolar:month'] = {
    ...month,
    days: [
      { ...day, battery: { ...day?.battery, chargeEur: null, dischargeEur: null } },
    ],
  }
  const view = open()
  expect(byTestId('energy-solar-battery')?.textContent).toContain(
    'EarnedNot available yet',
  )
  view.unmount()
})

test('without a charge level there is no charge level card', () => {
  energyState.queries['energySolar:month'] = {
    ...solarMonth(),
    batterySoc: false,
  }
  const view = open()
  expect(byTestId('energy-solar-battery')).not.toBeNull()
  expect(byTestId('energy-usage-soc')).toBeNull()
  view.unmount()
})

test('payback shows for an asset with a price, and opens its form', () => {
  const october = {
    ...solarMonth(),
    days: solarMonth().days.map((day) => ({
      ...day,
      day: '2026-10-31',
      solarEur: 100,
    })),
  }
  energyState.queries['energySolar:month'] = (args: { month: string }) =>
    args.month === '2026-10'
      ? october
      : solarMonth({ assets: [ROOF, BATTERY], firstDay: '2026-10-31' })
  const view = open()
  expect(byTestId('energy-asset-roof')?.textContent).toContain(
    '€101 of €5,200 paid back',
  )
  expect(byTestId('energy-asset-sessy')?.textContent).not.toContain('paid back')
  byTestId('energy-asset-roof')?.click()
  expect(energyState.pushes).toEqual([
    { pathname: '/all/energy/asset', params: { id: 'roof' } },
  ])
  view.unmount()
})

test('payback names the days left out, also when none has a price (APP-920)', () => {
  const unpriced = solarMonth({
    assets: [ROOF, { ...BATTERY, asset: { ...BATTERY.asset, purchaseCents: 400_000 } }],
    days: solarMonth().days.map((day) => ({ ...day, solarEur: null, batteryEur: null })),
  })
  energyState.queries['energySolar:month'] = () => unpriced
  const view = open()
  const roof = byTestId('energy-asset-roof')?.textContent
  expect(roof).toContain('Nothing to count yet of €5,200')
  expect(roof).toContain('1 day is left out: it has no contract or no price yet.')
  expect(byTestId('energy-asset-sessy')?.textContent).toContain(
    '1 day is left out: it has no contract or price yet, or only charging or discharging was measured.',
  )
  view.unmount()
})

test('adds a battery, after saying what is missing', async () => {
  const view = mount(createElement(EnergyAssetScreen))
  await click('segment-battery')
  await click('energy-asset-save')
  expect(byTestId('energy-asset-problem')?.textContent).toBe('Give it a name.')
  typeInto(byTestId('energy-asset-name'), 'Sessy 2')
  typeInto(byTestId('energy-asset-capacity'), '5,12')
  typeInto(byTestId('energy-asset-purchase'), '3.200')
  await settle()
  await click('energy-asset-save')
  expect(callsTo('energyAssets:save')).toEqual([
    {
      groupSlug: 'home',
      assetId: undefined,
      today: TODAY,
      asset: {
        kind: 'battery',
        name: 'Sessy 2',
        peakWatt: undefined,
        capacityKwh: 5.12,
        installedOn: undefined,
        purchaseCents: 320_000,
      },
    },
  ])
  expect(energyState.backs).toBe(1)
  view.unmount()
})

test('asks before it removes an asset', async () => {
  energyState.queries['energySolar:month'] = solarMonth({ assets: [ROOF] })
  const view = mount(createElement(EnergyAssetScreen, { assetId: 'roof' }))
  await click('energy-asset-remove')
  expect(callsTo('energyAssets:remove')).toEqual([])
  expect(energyState.confirms[0]?.title).toBe('Remove Roof?')
  energyState.confirms[0]?.onConfirm()
  await settle()
  expect(callsTo('energyAssets:remove')).toEqual([
    { groupSlug: 'home', assetId: 'roof' },
  ])
  view.unmount()
})

test('an asset someone else removed says it is gone', () => {
  const view = mount(createElement(EnergyAssetScreen, { assetId: 'old' }))
  expect(document.body.textContent).toContain('This no longer exists.')
  view.unmount()
})
