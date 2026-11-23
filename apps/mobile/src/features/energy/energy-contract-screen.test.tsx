// @vitest-environment jsdom
/**
 * The contract (APP-494, designs/energy section 6): euro amounts per month
 * and per year are typed in euro and sent in cents; a required amount left
 * blank is refused before anything is sent.
 */
import { createElement } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { en } from '../../i18n/messages/en'
import { mount, settle } from '../../testing/dom'
import { EnergyContractScreen } from './energy-contract-screen'
import {
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

beforeEach(() => {
  resetEnergyState()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-23T12:00:00Z'))
  energyState.queries['energyContracts:list'] = []
})
afterEach(() => {
  vi.useRealTimers()
})

test('a first dynamic contract is sent with its fixed costs in cents', async () => {
  const view = mount(createElement(EnergyContractScreen))
  typeInto(byTestId('energy-contract-supplier'), 'Frank Energie')
  typeInto(byTestId('energy-contract-importMarkup'), '0.02')
  typeInto(byTestId('energy-contract-exportFee'), '0.01')
  typeInto(byTestId('energy-contract-energyTax'), '0.1088')
  typeInto(byTestId('energy-contract-monthlyFixed'), '28.05')
  typeInto(byTestId('energy-contract-yearlyCredit'), '524.95')
  await settle()
  byTestId('energy-contract-save')?.click()
  await settle()
  expect(byTestId('energy-contract-problem')).toBeNull()
  const [sent] = callsTo('energyContracts:save') as {
    groupSlug: string
    contractId?: string
    terms: Record<string, unknown>
  }[]
  expect(sent?.groupSlug).toBe('home')
  expect(sent?.contractId).toBeUndefined()
  expect(sent?.terms).toMatchObject({
    kind: 'dynamic',
    validFrom: '2026-11-23',
    supplierName: 'Frank Energie',
    importMarkupEurPerKwh: 0.02,
    exportFeeEurPerKwh: 0.01,
    energyTaxEurPerKwh: 0.1088,
    vatPercent: 21,
    monthlyFixedCents: 2805,
    yearlyTaxCreditCents: 52495,
    netMetering: true,
  })
  expect(energyState.backs).toBe(1)
  view.unmount()
})

test('a required amount left blank is refused without saving', async () => {
  const view = mount(createElement(EnergyContractScreen))
  byTestId('energy-contract-save')?.click()
  await settle()
  expect(byTestId('energy-contract-problem')?.textContent).toBe(
    en.energy.contract.invalid,
  )
  expect(callsTo('energyContracts:save')).toEqual([])
  view.unmount()
})
