// @vitest-environment jsdom
/**
 * The card's layout animation crashed a close that came while the keyboard was
 * moving (APP-774), so it is off while the keyboard moves (APP-817). The card
 * is rendered here, with the animated view recording its `layout`.
 */
import { act, createElement, type ReactNode } from 'react'
import { expect, test, vi } from 'vitest'

import { mount } from '../testing/dom'
import { KeyboardComposer } from './keyboard-composer'

type Props = { children?: ReactNode }

const seen = vi.hoisted(() => ({
  layouts: [] as unknown[],
  on: {} as Record<string, (event: { duration: number }) => void>,
}))

vi.mock('./modal', () => ({ Modal: ({ children }: Props) => children }))
vi.mock('react-native', () => {
  const part = ({ children }: Props) => children ?? null
  return {
    Platform: { OS: 'ios' },
    Keyboard: {
      isVisible: () => false,
      dismiss: () => {},
      addListener: (
        name: string,
        listener: (event: { duration: number }) => void,
      ) => {
        seen.on[name] = listener
        return { remove: () => {} }
      },
    },
    StyleSheet: {
      create: <T,>(styles: T) => styles,
      hairlineWidth: 1,
      absoluteFill: {},
    },
    ActivityIndicator: part,
    KeyboardAvoidingView: part,
    Pressable: part,
    ScrollView: part,
    Text: part,
    TextInput: part,
    View: part,
  }
})
vi.mock('react-native-gesture-handler', () => {
  const chain: object = new Proxy(() => chain, { get: () => chain })
  return {
    Gesture: { Pan: () => chain },
    GestureDetector: ({ children }: Props) => children,
    GestureHandlerRootView: ({ children }: Props) => children,
  }
})
vi.mock('react-native-reanimated', () => ({
  default: {
    View: (props: { layout?: unknown; children?: ReactNode }) => {
      seen.layouts.push(props.layout)
      return props.children ?? null
    },
  },
  LinearTransition: { duration: () => ({ marker: 'transition' }) },
  useAnimatedStyle: () => ({}),
  useSharedValue: (value: number) => ({ value }),
  withSpring: (value: number) => value,
}))
vi.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: Props) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))
vi.mock('@expo/ui/community/menu', () => ({ MenuView: () => null }))
vi.mock('../i18n', () => ({
  useI18n: () => ({ t: { composer: {} } }),
}))
vi.mock('../theme/icons', () => ({
  UI_ICONS: new Proxy({}, { get: () => () => null }),
}))
vi.mock('../theme/tokens', () => ({
  RADIUS: {},
  SIZE: {},
  SPACE: [0, 0, 0, 0],
  TYPE: {},
  useTokens: () => ({}),
}))

const last = () => seen.layouts[seen.layouts.length - 1]

test('the card has no layout animation while the keyboard moves, and has one after', () => {
  vi.useFakeTimers()
  const view = mount(
    createElement(KeyboardComposer, {
      group: 'tasks',
      onClose: () => {},
      renderTitle: () => null,
      body: {
        value: '',
        onChange: () => {},
        visible: false,
        placeholder: '',
        accessibilityLabel: '',
      },
      chips: [],
      allChips: [],
      canSave: false,
      onSave: () => {},
    } as never),
  )
  expect(last()).toBeDefined()
  act(() => seen.on.keyboardWillShow?.({ duration: 250 }))
  expect(last()).toBeUndefined()
  act(() => void vi.advanceTimersByTime(1000))
  expect(last()).toBeDefined()
  view.unmount()
  vi.useRealTimers()
})
