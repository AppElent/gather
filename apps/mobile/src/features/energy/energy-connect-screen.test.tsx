// @vitest-environment jsdom
/** Connecting Home Assistant (APP-495): test, choose channels, connect; the token is only ever sent. */
import { createElement } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'

import { en } from '../../i18n/messages/en'
import { mount, settle } from '../../testing/dom'
import { EnergyConnectScreen } from './energy-connect-screen'
import { byTestId, callsTo, energyState, resetEnergyState, typeInto } from './energy-test-mocks'

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

const tested = {
  version: '2026.11.2',
  hasDashboard: true,
  proposals: [
    {
      kind: 'gridImport',
      tariff: 'low',
      statisticId: 'sensor.p1_t1',
      available: true,
      existing: false,
      on: true,
      suppliedBy: null,
    },
    {
      kind: 'gas',
      statisticId: 'sensor.p1_gas',
      available: true,
      existing: false,
      on: false,
      suppliedBy: 'Meter readings',
    },
  ],
  statistics: [
    { id: 'sensor.p1_t1', name: 'P1 T1', measure: 'energy' },
    { id: 'sensor.other', name: null, measure: 'energy' },
    { id: 'sensor.p1_gas', name: null, measure: 'volume' },
  ],
}
const list = {
  siteName: 'Thuis',
  canManage: true,
  homeAssistantAddress: null as string | null,
  sources: [] as unknown[],
  channels: [],
}
const connectedList = {
  ...list,
  homeAssistantAddress: 'https://ha.example.org',
  sources: [
    {
      _id: 'ha',
      kind: 'homeAssistant',
      label: 'Home Assistant',
      status: 'ok',
      connected: true,
      channelCount: 1,
      readings: [],
    },
  ],
}

beforeEach(() => {
  resetEnergyState()
  energyState.queries['energySources:list'] = list
  energyState.actions['energyHomeAssistant:test'] = tested
})

const switchOf = (index: number) =>
  byTestId(`energy-connect-switch-${index}`) as HTMLInputElement | null

async function testConnection() {
  typeInto(byTestId('energy-connect-address'), 'https://ha.example.org')
  typeInto(byTestId('energy-connect-token'), 'fake-token')
  await settle()
  byTestId('energy-connect-test')?.click()
  await settle()
}

test('a test shows the version and a switch per channel, a supplied one off', async () => {
  const view = mount(createElement(EnergyConnectScreen))
  expect(byTestId('energy-connect-channels')).toBeNull()
  await testConnection()
  expect(callsTo('energyHomeAssistant:test')).toEqual([
    { groupSlug: 'home', address: 'https://ha.example.org', token: 'fake-token' },
  ])
  expect(document.body.textContent).toContain('2026.11.2')
  expect(switchOf(0)?.checked).toBe(true)
  expect(switchOf(1)?.checked).toBe(false)
  expect(
    (byTestId('energy-connect-history') as HTMLInputElement).checked,
  ).toBe(true)
  view.unmount()
})

test('a channel whose sensor is gone can be switched off, not on again', async () => {
  const [grid, gas] = tested.proposals
  energyState.actions['energyHomeAssistant:test'] = {
    ...tested,
    proposals: [grid, { ...gas, available: false, existing: true, on: true }],
  }
  const view = mount(createElement(EnergyConnectScreen))
  await testConnection()
  expect(switchOf(1)?.disabled).toBe(false)
  switchOf(1)?.click()
  await settle()
  expect(switchOf(1)?.checked).toBe(false)
  expect(switchOf(1)?.disabled).toBe(true)
  view.unmount()
})

test('another sensor is picked from those that fit, and Connect sends what is on', async () => {
  const view = mount(createElement(EnergyConnectScreen))
  await testConnection()
  expect(byTestId('energy-connect-sensor-0-sensor.p1_gas')).toBeNull()
  byTestId('energy-connect-sensor-0-sensor.other')?.click()
  await settle()
  byTestId('energy-connect-submit')?.click()
  await settle()
  expect(callsTo('energyHomeAssistant:connect')).toEqual([
    {
      groupSlug: 'home',
      address: 'https://ha.example.org',
      token: 'fake-token',
      channels: [
        { kind: 'gridImport', tariff: 'low', statisticId: 'sensor.other' },
      ],
      history: true,
    },
  ])
  // Emptied before the screen closes, so iOS offers to save nothing.
  expect((byTestId('energy-connect-token') as HTMLInputElement).value).toBe('')
  await vi.waitFor(() =>
    expect(energyState.dismissed).toEqual(['/all/energy/sources']),
  )
  view.unmount()
})

test('changing the address asks for a new test', async () => {
  const view = mount(createElement(EnergyConnectScreen))
  await testConnection()
  typeInto(byTestId('energy-connect-address'), 'https://other.example.org')
  await settle()
  expect(byTestId('energy-connect-channels')).toBeNull()
  expect(byTestId('energy-connect-submit')).toBeNull()
  view.unmount()
})

test('a refused token is said in words', async () => {
  energyState.refuse = { kind: 'energy:sourceBadToken' }
  const view = mount(createElement(EnergyConnectScreen))
  await testConnection()
  expect(document.body.textContent).toContain(en.energy.refusals.sourceBadToken)
  expect(byTestId('energy-connect-channels')).toBeNull()
  view.unmount()
})

test('editing starts from the address, keeps the token and can disconnect', async () => {
  energyState.queries['energySources:list'] = connectedList
  const view = mount(createElement(EnergyConnectScreen))
  expect((byTestId('energy-connect-token') as HTMLInputElement).value).toBe('')
  byTestId('energy-connect-test')?.click()
  await settle()
  expect(callsTo('energyHomeAssistant:test')).toEqual([
    { groupSlug: 'home', address: 'https://ha.example.org' },
  ])
  expect(
    (byTestId('energy-connect-history') as HTMLInputElement).checked,
  ).toBe(false)
  byTestId('energy-connect-disconnect')?.click()
  expect(callsTo('energySources:disconnect')).toEqual([])
  energyState.confirms[0]?.onConfirm()
  await settle()
  expect(callsTo('energySources:disconnect')).toEqual([{ groupSlug: 'home' }])
  await vi.waitFor(() =>
    expect(energyState.dismissed).toEqual(['/all/energy/sources']),
  )
  view.unmount()
})

test('leaving Connect without saving clears the token field so iOS does not offer to save it', async () => {
  const view = mount(createElement(EnergyConnectScreen))
  typeInto(byTestId('energy-connect-address'), 'https://ha.example.org')
  typeInto(byTestId('energy-connect-token'), 'fake-token')
  await settle()
  expect((byTestId('energy-connect-token') as HTMLInputElement).value).toBe('fake-token')
  for (const listener of energyState.navListeners.beforeRemove ?? []) listener()
  await settle()
  expect((byTestId('energy-connect-token') as HTMLInputElement).value).toBe('')
  expect(energyState.fieldClears).toContain('energy-connect-token')
  view.unmount()
})

test('unmounting Connect without a navigation event still clears the native token field', async () => {
  const view = mount(createElement(EnergyConnectScreen))
  typeInto(byTestId('energy-connect-token'), 'fake-token')
  await settle()
  expect(energyState.fieldClears).toEqual([])
  view.unmount()
  expect(energyState.fieldClears).toContain('energy-connect-token')
})

test('blurring after testing a pasted token clears it and invalidates the test result', async () => {
  energyState.queries['energySources:list'] = connectedList
  const view = mount(createElement(EnergyConnectScreen))
  await testConnection()
  expect(byTestId('energy-connect-submit')).not.toBeNull()
  for (const listener of energyState.navListeners.blur ?? []) listener()
  await settle()
  expect((byTestId('energy-connect-token') as HTMLInputElement).value).toBe('')
  expect(byTestId('energy-connect-channels')).toBeNull()
  expect(byTestId('energy-connect-submit')).toBeNull()
  view.unmount()
})

test('blurring when using the stored token keeps the test result intact', async () => {
  energyState.queries['energySources:list'] = connectedList
  const view = mount(createElement(EnergyConnectScreen))
  byTestId('energy-connect-test')?.click()
  await settle()
  expect(byTestId('energy-connect-submit')).not.toBeNull()
  for (const listener of energyState.navListeners.blur ?? []) listener()
  await settle()
  expect(byTestId('energy-connect-submit')).not.toBeNull()
  view.unmount()
})

test('disconnecting clears a pasted token before leaving', async () => {
  energyState.queries['energySources:list'] = connectedList
  const view = mount(createElement(EnergyConnectScreen))
  typeInto(byTestId('energy-connect-token'), 'pasted-before-disconnect')
  await settle()
  byTestId('energy-connect-disconnect')?.click()
  energyState.confirms[0]?.onConfirm()
  await settle()
  expect((byTestId('energy-connect-token') as HTMLInputElement).value).toBe('')
  expect(energyState.fieldClears).toContain('energy-connect-token')
  await vi.waitFor(() =>
    expect(energyState.dismissed).toEqual(['/all/energy/sources']),
  )
  view.unmount()
})

test('a Member who is not an admin sees no form', () => {
  energyState.queries['energySources:list'] = { ...list, canManage: false }
  const view = mount(createElement(EnergyConnectScreen))
  expect(document.body.textContent).toContain(en.energy.connect.adminsOnly)
  expect(byTestId('energy-connect-address')).toBeNull()
  view.unmount()
})
