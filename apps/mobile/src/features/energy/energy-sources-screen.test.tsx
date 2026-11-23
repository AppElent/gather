// @vitest-environment jsdom
/** Sources (APP-495): each source with its state in words, for everyone; connecting is for admins. */
import { createElement } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { en } from '../../i18n/messages/en'
import { mount } from '../../testing/dom'
import { EnergySourcesScreen } from './energy-sources-screen'
import { byTestId, energyState, resetEnergyState } from './energy-test-mocks'

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



const list = {
  siteName: 'Thuis',
  canManage: true,
  homeAssistantAddress: null,
  sources: [
    {
      _id: 'ha',
      kind: 'homeAssistant',
      label: 'Home Assistant',
      status: 'ok',
      connected: true,
      lastSyncedAt: Date.parse('2026-11-23T11:15:00Z'),
      channelCount: 3,
      readings: [],
    },
  ],
  channels: [
    { _id: 'c1', sourceId: 'ha', kind: 'gridImport', tariff: 'low' },
    { _id: 'c2', sourceId: 'ha', kind: 'gridImport', tariff: 'normal' },
    { _id: 'c3', sourceId: 'ha', kind: 'gas' },
  ],
}

beforeEach(() => {
  resetEnergyState()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-23T12:00:00Z'))
})
afterEach(() => {
  vi.useRealTimers()
})

test('a connected source says when it was read, and opens its connection', () => {
  energyState.queries['energySources:list'] = list
  const view = mount(createElement(EnergySourcesScreen))
  const row = byTestId('energy-source-row-homeAssistant')
  expect(row?.textContent).toContain('12:15')
  expect(row?.querySelector('[data-tone="danger"]')).toBeNull()
  // A split meter is one row of the channels list.
  expect(byTestId('energy-channels')?.children).toHaveLength(2)
  // One Home Assistant per address.
  expect(byTestId('energy-add-home-assistant')).toBeNull()
  row?.click()
  expect(energyState.pushes).toEqual(['/all/energy/connect'])
  view.unmount()
})

test.each([
  ['unreachable', 'error', en.energy.sources.problems.unreachable],
  ['badToken', 'needsReconnect', en.energy.sources.problems.badToken],
] as const)('%s reads as a problem with the last time', (lastError, status, words) => {
  energyState.queries['energySources:list'] = {
    ...list,
    sources: [{ ...list.sources[0], status, lastError }],
  }
  const view = mount(createElement(EnergySourcesScreen))
  const line = byTestId('energy-source-row-homeAssistant')?.querySelector(
    '[data-tone="danger"]',
  )
  expect(line?.textContent).toContain(words)
  expect(line?.textContent).toContain('12:15')
  expect(byTestId('energy-channels')).not.toBeNull()
  view.unmount()
})

test('a Member sees the sources but cannot connect one', () => {
  energyState.queries['energySources:list'] = {
    ...list,
    canManage: false,
    sources: [],
    channels: [],
  }
  const view = mount(createElement(EnergySourcesScreen))
  const row = byTestId('energy-add-home-assistant')
  expect(row?.textContent).toContain(en.energy.sources.adminsConnect)
  row?.click()
  expect(energyState.pushes).toEqual([])
  byTestId('energy-add-manual')?.click()
  expect(energyState.pushes).toEqual(['/all/energy/readings'])
  view.unmount()
})
