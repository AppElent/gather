// @vitest-environment jsdom
/**
 * Settings in-app browser rows (Privacy, Data sources) report open failures
 * instead of swallowing them, and the Email screen points to
 * account.appelent.nl via the AppElent account row (APP-846).
 */
import { act, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import Emails from '../../app/(app)/(tabs)/settings/account/email'
import Settings from '../../app/(app)/(tabs)/settings/index'
import { mount, settle } from '../testing/dom'
import { ABOUT_PAGE_URL, PRIVACY_STATEMENT_URL } from './sections'

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
    StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  }
})
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0 }),
}))
vi.mock('expo-constants', () => ({
  default: {
    expoConfig: { version: '1.0.0' },
    platform: { ios: { buildNumber: '1' } },
  },
}))
vi.mock('expo-router', () => ({
  router: { push: state.push },
  Stack: { Screen: () => null },
}))
vi.mock('expo-updates', () => ({
  updateId: null,
  isEmbeddedLaunch: true,
  createdAt: null,
  channel: '',
}))
vi.mock('@clerk/expo', () => ({
  useUser: () => ({
    isLoaded: true,
    user: {
      fullName: 'Test User',
      primaryEmailAddressId: 'e1',
      primaryEmailAddress: { emailAddress: 'a@b.com' },
      emailAddresses: [
        {
          id: 'e1',
          emailAddress: 'a@b.com',
          verification: { status: 'verified' },
        },
      ],
    },
  }),
}))
vi.mock('../components/SearchField', () => ({ SearchField: () => null }))
vi.mock('../components/SettingsCard', async () => {
  const React = await import('react')
  return {
    SettingsCard: ({ children }: Props) =>
      React.createElement('div', null, children),
  }
})
vi.mock('../group/GroupProvider', () => ({
  useGroup: () => ({ group: { name: 'Home' } }),
}))
vi.mock('../i18n', async () => {
  const { fmt } = await import('@gather/core/i18n')
  const { en } = await import('../i18n/messages/en')
  const { nl } = await import('../i18n/messages/nl')
  return {
    fmt,
    useI18n: () => ({ t: { en, nl }[state.locale], locale: state.locale }),
  }
})
vi.mock('../modules/buildModules', () => ({ moduleShown: () => true }))
vi.mock('../observability/init', () => ({ openProblemReport: () => true }))
vi.mock('../observability/native-presentation', () => ({
  openBrowserAsync: state.openBrowser,
  showAlert: state.alert,
}))
vi.mock('../observability/options', () => ({
  environmentFromChannel: () => 'dev',
}))
vi.mock('../theme/appearance', () => ({
  useAppearance: () => ({ preference: 'system' }),
}))
vi.mock('../theme/icons', () => ({
  UI_ICONS: new Proxy({}, { get: () => () => null }),
}))
vi.mock('../theme/tokens', () => {
  const any = new Proxy({}, { get: () => ({}) })
  return { RADIUS: any, TYPE: any, useTokens: () => ({}) }
})
vi.mock('../ui/screen-header', () => ({
  washScreenOptions: () => ({}),
}))

let view: ReturnType<typeof mount> | undefined
afterEach(() => {
  view?.unmount()
  vi.unstubAllGlobals()
})
beforeEach(() => {
  vi.stubGlobal('__DEV__', false)
  state.openBrowser.mockReset().mockResolvedValue({ type: 'opened' })
  state.alert.mockReset()
  state.push.mockReset()
})

function findRow(label: string) {
  view = mount(<Settings />)
  const row = Array.from(
    view.container.querySelectorAll<HTMLElement>('button[role="link"]'),
  ).find((button) => button.getAttribute('aria-label') === label)
  if (!row) throw new Error(`no row labelled ${label}`)
  return row
}

describe.each([
  [
    'en',
    'Privacy statement',
    'Data sources',
    'This page could not be opened. Try again.',
  ],
  [
    'nl',
    'Privacyverklaring',
    'Gegevensbronnen',
    'Deze pagina kon niet worden geopend. Probeer het opnieuw.',
  ],
] as const)(
  'Settings browser rows (%s)',
  (locale, privacyLabel, dataSourcesLabel, failedMessage) => {
    beforeEach(() => {
      state.locale = locale
    })

    test.each([
      ['Privacy', privacyLabel, PRIVACY_STATEMENT_URL],
      ['Data sources', dataSourcesLabel, ABOUT_PAGE_URL],
    ])(
      '%s shows an alert when the browser cannot open, and opens on retry',
      async (_name, label, url) => {
        state.openBrowser.mockRejectedValueOnce(new Error('No browser'))
        const row = findRow(label)

        act(() => row.click())
        await settle()
        expect(state.openBrowser).toHaveBeenCalledWith(url)
        expect(state.alert.mock.calls).toEqual([[failedMessage]])

        act(() => row.click())
        await settle()
        expect(state.openBrowser).toHaveBeenCalledTimes(2)
        expect(state.alert).toHaveBeenCalledTimes(1)
      },
    )
  },
)

describe.each([
  ['en', 'Manage your AppElent account', 'Gather on the web'],
  ['nl', 'Beheer je AppElent-account', 'Gather op het web'],
] as const)('Email screen copy (%s)', (locale, rowLabel, wrongCopy) => {
  beforeEach(() => {
    state.locale = locale
  })

  test('points to account.appelent.nl and the AppElent account row', () => {
    view = mount(<Emails />)
    const text = view.container.textContent ?? ''
    expect(text).toContain('account.appelent.nl')
    expect(text).toContain(rowLabel)
    expect(text).not.toContain(wrongCopy)
  })
})
