// @vitest-environment jsdom
/**
 * What `Field` does for password managers: iOS `passwordRules` on new-password
 * fields, and state kept on the native text when AutoFill sets a credential
 * field without `onChangeText`. Also the iOS Done bar on number keypads (APP-731).
 */
import { act, type ReactNode } from 'react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { mount } from '../testing/dom'
import { CLERK_PASSWORD_RULES, Field } from './field'

type Props = Record<string, unknown> & { children?: ReactNode }

const input = vi.hoisted(() => ({
  props: {} as Record<string, unknown>,
  os: 'ios',
  dismiss: vi.fn(),
}))

vi.mock('react-native', async () => {
  const React = await import('react')
  const h = React.createElement
  const box = ({ children }: Props) => h('div', null, children)
  return {
    Platform: {
      get OS() {
        return input.os
      },
    },
    Keyboard: { dismiss: input.dismiss },
    InputAccessoryView: ({ nativeID, children }: Props) =>
      h('div', { 'data-accessory': nativeID }, children),
    Pressable: ({ testID, onPress, children }: Props) =>
      h(
        'button',
        { 'data-testid': testID, onClick: onPress as () => void },
        children as ReactNode,
      ),
    Text: box,
    View: box,
    StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 0.5 },
    TextInput: React.forwardRef(function TextInput(props: Props, _ref) {
      input.props = props
      return h('input')
    }),
  }
})
vi.mock('../i18n', () => ({
  useI18n: () => ({
    t: {
      actions: { done: 'Done', next: 'Next' },
      fields: { showPassword: '', hidePassword: '' },
    },
  }),
}))
vi.mock('../theme/icons', () => ({ UI_ICONS: { Eye: () => null, EyeOff: () => null } }))
vi.mock('../theme/tokens', () => ({
  RADIUS: { card: 0 },
  SIZE: { hitMin: 44 },
  SPACE: { 1: 4, 2: 8, 4: 16 },
  TYPE: { body: {}, bodyStrong: {}, footnoteStrong: {} },
  useTokens: () => ({}),
}))

const event = (text: string) => ({ nativeEvent: { text } })
type Handler = (e: ReturnType<typeof event>) => void

let unmount: (() => void) | undefined
function render(props: Record<string, unknown>) {
  unmount?.()
  const m = mount(<Field label="Field" {...props} />)
  unmount = m.unmount
  return {
    container: m.container,
    endEditing: (text: string) => (input.props.onEndEditing as Handler)(event(text)),
    submit: (text: string) => (input.props.onSubmitEditing as Handler)(event(text)),
  }
}

afterEach(() => {
  unmount?.()
  unmount = undefined
  input.os = 'ios'
  input.dismiss.mockClear()
})

describe('passwordRules', () => {
  test('a new-password field gets the Clerk policy', () => {
    render({ textContentType: 'newPassword' })
    expect(input.props.passwordRules).toBe(CLERK_PASSWORD_RULES)
    expect(CLERK_PASSWORD_RULES).toBe('minlength: 8;')
  })

  test('a current-password field gets none', () => {
    render({ textContentType: 'password', secure: true })
    expect(input.props.passwordRules).toBeUndefined()
  })

  test('a screen can pass its own', () => {
    render({ textContentType: 'newPassword', passwordRules: 'minlength: 12;' })
    expect(input.props.passwordRules).toBe('minlength: 12;')
  })
})

describe('native text sync', () => {
  test('a credential field takes text AutoFill set without onChangeText', () => {
    const onChangeText = vi.fn()
    const field = render({ secure: true, value: 'typed', onChangeText })
    field.endEditing('')
    expect(onChangeText).toHaveBeenCalledWith('')
  })

  test('submitting syncs first, then calls the screen with the event', () => {
    const calls: string[] = []
    const field = render({
      textContentType: 'username',
      value: '',
      onChangeText: (text: string) => calls.push(`change:${text}`),
      onSubmitEditing: (e: ReturnType<typeof event>) =>
        calls.push(`submit:${e.nativeEvent.text}`),
    })
    field.submit('a@b.com')
    expect(calls).toEqual(['change:a@b.com', 'submit:a@b.com'])
  })

  test("a screen's focus handlers run alongside the field's own", () => {
    const onFocus = vi.fn()
    const onBlur = vi.fn()
    render({ secure: true, onFocus, onBlur })
    act(() => (input.props.onFocus as () => void)())
    act(() => (input.props.onBlur as () => void)())
    expect(onFocus).toHaveBeenCalledTimes(1)
    expect(onBlur).toHaveBeenCalledTimes(1)
  })

  test('unchanged text and non-credential fields are left alone', () => {
    const onChangeText = vi.fn()
    const onEndEditing = vi.fn()
    render({ secure: true, value: 'same', onChangeText }).endEditing('same')
    render({ value: 'note', onChangeText, onEndEditing }).endEditing('other')
    expect(onChangeText).not.toHaveBeenCalled()
    expect(onEndEditing).toHaveBeenCalledTimes(1)
  })
})

describe('Done bar', () => {
  test('an iOS number keypad has Done and, when given, Next', () => {
    const onNext = vi.fn()
    const { container } = render({ keyboardType: 'number-pad', onNext })
    const id = input.props.inputAccessoryViewID as string
    expect(container.querySelector(`[data-accessory="${id}"]`)).not.toBeNull()
    const press = (key: string) =>
      act(() =>
        container
          .querySelector<HTMLButtonElement>(`[data-testid="${id}-${key}"]`)
          ?.click(),
      )
    press('next')
    expect(onNext).toHaveBeenCalledTimes(1)
    expect(input.dismiss).not.toHaveBeenCalled()
    press('done')
    expect(input.dismiss).toHaveBeenCalledTimes(1)
  })

  test('Android and text keyboards have none', () => {
    const text = render({ keyboardType: 'default' })
    expect(text.container.querySelector('[data-accessory]')).toBeNull()
    expect(input.props.inputAccessoryViewID).toBeUndefined()
    input.os = 'android'
    const android = render({ keyboardType: 'number-pad' })
    expect(android.container.querySelector('[data-accessory]')).toBeNull()
    expect(input.props.inputAccessoryViewID).toBeUndefined()
  })
})
