// @vitest-environment jsdom
/** A share closes the keyboard composer, as it closes a sheet (APP-672). */
import { act, createElement, type ReactNode, useState } from 'react'
import { expect, test, vi } from 'vitest'

import { closeOpenSheets, hasOpenSheets } from '../components/openSheets'
import { mount } from '../testing/dom'
import { KeyboardComposer, useKeyboard } from './keyboard-composer'

type Props = { children?: ReactNode }

// The shell only: what is drawn inside the modal is not what is asked here.
vi.mock('./modal', () => ({ Modal: () => null }))
const keyboard = vi.hoisted(() => ({
  on: {} as Record<string, (event: { duration: number }) => void>,
}))
vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  Keyboard: {
    isVisible: () => false,
    addListener: (
      name: string,
      listener: (event: { duration: number }) => void,
    ) => {
      keyboard.on[name] = listener
      return { remove: () => {} }
    },
  },
  StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
}))
vi.mock('react-native-gesture-handler', () => ({
  Gesture: {},
  GestureDetector: () => null,
  GestureHandlerRootView: ({ children }: Props) => children,
}))
vi.mock('react-native-reanimated', () => ({
  default: {}, LinearTransition: { duration: () => ({}) },
}))
vi.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: Props) => children,
}))
vi.mock('@expo/ui/community/menu', () => ({ MenuView: () => null }))
vi.mock('../i18n', () => ({}))
vi.mock('../theme/icons', () => ({ UI_ICONS: {} }))
vi.mock('../theme/tokens', () => ({
  RADIUS: {},
  SIZE: {},
  SPACE: [],
  TYPE: {},
  useTokens: () => ({}),
}))

const onClose = vi.fn()

function Place() {
  const [open, setOpen] = useState(true)
  return open
    ? createElement(KeyboardComposer, {
        onClose: () => {
          onClose()
          setOpen(false)
        },
      } as never)
    : null
}

test('a share closes it once, and waits for it to go', async () => {
  const view = mount(createElement(Place))
  expect(hasOpenSheets()).toBe(true)
  await act(() => closeOpenSheets())
  expect(onClose).toHaveBeenCalledOnce()
  expect(hasOpenSheets()).toBe(false)
  view.unmount()
})

test('a card the person closed is not listed any more', () => {
  const view = mount(createElement(Place))
  view.unmount()
  expect(hasOpenSheets()).toBe(false)
})

test('the keyboard counts as moving until its own animation is over (APP-774)', () => {
  vi.useFakeTimers()
  let now = { up: false, moving: false }
  function Card() {
    now = useKeyboard()
    return null
  }
  const view = mount(createElement(Card))
  expect(now).toEqual({ up: false, moving: false })
  act(() => keyboard.on.keyboardWillShow?.({ duration: 250 }))
  expect(now).toEqual({ up: true, moving: true })
  act(() => void vi.advanceTimersByTime(250))
  expect(now.moving).toBe(true)
  act(() => void vi.advanceTimersByTime(100))
  expect(now).toEqual({ up: true, moving: false })
  act(() => keyboard.on.keyboardWillHide?.({ duration: 250 }))
  expect(now).toEqual({ up: false, moving: true })
  view.unmount()
  vi.useRealTimers()
})
