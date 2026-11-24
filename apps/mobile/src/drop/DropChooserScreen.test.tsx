// @vitest-environment jsdom
/**
 * The Drop chooser's destination list and group sheet announce their options
 * through `radioProps` on iOS and Android (APP-697).
 */
import { createElement, type ReactNode } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import type { Id } from '../convex/api'
import { en } from '../i18n/messages/en'
import { mount } from '../testing/dom'
import { DropChooserScreen } from './DropChooserScreen'
import { DropGroupSheet } from './DropGroupSheet'

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
      testID,
      accessibilityLabel,
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
          'data-testid': testID as string | undefined,
          'aria-label': accessibilityLabel as string | undefined,
          role: accessibilityRole as string | undefined,
          'aria-selected': a11yState?.selected,
          'aria-checked': a11yState?.checked,
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
    ActivityIndicator: () => null,
    View: dom('div'),
    ScrollView: dom('div'),
    Text: dom('span'),
    Pressable: dom('button'),
    StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  }
})
vi.mock('expo-image', () => ({ Image: () => null }))
vi.mock('expo-router', () => ({
  Stack: Object.assign(() => null, { Screen: () => null }),
  useLocalSearchParams: () => ({}),
  useRouter: () => ({ push: () => {}, replace: () => {}, dismissTo: () => {} }),
}))
vi.mock('../components/NativeSheet', () => ({
  NativeSheet: ({ children }: { children: ReactNode }) =>
    createElement('div', null, children),
}))
vi.mock('../feedback/haptics', () => ({
  haptics: new Proxy({}, { get: () => () => {} }),
}))
vi.mock('../group/GroupProvider', () => ({
  useGroup: () => ({
    group: { _id: 'g1', name: 'Home' },
    groups: [
      { _id: 'g1', name: 'Home' },
      { _id: 'g2', name: 'Cabin' },
    ],
  }),
  useOpenInGroup: () => () => {},
}))
vi.mock('../i18n', async () => {
  const { en: messages } = await import('../i18n/messages/en')
  const { fmt } = await import('@gather/core/i18n')
  return { fmt, useI18n: () => ({ t: messages, locale: 'en' }) }
})
vi.mock('../modules/buildModules', () => ({ moduleShown: () => true }))
vi.mock('../theme/icons', () => ({
  MODULE_ICONS: new Proxy({}, { get: () => () => null }),
  UI_ICONS: new Proxy({}, { get: () => () => null }),
}))
vi.mock('../theme/tokens', () => ({
  RADIUS: new Proxy({}, { get: () => 8 }),
  SIZE: new Proxy({}, { get: () => 44 }),
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
vi.mock('./DropProvider', () => ({
  useDrop: () => ({
    pending: {
      drop: {
        kind: 'url' as const,
        url: 'https://example.com/recipe',
        host: 'example.com',
        title: 'Pasta',
      },
    },
    offer: () => {},
    clear: () => {},
  }),
}))
vi.mock('./useDropCommit', () => ({
  useDropCommit: () => async () => ({ ok: true, href: '/home' }),
}))

beforeEach(() => {
  state.os = 'ios'
})

afterEach(() => {
  state.os = 'ios'
})

for (const os of ['ios', 'android'] as const) {
  test(`DropChooserScreen target choices announce as radios on ${os}`, () => {
    state.os = os
    const view = mount(createElement(DropChooserScreen))
    const group = view.container.querySelector('[role="radiogroup"]')
    expect(group).not.toBeNull()
    const options = Array.from(group?.querySelectorAll('button') ?? [])
    expect(options.length).toBeGreaterThan(1)

    if (os === 'ios') {
      expect(options.every((el) => el.getAttribute('role') === 'button')).toBe(true)
      expect(
        options.every(
          (el) => el.getAttribute('aria-valuetext') === en.a11y.radioButton,
        ),
      ).toBe(true)
      expect(options[0]?.getAttribute('aria-selected')).toBe('true')
      expect(options[1]?.getAttribute('aria-selected')).toBe('false')
    } else {
      expect(options.every((el) => el.getAttribute('role') === 'radio')).toBe(true)
      expect(options[0]?.getAttribute('aria-checked')).toBe('true')
      expect(options[1]?.getAttribute('aria-checked')).toBe('false')
    }

    view.unmount()
  })

  test(`DropGroupSheet group choices announce as radios on ${os}`, () => {
    state.os = os
    const view = mount(
      createElement(DropGroupSheet, {
        selected: 'g2' as Id<'groups'>,
        onSelect: () => {},
        onClose: () => {},
      }),
    )
    const buttons = Array.from(view.container.querySelectorAll('button'))
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
}
