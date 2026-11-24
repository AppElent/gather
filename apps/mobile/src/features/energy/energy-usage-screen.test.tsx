// @vitest-environment jsdom
/**
 * Usage (APP-494, designs/energy section 11.2): Day per hour from an hourly
 * source, Month per day, Year against the year before. A site with only
 * typed readings has no hours, so its Day draws no hour chart and no battery
 * chart and says why. Each chart is one VoiceOver element that states the
 * answer, with its bars hidden.
 */
import { amsterdamDayHours, energyMonthDays } from '@gather/core/energy'
import { createElement } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { en } from '../../i18n/messages/en'
import { mount, settle } from '../../testing/dom'
import { byTestId, energyState, resetEnergyState, usagePeriod } from './energy-test-mocks'
import { EnergyUsageScreen } from './energy-usage-screen'

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

const NOW = Date.parse('2026-11-23T12:00:00Z')
const TODAY = '2026-11-23'

const button = (label: string) =>
  document.querySelector<HTMLElement>(`button[aria-label="${label}"]`)

function hourlyDay() {
  const hours = amsterdamDayHours(TODAY)
    .filter((start) => start < NOW)
    .map((hourStart, index) => ({
      hourStart,
      hasData: true,
      importKwh: index === 7 ? 1.5 : 0.4,
        consumptionKwh: index === 7 ? 1.5 : 0.4,
        batteryChargeKwh: null,
        batteryDischargeKwh: null,
      exportKwh: 0,
      solarKwh: null,
      socPercent: 20 + index * 5,
    }))
  return usagePeriod({
    days: [TODAY],
    lastDay: TODAY,
    kwhPerDay: 6,
    hasHourly: true,
    channels: { battery: true, batterySoc: true },
    hours,
  })
}

beforeEach(() => {
  resetEnergyState()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  energyState.queries['energyUsage:month'] = (args: { month: string }) =>
    usagePeriod({
      days: energyMonthDays(args.month),
      lastDay: args.month < '2026-11' ? `${args.month}-31` : '2026-11-22',
      kwhPerDay: args.month < '2026-01' ? 12 : 10,
    })
})
afterEach(() => {
  vi.useRealTimers()
})

test('Day from an hourly source draws the hours, the battery and the facts', () => {
  energyState.queries['energyUsage:day'] = hourlyDay()
  const view = mount(createElement(EnergyUsageScreen))
  const chart = byTestId('energy-usage-hours')
  expect(chart?.getAttribute('role')).toBe('image')
  expect(chart?.getAttribute('aria-label')).toMatch(/kWh/)
  expect(chart?.querySelector('[aria-hidden="true"]')).not.toBeNull()
  // The hours after now are still to come: dashed outlines, not zero bars.
  expect(chart?.querySelectorAll('[data-border-style="dashed"]').length).toBe(
    amsterdamDayHours(TODAY).filter((start) => start > NOW).length,
  )
  expect(document.body.textContent).toContain(chart?.getAttribute('aria-label'))
  expect(byTestId('energy-usage-soc')).not.toBeNull()
  expect(byTestId('energy-usage-no-hours')).toBeNull()
  expect(byTestId('energy-fact-grid')).not.toBeNull()
  expect(byTestId('energy-usage-total-value')?.textContent).toBe('6.0')
  view.unmount()
})

test('Day for a site with only meter readings has no hour or battery chart', () => {
  energyState.queries['energyUsage:day'] = usagePeriod({
    days: [TODAY],
    lastDay: TODAY,
    kwhPerDay: 9,
  })
  const view = mount(createElement(EnergyUsageScreen))
  expect(byTestId('energy-usage-hours')).toBeNull()
  expect(byTestId('energy-usage-soc')).toBeNull()
  expect(byTestId('energy-usage-no-hours')?.textContent).toBe(en.energy.usage.noHours)
  expect(byTestId('energy-usage-total-value')?.textContent).toBe('9.0')
  expect(byTestId('energy-usage-total')?.textContent).toContain(
    en.energy.usage.estimatedNote,
  )
  view.unmount()
})

test('Month draws a bar per day, the days to come dashed', async () => {
  energyState.queries['energyUsage:day'] = hourlyDay()
  const view = mount(createElement(EnergyUsageScreen))
  button(en.energy.usage.month)?.click()
  await settle()
  const chart = byTestId('energy-usage-days')
  expect(chart?.getAttribute('role')).toBe('image')
  expect(chart?.querySelectorAll('[data-border-style="dashed"]').length).toBe(7)
  expect(byTestId('energy-usage-total-value')?.textContent).toBe('220.0')
  expect(byTestId('energy-usage-period-label')?.textContent).toBe('November 2026')
  view.unmount()
})

test('Year compares the completed months with the year before', () => {
  const view = mount(createElement(EnergyUsageScreen, { initialRange: 'year' }))
  const chart = byTestId('energy-usage-year')
  expect(chart?.getAttribute('role')).toBe('image')
  expect(chart?.getAttribute('aria-label')).toContain('2025')
  expect(byTestId('energy-usage-year-rows')).not.toBeNull()
  expect(byTestId('energy-usage-period-next')?.hasAttribute('disabled')).toBe(true)
  view.unmount()
})

test('the costs row opens Costs on the month in view', () => {
  energyState.queries['energyUsage:day'] = hourlyDay()
  const view = mount(createElement(EnergyUsageScreen))
  byTestId('energy-usage-costs')?.click()
  expect(energyState.pushes).toEqual([
    { pathname: '/all/energy/costs', params: { month: '2026-11' } },
  ])
  view.unmount()
})

test('a month in the route opens that month', () => {
  const view = mount(createElement(EnergyUsageScreen, { initialMonth: '2026-09' }))
  expect(byTestId('energy-usage-days')).not.toBeNull()
  expect(byTestId('energy-usage-period-label')?.textContent).toBe('September 2026')
  view.unmount()
})

test('a day in the route opens that day, and its month behind it', async () => {
  energyState.queries['energyUsage:day'] = hourlyDay()
  const view = mount(createElement(EnergyUsageScreen, { initialDay: '2026-09-14' }))
  expect(byTestId('energy-usage-period-label')?.textContent).toContain('14')
  button(en.energy.usage.month)?.click()
  await settle()
  expect(byTestId('energy-usage-period-label')?.textContent).toBe('September 2026')
  view.unmount()
})

test('a month in the route still to come opens this month', () => {
  const view = mount(
    createElement(EnergyUsageScreen, { initialRange: 'month', initialMonth: '2026-12' }),
  )
  expect(byTestId('energy-usage-period-label')?.textContent).toBe('November 2026')
  view.unmount()
})
