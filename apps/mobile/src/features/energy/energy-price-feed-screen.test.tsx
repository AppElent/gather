// @vitest-environment jsdom
/** The price source (APP-493): the key is only ever sent, never shown. */
import { createElement } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { en } from '../../i18n/messages/en'
import { mount, settle } from '../../testing/dom'
import { EnergyPriceFeedScreen } from './energy-price-feed-screen'
import { byTestId, callsTo, energyState, priceView, resetEnergyState, typeInto } from './energy-test-mocks'

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

const keyField = () => byTestId('energy-feed-key') as HTMLInputElement | null
const save = () => byTestId('energy-feed-save') as HTMLButtonElement | null

test('EnergyZero is the default and needs no key', () => {
  const view = mount(createElement(EnergyPriceFeedScreen))
  expect(byTestId('energy-feed-energyzero')?.getAttribute('aria-selected')).toBe('true')
  expect(keyField()).toBeNull()
  expect(save()?.disabled).toBe(true)
  view.unmount()
})

test('a typed key is sent once and the field is empty after', async () => {
  const view = mount(createElement(EnergyPriceFeedScreen))
  byTestId('energy-feed-tibber')?.click()
  await settle()
  expect(keyField()?.type).toBe('password')
  expect(save()?.disabled).toBe(true)
  typeInto(keyField(), 'my-key')
  await settle()
  save()?.click()
  await settle()
  expect(callsTo('energyPrices:saveFeed')).toEqual([
    { groupSlug: 'home', provider: 'tibber', key: 'my-key' },
  ])
  expect(keyField()?.value).toBe('')
  view.unmount()
})

test('a refusal empties the field too and reads in words', async () => {
  energyState.refuse = { kind: 'energy:priceKeyInvalid' }
  const view = mount(createElement(EnergyPriceFeedScreen))
  byTestId('energy-feed-entsoe')?.click()
  await settle()
  typeInto(keyField(), 'a b')
  await settle()
  save()?.click()
  await settle()
  expect(document.body.textContent).toContain(en.energy.refusals.priceKeyInvalid)
  expect(keyField()?.value).toBe('')
  view.unmount()
})

test('a saved key is never shown, and a refused one says so', () => {
  energyState.queries['energyPrices:view'] = priceView({
    provider: 'tibber',
    hasKey: true,
    status: 'needsKey',
    lastError: 'keyRejected',
  })
  const view = mount(createElement(EnergyPriceFeedScreen))
  expect(keyField()?.value).toBe('')
  expect(keyField()?.placeholder).toBe(en.energy.feed.keyStored)
  expect(byTestId('energy-feed-state')?.textContent).toContain('Tibber refuses the key.')
  view.unmount()
})

test('a Member who is not an admin reads, and changes nothing', () => {
  energyState.queries['energyPrices:view'] = priceView({
    provider: 'entsoe',
    hasKey: true,
    canManage: false,
  })
  const view = mount(createElement(EnergyPriceFeedScreen))
  expect(save()).toBeNull()
  expect(keyField()).toBeNull()
  expect((byTestId('energy-feed-tibber') as HTMLButtonElement).disabled).toBe(true)
  expect(document.body.textContent).toContain(en.energy.feed.adminsOnly)
  view.unmount()
})
