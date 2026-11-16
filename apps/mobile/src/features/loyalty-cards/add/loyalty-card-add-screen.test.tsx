// @vitest-environment jsdom
/**
 * The add flow end to end, with the camera replaced by a scan result
 * (APP-142's runtime proof for scanning, which a simulator cannot do): the
 * scan prefills the number and type, the number's pattern suggests its store,
 * and saving creates the card from both and opens it.
 */
import { createElement, type ReactNode } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'

import { mount, settle } from '../../../testing/dom'
import { LoyaltyCardAddScreen } from './loyalty-card-add-screen'

const state = vi.hoisted(() => ({
  scan: null as null | ((result: { type: string; data: string }) => void),
  permission: { granted: true, canAskAgain: true } as {
    granted: boolean
    canAskAgain: boolean
  } | null,
  created: [] as unknown[],
  replaced: [] as unknown[],
  focused: true,
  permissionReads: 0,
  appState: null as null | ((state: string) => void),
}))

vi.mock('react-native', async () => {
  const React = await import('react')
  const h = React.createElement
  type Props = Record<string, unknown> & { children?: ReactNode }
  const dom =
    (tag: string) =>
    ({ children, testID, accessibilityLabel }: Props) =>
      h(
        tag,
        {
          'data-testid': testID as string | undefined,
          'aria-label': accessibilityLabel as string | undefined,
        },
        children,
      )
  const Pressable = ({
    children,
    testID,
    accessibilityLabel,
    onPress,
    disabled,
  }: Props) =>
    h(
      'button',
      {
        'data-testid': testID as string | undefined,
        'aria-label': accessibilityLabel as string | undefined,
        disabled: Boolean(disabled),
        onClick: () => (onPress as (() => void) | undefined)?.(),
      },
      children,
    )
  const TextInput = React.forwardRef(function TextInput(
    { testID, value, onChangeText }: Props,
    _ref,
  ) {
    return h('input', {
      'data-testid': testID as string | undefined,
      value: value as string,
      onChange: (event: { target: { value: string } }) =>
        (onChangeText as (next: string) => void)?.(event.target.value),
    })
  })
  const FlatList = ({
    data,
    renderItem,
    ListHeaderComponent,
  }: {
    data: unknown[]
    renderItem: (row: { item: unknown }) => ReactNode
    ListHeaderComponent: ReactNode
  }) =>
    h(
      'div',
      null,
      ListHeaderComponent,
      data.map((item, index) => h('div', { key: index }, renderItem({ item }))),
    )
  return {
    View: dom('div'),
    Text: dom('span'),
    ScrollView: dom('div'),
    ActivityIndicator: () => null,
    Pressable,
    TextInput,
    FlatList,
    StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
    Linking: { openSettings: async () => {} },
    AppState: {
      addEventListener: (_: string, listener: (next: string) => void) => {
        state.appState = listener
        return { remove: () => (state.appState = null) }
      },
    },
    AccessibilityInfo: { announceForAccessibility: () => {} },
    Platform: { OS: 'ios', select: (choices: { ios: unknown }) => choices.ios },
  }
})
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))
vi.mock('expo-camera', () => ({
  useCameraPermissions: () => [
    state.permission,
    async () => state.permission,
    async () => {
      state.permissionReads += 1
      return state.permission
    },
  ],
  CameraView: ({
    onBarcodeScanned,
  }: {
    onBarcodeScanned: (result: { type: string; data: string }) => void
  }) => {
    state.scan = onBarcodeScanned
    return createElement('div', { 'data-testid': 'camera' })
  },
}))
vi.mock('expo-router', () => {
  const Stack = () => null
  Stack.Screen = () => null
  return {
    Stack,
    useIsFocused: () => state.focused,
    useRouter: () => ({
      replace: (href: unknown) => state.replaced.push(href),
      push: () => {},
      back: () => {},
    }),
  }
})
vi.mock('convex/react', () => ({
  useMutation: (name: string) => async (args: unknown) => {
    if (name === 'loyaltyCards:create') {
      state.created.push(args)
      return 'card-1'
    }
    return 'https://upload'
  },
}))
vi.mock('../../../convex/api', () => ({
  api: {
    loyaltyCards: {
      create: 'loyaltyCards:create',
      searchCatalog: 'loyaltyCards:searchCatalog',
      generateUploadUrl: 'loyaltyCards:generateUploadUrl',
    },
  },
}))
vi.mock('../../../convex/queries', () => ({
  useQuery: () => [
    {
      seedKey: 'albert-heijn',
      name: 'Albert Heijn',
      aliases: ['AH'],
      category: 'supermarket',
      brandColor: '#00a0e2',
      domain: 'ah.nl',
      barcodeFormat: 'EAN_13',
      formatConfidence: 'sourced',
      numberLength: 13,
      numberPrefix: '262',
    },
    {
      seedKey: 'kruidvat',
      name: 'Kruidvat',
      aliases: [],
      category: 'drugstore',
      brandColor: '#e30613',
      domain: 'kruidvat.nl',
      barcodeFormat: 'EAN_13',
      formatConfidence: 'guess',
    },
  ],
}))
vi.mock('../../../group/GroupProvider', () => ({
  useGroup: () => ({ group: { slug: 'home', name: 'Home' } }),
}))
vi.mock('../../../i18n', async () => {
  const { en } = await import('../../../i18n/messages/en')
  const { fmt } = await import('@gather/core/i18n')
  return { fmt, useI18n: () => ({ t: en, locale: 'en' }) }
})
vi.mock('../../../theme/appearance', () => ({
  useAppearance: () => ({ scheme: 'light' }),
}))
vi.mock('../../../theme/icons', () => ({
  UI_ICONS: new Proxy({}, { get: () => () => null }),
}))
vi.mock('../loyalty-card-icons', () => ({
  LOYALTY_CARD_ICONS: new Proxy({}, { get: () => () => null }),
}))
vi.mock('../../../feedback/haptics', () => ({
  haptics: new Proxy({}, { get: () => () => {} }),
}))
vi.mock('../../../components/PhotoField', () => ({ PhotoField: () => null }))
vi.mock('../../../components/LoadingSkeleton', () => ({
  LoadingSkeleton: () => null,
}))
vi.mock('../../../components/SearchField', () => ({ SearchField: () => null }))
vi.mock('../components/card-barcode', () => ({
  CardBarcode: ({ value }: { value: string }) =>
    createElement('div', { 'data-testid': 'preview' }, value),
}))
// The generated logo list `require`s images only Metro can load.
vi.mock('../components/retailer-logo-files', () => ({
  RETAILER_LOGO_FILES: {},
}))
vi.mock('expo-image', () => ({ Image: () => null }))
vi.mock('@expo/ui/community/menu', () => ({
  MenuView: ({ children }: { children: ReactNode }) => children,
}))

const byTestId = (container: HTMLElement, id: string) =>
  container.querySelector<HTMLElement>(`[data-testid="${id}"]`)

beforeEach(() => {
  state.scan = null
  state.permission = { granted: true, canAskAgain: true }
  state.created = []
  state.replaced = []
  state.focused = true
  state.permissionReads = 0
  state.appState = null
})

test('a scanned card suggests its store and saves with the scanned number', async () => {
  const view = mount(<LoyaltyCardAddScreen />)
  expect(byTestId(view.container, 'camera')).not.toBeNull()

  // The camera reports the same code many times a second; only one counts.
  await settle()
  state.scan?.({ type: 'ean13', data: '2620000000008' })
  state.scan?.({ type: 'ean13', data: '2620000000008' })
  await settle()

  expect(byTestId(view.container, 'loyalty-card-scanned')?.textContent).toBe(
    'Scanned EAN-13: 2620000000008',
  )
  const suggestion = byTestId(view.container, 'loyalty-card-suggestion')
  expect(suggestion?.getAttribute('aria-label')).toBe('Use Albert Heijn')

  suggestion?.click()
  await settle()
  expect(
    (byTestId(view.container, 'loyalty-card-number-input') as HTMLInputElement)
      .value,
  ).toBe('2620000000008')
  expect(byTestId(view.container, 'preview')?.textContent).toBe(
    '2620000000008',
  )

  byTestId(view.container, 'loyalty-card-save')?.click()
  await settle()
  expect(state.created).toEqual([
    {
      groupSlug: 'home',
      catalogKey: 'albert-heijn',
      storeName: 'Albert Heijn',
      cardNumber: '2620000000008',
      barcodeFormat: 'EAN_13',
      holder: undefined,
      note: undefined,
      frontPhotoId: undefined,
      backPhotoId: undefined,
    },
  ])
  expect(state.replaced).toEqual([
    {
      pathname: '/all/loyalty-cards/card',
      params: { cardId: 'card-1', justAdded: '1' },
    },
  ])
  view.unmount()
})

test('a scan that fits no store pattern offers no suggestion', async () => {
  const view = mount(<LoyaltyCardAddScreen />)
  await settle()
  state.scan?.({ type: 'code128', data: 'ABC-123' })
  await settle()
  expect(byTestId(view.container, 'loyalty-card-scanned')?.textContent).toBe(
    'Scanned Code 128: ABC-123',
  )
  expect(byTestId(view.container, 'loyalty-card-suggestion')).toBeNull()
  view.unmount()
})

test('a refused camera says how to turn it on, and typing still works', async () => {
  state.permission = { granted: false, canAskAgain: false }
  const view = mount(<LoyaltyCardAddScreen />)
  expect(byTestId(view.container, 'camera')).toBeNull()
  expect(byTestId(view.container, 'loyalty-card-open-settings')).not.toBeNull()

  byTestId(view.container, 'loyalty-card-type-instead')?.click()
  await settle()
  byTestId(view.container, 'loyalty-card-other-store')?.click()
  await settle()
  expect(byTestId(view.container, 'loyalty-card-store-name')).not.toBeNull()

  // Nothing typed yet: Save names what is missing instead of sending it.
  byTestId(view.container, 'loyalty-card-save')?.click()
  await settle()
  expect(state.created).toEqual([])
  expect(
    byTestId(view.container, 'loyalty-card-number-problem')?.textContent,
  ).toBe('Enter the card number.')
  view.unmount()
})

test('the camera is off while the scan step is not on screen', () => {
  state.focused = false
  const view = mount(<LoyaltyCardAddScreen />)
  expect(byTestId(view.container, 'camera')).toBeNull()
  expect(byTestId(view.container, 'loyalty-card-type-instead')).not.toBeNull()
  view.unmount()
})

test('coming back from Settings with the camera allowed opens the camera', async () => {
  state.permission = { granted: false, canAskAgain: false }
  const view = mount(<LoyaltyCardAddScreen />)
  expect(byTestId(view.container, 'camera')).toBeNull()
  expect(state.permissionReads).toBe(0)

  // Allowed in Settings, then back in the app.
  state.permission = { granted: true, canAskAgain: true }
  state.appState?.('background')
  state.appState?.('active')
  await settle()
  expect(state.permissionReads).toBe(1)
  view.rerender(<LoyaltyCardAddScreen />)
  expect(byTestId(view.container, 'camera')).not.toBeNull()
  view.unmount()
})
