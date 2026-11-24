// @vitest-environment jsdom
/**
 * `VocabularySheet` announces its single-choice vocabulary rows through
 * `radioProps` on iOS and Android (APP-697).
 */
import { createElement, type ReactNode } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { en } from '../../i18n/messages/en'
import { mount } from '../../testing/dom'
import { VocabularySheet } from './VocabularySheet'

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
    TextInput: dom('input'),
    Pressable: dom('button'),
    StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  }
})
vi.mock('../../components/NativeSheet', () => ({
  NativeSheet: ({ children }: { children: ReactNode }) =>
    createElement('div', null, children),
}))
vi.mock('../../feedback/haptics', () => ({
  haptics: new Proxy({}, { get: () => () => {} }),
}))
vi.mock('../../i18n', async () => {
  const { en: messages } = await import('../../i18n/messages/en')
  return { useI18n: () => ({ t: messages, locale: 'en' }) }
})
vi.mock('../../theme/icons', () => ({
  UI_ICONS: new Proxy({}, { get: () => () => null }),
}))
vi.mock('../../theme/tokens', () => ({
  RADIUS: new Proxy({}, { get: () => 8 }),
  TYPE: new Proxy({}, { get: () => ({}) }),
  useTokens: () => new Proxy({}, { get: (_, key) => String(key) }),
}))
vi.mock('../../ui/sheet-drafts', () => ({
  useSheetDraft: () => ({ kept: undefined, track: () => {}, finish: () => {} }),
}))

beforeEach(() => {
  state.os = 'ios'
})

afterEach(() => {
  state.os = 'ios'
})

for (const os of ['ios', 'android'] as const) {
  test(`vocabulary options announce as radios on ${os}`, () => {
    state.os = os
    const view = mount(
      createElement(VocabularySheet, {
        title: 'Country',
        vocabulary: 'cheeseCountry',
        selected: 'france',
        onSelect: () => {},
        onClose: () => {},
      }),
    )

    const buttons = Array.from(view.container.querySelectorAll('button'))
    expect(buttons.length).toBeGreaterThan(2)
    const france = buttons.find((el) => el.getAttribute('aria-label') === 'France')
    const none = buttons[0]

    if (os === 'ios') {
      expect(france?.getAttribute('role')).toBe('button')
      expect(france?.getAttribute('aria-selected')).toBe('true')
      expect(france?.getAttribute('aria-valuetext')).toBe(en.a11y.radioButton)
      expect(none?.getAttribute('role')).toBe('button')
      expect(none?.getAttribute('aria-selected')).toBe('false')
      expect(none?.getAttribute('aria-valuetext')).toBe(en.a11y.radioButton)
    } else {
      expect(france?.getAttribute('role')).toBe('radio')
      expect(france?.getAttribute('aria-checked')).toBe('true')
      expect(none?.getAttribute('role')).toBe('radio')
      expect(none?.getAttribute('aria-checked')).toBe('false')
    }

    view.unmount()
  })
}
