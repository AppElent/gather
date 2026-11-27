// @vitest-environment jsdom
/**
 * The four credential screens submit what their fields show, not what React
 * state last heard (APP-263). iOS AutoFill can fill a focused field without
 * `onChangeText`; the field reports its text only in `onEndEditing`. So a
 * press while a field has focus must blur it and wait for that text, and the
 * button must stay enabled while a field has focus.
 */
import type { ReactNode } from 'react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import ChangePassword from '../../app/(app)/(tabs)/settings/account/password'
import ResetPassword from '../../app/(auth)/reset/password'
import SignUp from '../../app/(auth)/sign-up'
import { SignInScreen } from '../features/auth/sign-in/sign-in-screen'
import { mount, settle } from '../testing/dom'

type Props = Record<string, unknown> & { children?: ReactNode }
type Handler = (event?: unknown) => void

const state = vi.hoisted(() => ({
  inputs: new Map<string, Record<string, unknown>>(),
  focused: null as null | { blur: () => void },
  signIn: vi.fn(),
  submitPassword: vi.fn(async (_: unknown) => ({})),
  createAccount: vi.fn(async (_: unknown) => ({})),
  updatePassword: vi.fn(async (_: unknown) => {}),
}))

vi.mock('react-native', async () => {
  const React = await import('react')
  const h = React.createElement
  const box = ({ children }: Props) => h('div', null, children)
  const TextInput = Object.assign(
    React.forwardRef(function TextInput(props: Props, _ref) {
      state.inputs.set(props.accessibilityLabel as string, props)
      return h('input', { 'aria-label': props.accessibilityLabel as string })
    }),
    { State: { currentlyFocusedInput: () => state.focused } },
  )
  const Pressable = ({ children, testID, onPress, disabled }: Props) =>
    h(
      'button',
      {
        'data-testid': testID as string | undefined,
        disabled: Boolean(disabled),
        onClick: () => (onPress as Handler | undefined)?.(),
      },
      children,
    )
  return {
    View: box,
    Text: box,
    ScrollView: box,
    KeyboardAvoidingView: box,
    ActivityIndicator: () => null,
    Pressable,
    TextInput,
    StyleSheet: { create: <T,>(styles: T) => styles },
    Platform: { OS: 'ios' },
  }
})
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))
vi.mock('@clerk/expo', () => ({
  useSignIn: () => ({
    signIn: {
      resetPasswordEmailCode: { submitPassword: state.submitPassword },
      finalize: async () => ({}),
    },
    errors: { fields: {}, global: null },
  }),
  useSignUp: () => ({
    signUp: {
      password: state.createAccount,
      verifications: { sendEmailCode: async () => ({}) },
    },
    errors: { fields: {}, global: null },
  }),
  useUser: () => ({
    user: {
      passwordEnabled: true,
      primaryEmailAddress: { emailAddress: 'a@b.com' },
      updatePassword: state.updatePassword,
      getSessions: async () => [],
    },
  }),
}))
// Change password forgets the phones of the sessions it ended (APP-298).
vi.mock('convex/react', () => ({ useMutation: () => async () => null }))
vi.mock('expo-router', () => ({
  router: { back: () => {} },
  useRouter: () => ({ push: () => {}, replace: () => {} }),
  useLocalSearchParams: () => ({ email: 'a@b.com' }),
}))
vi.mock('../i18n', async () => {
  const { en } = await import('../i18n/messages/en')
  return { useI18n: () => ({ t: en, locale: 'en' }) }
})
vi.mock('../theme/tokens', () => {
  const any = new Proxy({}, { get: () => ({}) })
  return { RADIUS: any, TYPE: any, useTokens: () => ({}) }
})
vi.mock('../ui/keyboard-done-bar', () => ({
  useKeyboardDoneBar: () => ({ accessory: null }),
}))
vi.mock('../theme/icons', () => ({
  UI_ICONS: new Proxy({}, { get: () => () => null }),
}))
vi.mock('../components/AuthScreen', () => ({
  AuthScreen: ({ children }: Props) => children,
}))
vi.mock('../components/SettingsCard', () => ({
  SettingsCard: ({ children }: Props) => children,
}))
vi.mock('../components/AuthError', () => ({ AuthError: () => null }))
vi.mock('../components/AuthLink', () => ({ AuthLink: () => null }))
vi.mock('../components/SocialButtons', () => ({ SocialButtons: () => null }))
vi.mock('../feedback/haptics', () => ({ haptics: {} }))
vi.mock('./usePasswordSignIn', () => ({
  usePasswordSignIn: () => ({ submit: state.signIn, busy: false, error: null }),
}))
vi.mock('../features/auth/use-email-code-sign-in', () => ({
  useEmailCodeSignIn: () => ({ send: vi.fn(), busy: false, error: null }),
}))

let view: ReturnType<typeof mount> | undefined

beforeEach(() => {
  state.inputs.clear()
  state.focused = null
  vi.clearAllMocks()
})
afterEach(() => {
  view?.unmount()
  view = undefined
})

const text = (value: string) => ({ nativeEvent: { text: value } })
function fire(label: string, prop: string, event?: unknown) {
  const props = state.inputs.get(label)
  if (!props) throw new Error(`no field labelled ${label}`)
  act(() => (props[prop] as Handler)(event))
}
const type = (label: string, value: string) =>
  fire(label, 'onChangeText', value)
/** What AutoFill does: the native text changes and only end-editing says so. */
const endEditing = (label: string, value: string) =>
  fire(label, 'onEndEditing', text(value))
const button = (testID: string) =>
  view?.container.querySelector<HTMLButtonElement>(`[data-testid="${testID}"]`)

/** Focus `label`, then press the button while it still has focus. */
async function pressWhileFocused(label: string, testID: string) {
  const blur = vi.fn()
  fire(label, 'onFocus')
  state.focused = { blur }
  act(() => button(testID)?.click())
  await settle()
  expect(blur).toHaveBeenCalled()
  state.focused = null
}

const SCREENS = [
  {
    name: 'sign-in',
    render: () => <SignInScreen />,
    button: 'sign-in-submit',
    fill: () => type('Email', 'a@b.com'),
    field: 'Password',
    sent: () => state.signIn.mock.calls.map((call) => call[1]),
  },
  {
    name: 'sign-up',
    render: () => <SignUp />,
    button: 'sign-up-submit',
    fill: () => type('Email', 'a@b.com'),
    field: 'Password',
    sent: () =>
      state.createAccount.mock.calls.map(
        (call) => (call[0] as { password: string }).password,
      ),
  },
  {
    name: 'reset password',
    render: () => <ResetPassword />,
    button: 'reset-password-submit',
    fill: () => {},
    field: 'New password',
    sent: () =>
      state.submitPassword.mock.calls.map(
        (call) => (call[0] as { password: string }).password,
      ),
  },
  {
    name: 'change password',
    render: () => <ChangePassword />,
    button: 'account-password-submit',
    fill: () => type('Current password', 'old-pw'),
    field: 'New password',
    sent: () =>
      state.updatePassword.mock.calls.map(
        (call) => (call[0] as { newPassword: string }).newPassword,
      ),
  },
]

describe.each(SCREENS)('$name', (screen) => {
  beforeEach(() => {
    view = mount(screen.render())
    screen.fill()
  })

  test('a press before end-editing submits the final native text', async () => {
    type(screen.field, 'typed-pw')
    await pressWhileFocused(screen.field, screen.button)
    expect(screen.sent()).toEqual([])
    endEditing(screen.field, 'Strong-pw-1')
    await settle()
    expect(screen.sent()).toEqual(['Strong-pw-1'])
  })

  test('the button stays enabled while a field AutoFill may fill has focus', () => {
    expect(button(screen.button)?.disabled).toBe(true)
    fire(screen.field, 'onFocus')
    expect(button(screen.button)?.disabled).toBe(false)
    endEditing(screen.field, '')
    expect(button(screen.button)?.disabled).toBe(true)
  })

  test('nothing is sent when AutoFill emptied the field before the press', async () => {
    type(screen.field, 'typed-pw')
    await pressWhileFocused(screen.field, screen.button)
    endEditing(screen.field, '')
    await settle()
    expect(screen.sent()).toEqual([])
  })

  test('with nothing focused the press submits from state', async () => {
    type(screen.field, 'typed-pw')
    act(() => button(screen.button)?.click())
    await settle()
    expect(screen.sent()).toEqual(['typed-pw'])
  })

  test('Go or Done submits the event text', async () => {
    fire(screen.field, 'onSubmitEditing', text('Filled-pw-2'))
    await settle()
    expect(screen.sent()).toEqual(['Filled-pw-2'])
  })
})

test('sign-in sends the email AutoFill set without onChangeText', async () => {
  view = mount(<SignInScreen />)
  endEditing('Email', 'saved@b.com')
  fire('Password', 'onSubmitEditing', text('saved-pw'))
  await settle()
  expect(state.signIn).toHaveBeenCalledWith('saved@b.com', 'saved-pw')
})
