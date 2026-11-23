// @vitest-environment jsdom
/** Prices per hour, today and tomorrow (APP-493). */
import { createElement } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { mount, settle } from '../../testing/dom'
import { EnergyPricesScreen } from './energy-prices-screen'
import { byTestId, energyState, priceView, resetEnergyState } from './energy-test-mocks'

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
vi.mock('../../ui/field', async () => (await import('./energy-test-mocks')).fieldMock())
vi.mock('../../ui/module-tile', async () => (await import('./energy-test-mocks')).moduleTileMock())
vi.mock('../../ui/screen-header', async () =>
  (await import('./energy-test-mocks')).screenHeaderMock(),
)
vi.mock('../../ui/wash-header', async () => (await import('./energy-test-mocks')).washHeaderMock())
vi.mock('@expo/ui/community/menu', async () => (await import('./energy-test-mocks')).menuMock())

vi.mock('../../feedback/confirmDestructive', async () =>
  (await import('./energy-test-mocks')).confirmMock(),
)

vi.mock('../../components/Segmented', async () =>
  (await import('./energy-test-mocks')).segmentedMock(),
)

beforeEach(() => {
  resetEnergyState()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-23T12:10:00Z'))
  energyState.queries['energyPrices:view'] = priceView()
})
afterEach(() => {
  vi.useRealTimers()
})

const text = () => document.body.textContent ?? ''
const label = (id: string) => byTestId(id)?.getAttribute('aria-label')

test('today: the price now, the chart in words, the facts and the build-up', () => {
  const view = mount(createElement(EnergyPricesScreen))
  expect(energyState.wash).toEqual({
    count: 'Power now €0.40 per kWh',
    sub: 'Thuis · EnergyZero + Frank Energie',
  })
  expect(label('energy-prices-chart')).toBe(
    'Price per hour today. Now 40 cents. Cheapest 02:00 to 05:00, on average 20 cents. Most expensive at 13:00, 40 cents.',
  )
  expect(byTestId('energy-prices-facts')?.textContent).toContain('02:00–05:00 · €0.20')
  expect(byTestId('energy-price-build-up')?.textContent).toContain('What makes up €0.40')
  expect(text()).toContain('EnergyZero · tomorrow fetched')
  byTestId('energy-prices-source')?.click()
  expect(energyState.pushes).toEqual(['/all/energy/price-source'])
  view.unmount()
})

test('tomorrow has its own chart and no build-up', async () => {
  const view = mount(createElement(EnergyPricesScreen))
  byTestId('segment-tomorrow')?.click()
  await settle()
  expect(label('energy-prices-chart')).toMatch(/^Price per hour tomorrow\. Cheapest 12:00 to 15:00/)
  expect(byTestId('energy-price-build-up')).toBeNull()
  view.unmount()
})

test('before tomorrow is in, it says when to expect it', async () => {
  energyState.queries['energyPrices:view'] = priceView({ tomorrow: null })
  const view = mount(createElement(EnergyPricesScreen))
  byTestId('segment-tomorrow')?.click()
  await settle()
  expect(text()).toContain('Tomorrow’s prices are expected around 13:30.')
  expect(byTestId('energy-prices-chart')).toBeNull()
  view.unmount()
})

test('a failed fetch is said in words with the last good time, and today stays', () => {
  energyState.queries['energyPrices:view'] = priceView({
    provider: 'tibber',
    status: 'error',
    lastError: 'unreachable',
  })
  const view = mount(createElement(EnergyPricesScreen))
  expect(text()).toMatch(/Tibber does not answer\. Last worked: .*12:40/)
  expect(byTestId('energy-prices-chart')).not.toBeNull()
  view.unmount()
})
