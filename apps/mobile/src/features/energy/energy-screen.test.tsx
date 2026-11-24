// @vitest-environment jsdom
/**
 * The Energy Module's home (APP-492, APP-494). Empty, its one step opens the
 * address form in place, and Continue sends what the person chose. With an
 * address, the wash names it and when the meters were last read, the first
 * step is a reading until there is one, and rows lead to every Energy screen.
 */
import { energyMonthDays } from '@gather/core/energy'
import { formatEnergyDate } from '@gather/core/energy-present'
import { fmt } from '@gather/core/i18n'
import { createElement } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { en } from '../../i18n/messages/en'
import { mount, settle } from '../../testing/dom'
import { EnergyScreen } from './energy-screen'
import {
  byTestId,
  callsTo,
  energyState,
  priceView,
  resetEnergyState,
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
vi.mock('../../ui/field', async () => (await import('./energy-test-mocks')).fieldMock())
vi.mock('../../ui/module-tile', async () => (await import('./energy-test-mocks')).moduleTileMock())
vi.mock('../../ui/screen-header', async () =>
  (await import('./energy-test-mocks')).screenHeaderMock(),
)
vi.mock('../../ui/wash-header', async () => (await import('./energy-test-mocks')).washHeaderMock())
vi.mock('@expo/ui/community/menu', async () => (await import('./energy-test-mocks')).menuMock())

const withAddress = {
  site: { _id: 's1', name: 'Thuis' },
  sources: [{ _id: 'src1', kind: 'manual', label: 'Meterstanden', status: 'ok' }],
}
const meter = {
  _id: 'c1',
  kind: 'gridImport',
  unit: 'kWh',
  previous: null,
  onDay: null,
  next: null,
}

beforeEach(() => {
  resetEnergyState()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-23T12:10:00Z'))
  energyState.queries['energy:overview'] = null
  energyState.queries['houses:list'] = []
  energyState.queries['energyContracts:list'] = []
  energyState.queries['energyUsage:month'] = usagePeriod({
    days: energyMonthDays('2026-11'),
    lastDay: '2026-11-22',
  })
})
afterEach(() => {
  vi.useRealTimers()
})

test('empty, the wash says there is no address and the step opens the form', async () => {
  const view = mount(createElement(EnergyScreen))
  expect(energyState.wash).toEqual({
    count: 'No address yet',
    sub: 'Usage, costs and prices per hour',
  })
  expect(byTestId('energy-name')).toBeNull()
  byTestId('energy-add-first')?.click()
  await settle()
  expect((byTestId('energy-name') as HTMLInputElement).value).toBe('Home')
  expect(byTestId('energy-source-homeAssistant')?.getAttribute('aria-selected')).toBe(
    'true',
  )
  view.unmount()
})

test('Continue sends meter readings and the chosen House', async () => {
  energyState.queries['houses:list'] = [{ _id: 'house1', name: 'Dorpsstraat 1' }]
  const view = mount(createElement(EnergyScreen))
  byTestId('energy-add-first')?.click()
  await settle()
  byTestId('energy-house-menu-house1')?.click()
  byTestId('energy-source-manual')?.click()
  await settle()
  byTestId('energy-submit')?.click()
  await settle()
  expect(callsTo('energy:createSite')).toEqual([
    {
      groupSlug: 'home',
      name: 'Home',
      houseId: 'house1',
      source: { kind: 'manual', label: 'Meter readings' },
    },
  ])
  view.unmount()
})

test('a refusal is said in words', async () => {
  energyState.refuse = { kind: 'energy:houseNotFound' }
  const view = mount(createElement(EnergyScreen))
  byTestId('energy-add-first')?.click()
  await settle()
  byTestId('energy-submit')?.click()
  await settle()
  expect(document.body.textContent).toContain(
    'That house is not in this Group any more.',
  )
  view.unmount()
})

test('with an address and no meters yet, the first step is a reading', () => {
  energyState.queries['energy:overview'] = withAddress
  energyState.queries['energyReadings:form'] = {
    hasManualSource: true,
    lastReadingAt: null,
    channels: [],
  }
  const view = mount(createElement(EnergyScreen))
  expect(energyState.wash).toEqual({
    count: 'Thuis',
    sub: fmt(en.energy.site.noReadingYet, { source: 'Meterstanden' }),
  })
  expect(byTestId('energy-first-reading')).not.toBeNull()
  expect(byTestId('energy-usage-card')).toBeNull()
  view.unmount()
})

test('with readings, the home shows the month and rows to every Energy screen', () => {
  energyState.queries['energy:overview'] = withAddress
  energyState.queries['energyReadings:form'] = {
    hasManualSource: true,
    lastReadingAt: Date.parse('2026-11-22T10:00:00Z'),
    channels: [meter],
  }
  const view = mount(createElement(EnergyScreen))
  expect(energyState.wash).toEqual({
    count: 'Thuis',
    sub: fmt(en.energy.site.lastReading, {
      source: 'Meterstanden',
      date: formatEnergyDate('2026-11-22', 'en', 'dayMonth'),
    }),
  })
  expect(byTestId('energy-first-reading')).toBeNull()
  expect(byTestId('energy-home-days')?.getAttribute('role')).toBe('image')
  expect(byTestId('energy-nav')?.getAttribute('aria-label')).toBe(
    en.energy.home.navLabel,
  )
  for (const [row, path] of [
    ['usage', '/all/energy/usage'],
    ['costs', '/all/energy/costs'],
    ['readings', '/all/energy/readings'],
    ['contract', '/all/energy/contract'],
    ['sources', '/all/energy/sources'],
  ] as const) {
    byTestId(`energy-row-${row}`)?.click()
    expect(energyState.pushes.at(-1)).toBe(path)
  }
  byTestId('energy-usage-card')?.click()
  expect(energyState.pushes.at(-1)).toEqual({
    pathname: '/all/energy/usage',
    params: { range: 'month', month: '2026-11' },
  })
  view.unmount()
})

test('Home Assistant saves the address and goes on to connecting it', async () => {
  const view = mount(createElement(EnergyScreen))
  byTestId('energy-add-first')?.click()
  await settle()
  byTestId('energy-submit')?.click()
  await settle()
  expect(callsTo('energy:createSite')).toMatchObject([
    { source: { kind: 'homeAssistant' } },
  ])
  expect(energyState.pushes).toEqual(['/all/energy/connect'])
  view.unmount()
})

test('without a source, Home asks to connect one or type a reading', () => {
  energyState.queries['energy:overview'] = { ...withAddress, sources: [] }
  energyState.queries['energyReadings:form'] = {
    hasManualSource: false,
    lastReadingAt: null,
    channels: [],
  }
  const view = mount(createElement(EnergyScreen))
  byTestId('energy-connect')?.click()
  byTestId('energy-first-reading')?.click()
  expect(energyState.pushes).toEqual(['/all/energy/connect', '/all/energy/readings'])
  view.unmount()
})

test('a source in error is said in words with when its data is from, and its data stays', () => {
  energyState.queries['energy:overview'] = {
    ...withAddress,
    sources: [
      {
        _id: 'src1',
        kind: 'homeAssistant',
        label: 'Home Assistant',
        status: 'error',
        lastError: 'unreachable',
        lastSyncedAt: Date.parse('2026-11-23T09:15:00Z'),
      },
    ],
  }
  energyState.queries['energyReadings:form'] = {
    hasManualSource: false,
    lastReadingAt: null,
    channels: [],
  }
  const view = mount(createElement(EnergyScreen))
  expect((energyState.wash as { sub: string }).sub).toMatch(
    /Home Assistant does not answer.*10:15/,
  )
  expect(byTestId('energy-usage-card')).not.toBeNull()
  expect(byTestId('energy-first-reading')).toBeNull()
  view.unmount()
})

test('the Now card and the price card say what power costs, and open Prices', () => {
  energyState.queries['energy:overview'] = withAddress
  energyState.queries['energyReadings:form'] = {
    hasManualSource: true,
    lastReadingAt: null,
    channels: [meter],
  }
  energyState.queries['energyPrices:view'] = priceView()
  const view = mount(createElement(EnergyScreen))
  expect(byTestId('energy-price-now')?.getAttribute('aria-label')).toBe(
    'Power price now: €0.40 per kWh. Expensive: 37% above today’s average. Cheapest tomorrow: 12:00–15:00, on average €0.10',
  )
  expect(byTestId('energy-home-prices')?.getAttribute('aria-label')).toMatch(
    /^Price per hour today\. Now 40 cents\./,
  )
  byTestId('energy-price-card')?.click()
  byTestId('energy-row-prices')?.click()
  expect(energyState.pushes).toEqual(['/all/energy/prices', '/all/energy/prices'])
  view.unmount()
})

test('a price fetch that failed is said on its row, and there are no cards', () => {
  energyState.queries['energy:overview'] = withAddress
  energyState.queries['energyReadings:form'] = {
    hasManualSource: true,
    lastReadingAt: null,
    channels: [meter],
  }
  energyState.queries['energyPrices:view'] = priceView({ today: null, tomorrow: null })
  const view = mount(createElement(EnergyScreen))
  expect(byTestId('energy-price-now')).toBeNull()
  expect(byTestId('energy-row-prices')?.querySelector('[data-tone="danger"]')?.textContent).toContain(
    'EnergyZero has not given all prices yet.',
  )
  view.unmount()
})
