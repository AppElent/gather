// @vitest-environment jsdom
/**
 * Opening a wishlist item's link (APP-854): a link the phone cannot open is
 * said, not left as an unhandled rejection. React Native, the store and the
 * theme are replaced; the component is real.
 */
import { act, createElement, type ReactNode } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'

import { mount, settle } from '../../testing/dom'
import type { Task } from './types'
import { WishlistFields } from './WishlistFields'

const mocks = vi.hoisted(() => ({ openURL: vi.fn(), showAlert: vi.fn() }))

vi.mock('react-native', async () => {
  const React = await import('react')
  type Props = { children?: ReactNode; testID?: string; onPress?: () => void }
  const dom =
    (tag: string) =>
    ({ children, testID, onPress }: Props) =>
      React.createElement(tag, { 'data-testid': testID, onClick: onPress }, children)
  return {
    Linking: { openURL: mocks.openURL },
    Pressable: dom('button'),
    StyleSheet: { create: <T,>(styles: T) => styles },
    Text: dom('span'),
    TextInput: () => null,
    View: dom('div'),
  }
})
vi.mock('../../observability/native-presentation', () => ({
  showAlert: mocks.showAlert,
}))
vi.mock('../../feedback/haptics', () => ({
  haptics: new Proxy({}, { get: () => () => {} }),
}))
vi.mock('../../i18n', async () => {
  const { en } = await import('../../i18n/messages/en')
  return { useI18n: () => ({ t: en, locale: 'en' }) }
})
vi.mock('../../theme/icons', () => ({
  UI_ICONS: new Proxy({}, { get: () => () => null }),
}))
vi.mock('./icons', () => ({
  TASK_ICONS: new Proxy({}, { get: () => () => null }),
}))
vi.mock('../../theme/tokens', () => ({
  TYPE: new Proxy({}, { get: () => ({}) }),
  useTokens: () => ({}),
}))
vi.mock('../../ui/card', () => ({
  Card: ({ children }: { children: ReactNode }) => children,
}))
vi.mock('./store', () => ({ useTaskActions: () => ({}) }))

const lamp = {
  id: 'lamp',
  title: 'Lamp',
  done: false,
  url: 'https://example.com/lamp',
} as Task

beforeEach(() => {
  mocks.openURL.mockReset()
  mocks.showAlert.mockReset()
})

async function pressOpen() {
  const view = mount(createElement(WishlistFields, { task: lamp, writable: true }))
  const open = view.container.querySelector<HTMLElement>(
    '[data-testid="detail-open-link"]',
  )!
  await act(async () => open.click())
  await settle()
}

test('a link that opens says nothing', async () => {
  mocks.openURL.mockResolvedValue(true)
  await pressOpen()
  expect(mocks.openURL).toHaveBeenCalledWith('https://example.com/lamp')
  expect(mocks.showAlert).not.toHaveBeenCalled()
})

test('a link the phone cannot open is said', async () => {
  mocks.openURL.mockRejectedValue(new Error('Unable to open URL'))
  await pressOpen()
  expect(mocks.showAlert).toHaveBeenCalledWith(
    'This page could not be opened. Try again.',
  )
})
