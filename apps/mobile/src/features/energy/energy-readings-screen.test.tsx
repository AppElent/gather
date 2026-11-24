// @vitest-environment jsdom
/**
 * Meter readings (APP-494, designs/energy section 10): a reading lower than
 * the one before it is refused in its row before anything is sent, a good
 * one is saved, and a Group without meters first says which it reads.
 */
import { amsterdamIsoDate } from '@gather/core/civil-date'
import { createElement } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'

import { en } from '../../i18n/messages/en'
import { mount, settle } from '../../testing/dom'
import { EnergyReadingsScreen } from './energy-readings-screen'
import {
  blur,
  byTestId,
  callsTo,
  energyState,
  resetEnergyState,
  typeInto,
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

const meter = {
  _id: 'c1',
  kind: 'gridImport',
  tariff: 't1',
  unit: 'kWh',
  previous: { value: 1234.5, at: Date.UTC(2026, 9, 1, 10) },
  onDay: null,
  next: null,
}

beforeEach(() => {
  resetEnergyState()
  energyState.queries['energyReadings:form'] = {
    hasManualSource: true,
    lastReadingAt: null,
    measured: [],
    channels: [meter],
  }
})

test('a reading lower than the previous one is refused in its row, without saving', async () => {
  const view = mount(createElement(EnergyReadingsScreen))
  typeInto(byTestId('energy-reading-c1'), '1000')
  await settle()
  expect(byTestId('energy-reading-c1-problem')).toBeNull()
  byTestId('energy-readings-save')?.click()
  await settle()
  expect(byTestId('energy-reading-c1-problem')?.textContent).toBe(
    'Lower than the previous reading (1,234.5). New meter? Then add a new channel under Sources.',
  )
  expect(callsTo('energyReadings:save')).toEqual([])
  view.unmount()
})

test('leaving a field shows its problem straight away', async () => {
  const view = mount(createElement(EnergyReadingsScreen))
  typeInto(byTestId('energy-reading-c1'), 'abc')
  blur(byTestId('energy-reading-c1'))
  await settle()
  expect(byTestId('energy-reading-c1-problem')?.textContent).toBe(
    en.energy.readings.notANumber,
  )
  view.unmount()
})

test('nothing typed asks for one reading', async () => {
  const view = mount(createElement(EnergyReadingsScreen))
  byTestId('energy-readings-save')?.click()
  await settle()
  expect(byTestId('energy-readings-problem')?.textContent).toBe(
    en.energy.readings.nothingTyped,
  )
  expect(callsTo('energyReadings:save')).toEqual([])
  view.unmount()
})

test('a good reading is saved for the day and the screen closes', async () => {
  const view = mount(createElement(EnergyReadingsScreen))
  typeInto(byTestId('energy-reading-c1'), '1240.5')
  await settle()
  byTestId('energy-readings-save')?.click()
  await settle()
  expect(callsTo('energyReadings:save')).toEqual([
    {
      groupSlug: 'home',
      day: amsterdamIsoDate(),
      readings: [{ channelId: 'c1', value: 1240.5 }],
    },
  ])
  expect(energyState.backs).toBe(1)
  view.unmount()
})

test('without meters, the setup card sends which meters the Group reads', async () => {
  energyState.queries['energyReadings:form'] = {
    hasManualSource: false,
    lastReadingAt: null,
    measured: [],
    channels: [],
  }
  const view = mount(createElement(EnergyReadingsScreen))
  expect(byTestId('energy-meter-setup')).not.toBeNull()
  expect(byTestId('energy-readings-save')).toBeNull()
  expect((byTestId('energy-setup-split') as HTMLInputElement).checked).toBe(true)
  expect((byTestId('energy-setup-export') as HTMLInputElement).checked).toBe(false)
  byTestId('energy-setup-export')?.click()
  byTestId('energy-setup-gas')?.click()
  await settle()
  byTestId('energy-setup-submit')?.click()
  await settle()
  expect(callsTo('energyReadings:setupChannels')).toEqual([
    {
      groupSlug: 'home',
      split: true,
      export: true,
      gas: false,
      sourceLabel: en.energy.site.manualSourceLabel,
    },
  ])
  view.unmount()
})

test('a connected source that measures the meters leaves nothing to set up', async () => {
  energyState.queries['energyReadings:form'] = {
    hasManualSource: true,
    lastReadingAt: null,
    measured: ['gridImport', 'gridExport', 'gas'],
    channels: [],
  }
  const view = mount(createElement(EnergyReadingsScreen))
  expect(byTestId('energy-meter-setup')?.textContent).toBe(
    en.energy.readings.measuredTitle + en.energy.readings.measuredBody,
  )
  expect(byTestId('energy-setup-submit')).toBeNull()
  view.unmount()
})

test('only a meter the connected source does not measure can be added', async () => {
  energyState.queries['energyReadings:form'] = {
    hasManualSource: true,
    lastReadingAt: null,
    measured: ['gridImport', 'gridExport'],
    channels: [],
  }
  const view = mount(createElement(EnergyReadingsScreen))
  expect(byTestId('energy-setup-split')).toBeNull()
  expect(byTestId('energy-setup-export')).toBeNull()
  byTestId('energy-setup-gas')?.click()
  await settle()
  byTestId('energy-setup-submit')?.click()
  await settle()
  expect(callsTo('energyReadings:setupChannels')).toMatchObject([
    { export: false, gas: true },
  ])
  view.unmount()
})

test('the Done key above the decimal keypad puts the keyboard away', () => {
  const view = mount(createElement(EnergyReadingsScreen))
  expect(byTestId('keyboard-done')?.textContent).toBe(en.actions.done)
  byTestId('keyboard-done')?.click()
  expect(energyState.keyboardDismissals).toBe(1)
  expect(callsTo('energyReadings:save')).toEqual([])
  view.unmount()
})
