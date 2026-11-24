// @vitest-environment jsdom
/**
 * Baby's `ListPicker` and `ChildSwitcher` announce their single-choice lists
 * through `radioProps` on iOS and Android (APP-697).
 */
import { act, createElement, type ReactNode } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { en } from '../../i18n/messages/en'
import { mount } from '../../testing/dom'
import { ChildSwitcher } from './ChildSwitcher'
import { ListPicker } from './ListPicker'

const state = vi.hoisted(() => ({
  os: 'ios' as 'ios' | 'android',
}))

vi.mock('react-native', async () => {
  const React = await import('react')
  type Props = Record<string, unknown> & { children?: ReactNode }
  const dom =
    (tag: string) =>
    ({
      children,
      accessibilityLabel,
      accessibilityRole,
      accessibilityState,
      accessibilityValue,
      onPress,
    }: Props) => {
      const a11yState = accessibilityState as
        | { selected?: boolean; checked?: boolean }
        | undefined
      const a11yValue = accessibilityValue as { text?: string } | undefined
      return React.createElement(
        tag,
        {
          'aria-label': accessibilityLabel as string | undefined,
          role: accessibilityRole as string | undefined,
          'aria-selected': a11yState?.selected,
          'aria-checked': a11yState?.checked,
          'aria-valuetext': a11yValue?.text,
          onClick: onPress as (() => void) | undefined,
        },
        typeof children === 'function'
          ? (children as (s: { pressed: boolean }) => ReactNode)({
              pressed: false,
            })
          : children,
      )
    }
  return {
    Platform: {
      get OS() {
        return state.os
      },
    },
    View: dom('div'),
    ScrollView: dom('div'),
    Text: dom('span'),
    Pressable: dom('button'),
    StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  }
})
vi.mock('../../components/NativeContextMenu', () => ({
  NativeContextMenu: ({ children }: { children: ReactNode }) => children,
}))
vi.mock('../../components/NativeSheet', () => ({
  NativeSheet: ({ children }: { children: ReactNode }) =>
    createElement('div', null, children),
}))
vi.mock('../../i18n', async () => {
  const { en: messages } = await import('../../i18n/messages/en')
  const { fmt } = await import('@gather/core/i18n')
  return { fmt, useI18n: () => ({ t: messages, locale: 'en' }) }
})
vi.mock('../../theme/icons', () => ({
  UI_ICONS: new Proxy({}, { get: () => () => null }),
}))
vi.mock('../../theme/tokens', () => ({
  RADIUS: new Proxy({}, { get: () => 8 }),
  TYPE: new Proxy({}, { get: () => ({}) }),
  useTokens: () =>
    new Proxy(
      {},
      {
        get: (_, key) =>
          key === 'tintOf'
            ? () => ({ fill: 'fill', on: 'on', text: 'text', wash: 'wash' })
            : String(key),
      },
    ),
}))
vi.mock('./icons', () => ({
  BABY_UI_ICONS: new Proxy({}, { get: () => () => null }),
}))

beforeEach(() => {
  state.os = 'ios'
})

afterEach(() => {
  state.os = 'ios'
})

for (const os of ['ios', 'android'] as const) {
  test(`ListPicker options announce as radios on ${os}`, () => {
    state.os = os
    const view = mount(
      createElement(ListPicker, {
        title: 'To-do list',
        defaultName: 'Mila to-dos',
        lists: [
          { _id: 'l1', name: 'Existing', provider: 'local', writable: true },
        ],
        value: {
          kind: 'existing',
          listId: 'l1',
          writable: true,
          provider: 'local',
        },
        onChange: () => {},
        groupName: 'Home',
      }),
    )

    // Open the inline options list.
    const toggle = view.container.querySelector('button')!
    act(() => toggle.click())

    const buttons = Array.from(view.container.querySelectorAll('button')).slice(1)
    expect(buttons).toHaveLength(2)

    if (os === 'ios') {
      expect(buttons[0]?.getAttribute('role')).toBe('button')
      expect(buttons[0]?.getAttribute('aria-selected')).toBe('false')
      expect(buttons[0]?.getAttribute('aria-valuetext')).toBe(en.a11y.radioButton)
      expect(buttons[1]?.getAttribute('role')).toBe('button')
      expect(buttons[1]?.getAttribute('aria-selected')).toBe('true')
      expect(buttons[1]?.getAttribute('aria-valuetext')).toBe(en.a11y.radioButton)
    } else {
      expect(buttons[0]?.getAttribute('role')).toBe('radio')
      expect(buttons[0]?.getAttribute('aria-checked')).toBe('false')
      expect(buttons[1]?.getAttribute('role')).toBe('radio')
      expect(buttons[1]?.getAttribute('aria-checked')).toBe('true')
    }

    view.unmount()
  })

  test(`ChildSwitcher rows announce as radios on ${os}`, () => {
    state.os = os
    const view = mount(
      createElement(ChildSwitcher, {
        items: [
          { _id: 'c1', name: 'Mila' },
          { _id: 'c2', name: 'Noah' },
        ],
        selectedId: 'c1',
        onSelect: () => {},
        onEdit: () => {},
        onDelete: () => {},
        onAdd: () => {},
        onClose: () => {},
      }),
    )

    const radios = Array.from(view.container.querySelectorAll('button')).filter(
      (button) =>
        os === 'ios'
          ? button.getAttribute('aria-valuetext') === en.a11y.radioButton
          : button.getAttribute('role') === 'radio',
    )
    expect(radios).toHaveLength(2)

    if (os === 'ios') {
      expect(radios[0]?.getAttribute('role')).toBe('button')
      expect(radios[0]?.getAttribute('aria-selected')).toBe('true')
      expect(radios[1]?.getAttribute('aria-selected')).toBe('false')
    } else {
      expect(radios[0]?.getAttribute('aria-checked')).toBe('true')
      expect(radios[1]?.getAttribute('aria-checked')).toBe('false')
    }

    view.unmount()
  })
}
