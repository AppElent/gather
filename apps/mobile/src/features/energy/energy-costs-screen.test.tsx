// @vitest-environment jsdom
/**
 * Costs per month (APP-494, designs/energy sections 5 and 11.4): the
 * with/without net metering switch where the month still has the choice,
 * none from 2027, and words instead of an amount when a dynamic contract's
 * prices have not come in.
 */
import { energyMonthDays } from '@gather/core/energy'
import { formatEnergyEuro } from '@gather/core/energy-present'
import { createElement } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { en } from '../../i18n/messages/en'
import { mount, settle } from '../../testing/dom'
import { EnergyCostsScreen } from './energy-costs-screen'
import {
  byTestId,
  energyState,
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

const button = (label: string) =>
  document.querySelector<HTMLElement>(`button[aria-label="${label}"]`)

/** `energyUsage.month` answers `period` for `month`, nothing for others. */
function answerMonth(month: string, period: unknown) {
  energyState.queries['energyUsage:month'] = (args: { month: string }) =>
    args.month === month ? period : null
}

beforeEach(() => {
  resetEnergyState()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-23T12:00:00Z'))
})
afterEach(() => {
  vi.useRealTimers()
})

test('with net metering the month shows that amount, and the switch shows the other', async () => {
  answerMonth(
    '2026-10',
    usagePeriod({
      days: energyMonthDays('2026-10'),
      lastDay: '2026-10-31',
      netMeteringChoice: true,
      cost: 4210,
      costWithoutNet: 5000,
    }),
  )
  const view = mount(createElement(EnergyCostsScreen, { initialMonth: '2026-10' }))
  expect(byTestId('energy-costs-total-value')?.textContent).toBe(
    formatEnergyEuro(4210, 'en'),
  )
  button(en.energy.costs.withoutNet)?.click()
  await settle()
  expect(byTestId('energy-costs-total-value')?.textContent).toBe(
    formatEnergyEuro(5000, 'en'),
  )
  expect(byTestId('energy-costs-total')?.textContent).toContain(
    formatEnergyEuro(790, 'en'),
  )
  view.unmount()
})

test('a 2027 month has no net metering switch', () => {
  vi.setSystemTime(new Date('2027-02-10T12:00:00Z'))
  answerMonth(
    '2027-01',
    usagePeriod({
      days: energyMonthDays('2027-01'),
      lastDay: '2027-01-31',
      netMeteringChoice: false,
      cost: 6000,
      costWithoutNet: 6000,
    }),
  )
  const view = mount(createElement(EnergyCostsScreen, { initialMonth: '2027-01' }))
  expect(button(en.energy.costs.withNet)).toBeNull()
  expect(button(en.energy.costs.withoutNet)).toBeNull()
  expect(byTestId('energy-costs-total-value')?.textContent).toBe(
    formatEnergyEuro(6000, 'en'),
  )
  expect(byTestId('energy-costs-total')?.textContent).toContain(
    en.energy.costs.noteFrom2027,
  )
  view.unmount()
})

test('without prices for a dynamic contract, the month says so instead of an amount', () => {
  answerMonth(
    '2026-11',
    usagePeriod({
      days: energyMonthDays('2026-11'),
      lastDay: '2026-11-22',
      costStatus: 'noPrices',
    }),
  )
  const view = mount(createElement(EnergyCostsScreen))
  expect(byTestId('energy-costs-total-value')).toBeNull()
  expect(byTestId('energy-costs-total')?.textContent).toContain(
    'The costs for November are not available yet: the prices of your dynamic contract have not come in.',
  )
  view.unmount()
})

test('the year chart links to Usage in euro', () => {
  answerMonth(
    '2026-11',
    usagePeriod({
      days: energyMonthDays('2026-11'),
      lastDay: '2026-11-22',
      cost: 3000,
    }),
  )
  const view = mount(createElement(EnergyCostsScreen))
  byTestId('energy-costs-year-link')?.click()
  expect(energyState.pushes).toEqual([
    {
      pathname: '/all/energy/usage',
      params: { range: 'year', unit: 'euro', year: '2026', month: '2026-11' },
    },
  ])
  view.unmount()
})

test.each([
  ['differ', (day: string) => (day === '2026-11-05' ? 500 : 300), true],
  ['are all the same', () => 300, false],
  ['are all zero', () => 0, false],
])('when the days %s, the highest day is captioned: %#', (_name, dayCost, named) => {
  answerMonth(
    '2026-11',
    usagePeriod({
      days: energyMonthDays('2026-11'),
      lastDay: '2026-11-22',
      cost: 3000,
      dayCost,
    }),
  )
  const view = mount(createElement(EnergyCostsScreen))
  const caption = byTestId('energy-costs-days-caption')?.textContent ?? null
  if (named) expect(caption).toContain('Highest on November 5')
  else {
    expect(caption).toBeNull()
    expect(byTestId('energy-costs-days')?.getAttribute('aria-label')).toBe(
      'Costs per day in November.',
    )
  }
  view.unmount()
})
