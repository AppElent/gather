// @vitest-environment jsdom
/** A tapped notification opens once nothing is in front of its screen (APP-774). */
import { expect, test, vi } from 'vitest'

import { openSheet } from '../../../components/openSheets'
import { mount, settle } from '../../../testing/dom'
import { PushTapLinks } from './push-tap-links'

const state = vi.hoisted(() => ({
  navigate: vi.fn(),
  remember: vi.fn(),
  tap: (_: unknown) => {},
}))

vi.mock('expo-router', () => ({ router: { navigate: state.navigate } }))
vi.mock('expo-notifications', () => ({
  DEFAULT_ACTION_IDENTIFIER: 'default',
  getLastNotificationResponse: () => null,
  addNotificationResponseReceivedListener: (listener: (_: unknown) => void) => {
    state.tap = listener
    return { remove: () => {} }
  },
}))
vi.mock('../../../shell/pendingGroupLink', () => ({
  rememberGroupLink: state.remember,
}))
vi.mock('@gather/core/notifications', () => ({
  notificationLink: () => 'the link',
}))

test('a tap closes an open sheet first, then opens its record', async () => {
  const asked = vi.fn()
  const sheet = openSheet(asked)
  mount(<PushTapLinks />)
  state.tap({
    actionIdentifier: 'default',
    notification: { date: 1, request: { identifier: 'n1', content: { data: {} } } },
  })
  await settle()
  expect(asked).toHaveBeenCalledOnce()
  expect(state.remember).not.toHaveBeenCalled()
  expect(state.navigate).not.toHaveBeenCalled()

  sheet.closed()
  await settle()
  await settle()
  expect(state.remember).toHaveBeenCalledExactlyOnceWith('the link')
  expect(state.navigate).toHaveBeenCalledExactlyOnceWith('/open-notification')
})
