// @vitest-environment jsdom
/**
 * `GroupSwitcherSheet` announces each Group choice through `radioProps` and
 * preserves disabled state while service actions are unavailable (APP-697).
 */
import { createElement, type ReactNode } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { en } from '../i18n/messages/en'
import { mount } from '../testing/dom'
import { GroupSwitcherSheet } from './GroupSwitcherSheet'

const state = vi.hoisted(() => ({
  os: 'ios' as 'ios' | 'android',
  serviceActionsEnabled: true,
}))

vi.mock('react-native', async () => {
  const React = await import('react')
  type Props = Record<string, unknown> & { children?: ReactNode }
  const dom =
    (tag: string) =>
    ({
      children,
      accessibilityRole,
      accessibilityState,
      accessibilityValue,
      onPress,
      disabled,
    }: Props) => {
      const a11yState = accessibilityState as
        | { selected?: boolean; checked?: boolean; disabled?: boolean }
        | undefined
      const a11yValue = accessibilityValue as { text?: string } | undefined
      return React.createElement(
        tag,
        {
          role: accessibilityRole as string | undefined,
          'aria-selected': a11yState?.selected,
          'aria-checked': a11yState?.checked,
          'aria-disabled': a11yState?.disabled,
          'aria-valuetext': a11yValue?.text,
          disabled: Boolean(disabled),
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
vi.mock('../availability/AvailabilityProvider', () => ({
  useAvailability: () => ({
    serviceActionsEnabled: state.serviceActionsEnabled,
  }),
}))
vi.mock('../components/NativeSheet', () => ({
  NativeSheet: ({ children }: { children: ReactNode }) =>
    createElement('div', null, children),
}))
vi.mock('../group/GroupProvider', () => ({
  useGroup: () => ({
    group: { _id: 'g1', name: 'Home' },
    groups: [
      { _id: 'g1', name: 'Home' },
      { _id: 'g2', name: 'Cabin' },
    ],
    setGroup: () => {},
  }),
}))
vi.mock('../i18n', async () => {
  const { en: messages } = await import('../i18n/messages/en')
  return { useI18n: () => ({ t: messages, locale: 'en' }) }
})
vi.mock('../theme/icons', () => ({
  UI_ICONS: new Proxy({}, { get: () => () => null }),
}))
vi.mock('../theme/tokens', () => ({
  RADIUS: new Proxy({}, { get: () => 8 }),
  TYPE: new Proxy({}, { get: () => ({}) }),
  useTokens: () => new Proxy({}, { get: (_, key) => String(key) }),
}))

beforeEach(() => {
  state.os = 'ios'
  state.serviceActionsEnabled = true
})

afterEach(() => {
  state.os = 'ios'
})

for (const os of ['ios', 'android'] as const) {
  test(`Group choices announce as radios on ${os} and keep disabled state`, () => {
    state.os = os
    state.serviceActionsEnabled = false
    const view = mount(createElement(GroupSwitcherSheet, { onClose: () => {} }))
    const buttons = Array.from(view.container.querySelectorAll('button'))
    expect(buttons).toHaveLength(2)

    if (os === 'ios') {
      expect(buttons[0]?.getAttribute('role')).toBe('button')
      expect(buttons[0]?.getAttribute('aria-selected')).toBe('true')
      expect(buttons[0]?.getAttribute('aria-valuetext')).toBe(en.a11y.radioButton)
      expect(buttons[0]?.getAttribute('aria-disabled')).toBe('true')
      expect(buttons[1]?.getAttribute('aria-selected')).toBe('false')
    } else {
      expect(buttons[0]?.getAttribute('role')).toBe('radio')
      expect(buttons[0]?.getAttribute('aria-checked')).toBe('true')
      expect(buttons[0]?.getAttribute('aria-disabled')).toBe('true')
      expect(buttons[1]?.getAttribute('role')).toBe('radio')
      expect(buttons[1]?.getAttribute('aria-checked')).toBe('false')
    }

    view.unmount()
  })
}
