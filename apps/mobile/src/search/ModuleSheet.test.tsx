// @vitest-environment jsdom
/**
 * `ModuleSheet` announces each search scope option through `radioProps`
 * on iOS and Android (APP-697).
 */
import { createElement, type ReactNode } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { en } from '../i18n/messages/en'
import { mount } from '../testing/dom'
import { ModuleSheet } from './ModuleSheet'

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
          'data-testid': testID as string | undefined,
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
vi.mock('../components/NativeSheet', () => ({
  NativeSheet: ({ children }: { children: ReactNode }) =>
    createElement('div', null, children),
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
})

afterEach(() => {
  state.os = 'ios'
})

for (const os of ['ios', 'android'] as const) {
  test(`search module choices announce as radios on ${os}`, () => {
    state.os = os
    const view = mount(
      createElement(ModuleSheet, {
        modules: ['tasks', 'notes'],
        selected: 'tasks',
        onSelect: () => {},
        onClose: () => {},
      }),
    )
    const chosen = view.container.querySelector('[data-testid="search-module-tasks"]')
    const all = view.container.querySelector('[data-testid="search-module-all"]')

    if (os === 'ios') {
      expect(chosen?.getAttribute('role')).toBe('button')
      expect(chosen?.getAttribute('aria-selected')).toBe('true')
      expect(chosen?.getAttribute('aria-valuetext')).toBe(en.a11y.radioButton)
      expect(all?.getAttribute('role')).toBe('button')
      expect(all?.getAttribute('aria-selected')).toBe('false')
      expect(all?.getAttribute('aria-valuetext')).toBe(en.a11y.radioButton)
    } else {
      expect(chosen?.getAttribute('role')).toBe('radio')
      expect(chosen?.getAttribute('aria-checked')).toBe('true')
      expect(all?.getAttribute('role')).toBe('radio')
      expect(all?.getAttribute('aria-checked')).toBe('false')
    }

    view.unmount()
  })
}
