// @vitest-environment jsdom
/**
 * The Account screen's way to the AppElent account portal: the row is there in
 * both languages, opens the portal in the in-app browser, and a browser that
 * cannot open says so (APP-668).
 */
import { act, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import Account from '../../app/(app)/(tabs)/settings/account/index'
import { mount, settle } from '../testing/dom'

type Props = Record<string, unknown> & { children?: ReactNode }

const state = vi.hoisted(() => ({
  locale: 'en' as 'en' | 'nl',
  openBrowser: vi.fn(),
  alert: vi.fn(),
  push: vi.fn(),
}))

vi.mock('react-native', async () => {
  const React = await import('react')
  const h = React.createElement
  const box = ({ children }: Props) => h('div', null, children)
  return {
    View: box,
    Text: box,
    ScrollView: box,
    ActivityIndicator: () => null,
    Pressable: ({ children, ...props }: Props) =>
      h(
        'button',
        {
          'data-testid': props.testID as string,
          'aria-label': props.accessibilityLabel as string,
          role: props.accessibilityRole as string,
          onClick: props.onPress as () => void,
        },
        children,
      ),
    StyleSheet: { create: <T,>(styles: T) => styles },
  }
})
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0 }),
}))
vi.mock('expo-image', () => ({ Image: () => null }))
vi.mock('expo-router', () => ({ router: { push: state.push } }))
vi.mock('@clerk/expo', () => ({
  useUser: () => ({
    isLoaded: true,
    user: {
      fullName: 'Test User',
      primaryEmailAddress: { emailAddress: 'a@b.com' },
    },
  }),
}))
vi.mock('../auth/config', () => ({ isTestAccount: () => false }))
vi.mock('../auth/useSignOut', () => ({ useSignOut: () => () => {} }))
vi.mock('../availability/AvailabilityProvider', () => ({
  useAvailability: () => ({ serviceActionsEnabled: true }),
}))
vi.mock('../i18n', async () => {
  const { en } = await import('../i18n/messages/en')
  const { nl } = await import('../i18n/messages/nl')
  return { useI18n: () => ({ t: { en, nl }[state.locale] }) }
})
vi.mock('./profilePhoto', () => ({ setProfilePhoto: () => {} }))
vi.mock('../observability/native-presentation', () => ({
  openBrowserAsync: state.openBrowser,
  showAlert: state.alert,
}))
vi.mock('../theme/tokens', () => {
  const any = new Proxy({}, { get: () => ({}) })
  return { RADIUS: any, TYPE: any, useTokens: () => ({}) }
})
vi.mock('../theme/icons', () => ({
  UI_ICONS: new Proxy({}, { get: () => () => null }),
}))
vi.mock('../ui/button', () => ({ Button: () => null }))

let view: ReturnType<typeof mount> | undefined
afterEach(() => view?.unmount())
beforeEach(() => {
  state.openBrowser.mockReset().mockResolvedValue({ type: 'opened' })
  state.alert.mockReset()
  state.push.mockReset()
})

function portalRow() {
  view = mount(<Account />)
  const row = view.container.querySelector<HTMLElement>(
    '[data-testid="account-row-portal"]',
  )
  if (!row) throw new Error('no portal row')
  return row
}

describe.each([
  [
    'en',
    'Manage your AppElent account',
    'Your AppElent account could not be opened. Try again.',
  ],
  [
    'nl',
    'Beheer je AppElent-account',
    'Je AppElent-account kon niet worden geopend. Probeer het opnieuw.',
  ],
] as const)('the account portal row (%s)', (locale, label, failed) => {
  beforeEach(() => {
    state.locale = locale
  })

  test('opens the portal in the in-app browser', async () => {
    const row = portalRow()
    expect(row.getAttribute('aria-label')).toBe(label)
    expect(row.textContent).toBe(label)
    expect(row.getAttribute('role')).toBe('link')

    act(() => row.click())
    await settle()
    expect(state.openBrowser.mock.calls).toEqual([
      ['https://account.appelent.nl'],
    ])
    expect(state.alert).not.toHaveBeenCalled()
    expect(state.push).not.toHaveBeenCalled()
  })

  test('says so when the browser cannot open, and opens on a retry', async () => {
    state.openBrowser.mockRejectedValueOnce(new Error('No matching browser'))
    const row = portalRow()

    act(() => row.click())
    await settle()
    expect(state.alert.mock.calls).toEqual([[failed]])

    act(() => row.click())
    await settle()
    expect(state.openBrowser).toHaveBeenCalledTimes(2)
    expect(state.alert).toHaveBeenCalledTimes(1)
  })
})

test('a second tap while the browser opens is ignored', async () => {
  let close = () => {}
  state.openBrowser.mockReturnValue(
    new Promise<void>((resolve) => {
      close = resolve
    }),
  )
  const row = portalRow()
  act(() => row.click())
  act(() => row.click())
  expect(state.openBrowser).toHaveBeenCalledTimes(1)
  close()
  await settle()
})

test('the other rows still open their screens', () => {
  portalRow()
  const email = view?.container.querySelector<HTMLElement>(
    '[data-testid="account-row-email"]',
  )
  act(() => email?.click())
  expect(state.push).toHaveBeenCalledWith('/settings/account/email')
})
