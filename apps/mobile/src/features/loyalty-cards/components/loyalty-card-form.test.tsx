// @vitest-environment jsdom
/**
 * The loyalty card form's colour swatches announce as radio buttons through
 * `radioProps` on both iOS and Android (APP-697).
 */
import { STORE_COLOR_PRESETS } from '@gather/core/loyalty-cards'
import { createElement, type ReactNode } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { en } from '../../../i18n/messages/en'
import { mount } from '../../../testing/dom'
import { LoyaltyCardForm } from './loyalty-card-form'

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
    View: dom('div'),
    Text: dom('span'),
    Pressable: dom('button'),
    StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  }
})
vi.mock('@expo/ui/community/menu', () => ({
  MenuView: ({ children }: { children?: ReactNode }) =>
    createElement('div', null, children),
}))
vi.mock('convex/react', () => ({ useMutation: () => async () => 'url' }))
vi.mock('../../../components/PhotoField', () => ({ PhotoField: () => null }))
vi.mock('../../../convex/api', () => ({
  api: { loyaltyCards: { generateUploadUrl: '' } },
}))
vi.mock('../../../feedback/haptics', () => ({
  haptics: new Proxy({}, { get: () => () => {} }),
}))
vi.mock('../../../i18n', async () => {
  const { en: messages } = await import('../../../i18n/messages/en')
  const { fmt } = await import('@gather/core/i18n')
  return { fmt, useI18n: () => ({ t: messages, locale: 'en' }) }
})
vi.mock('../../../theme/icons', () => ({
  UI_ICONS: new Proxy({}, { get: () => () => null }),
}))
vi.mock('../../../theme/tokens', () => ({
  RADIUS: new Proxy({}, { get: () => 8 }),
  TYPE: new Proxy({}, { get: () => ({}) }),
  useTokens: () => new Proxy({}, { get: (_, key) => String(key) }),
}))
vi.mock('../../../ui/button', () => ({ Button: () => null }))
vi.mock('../../../ui/field', () => ({ Field: () => null }))
vi.mock('./card-barcode', () => ({ CardBarcode: () => null }))

beforeEach(() => {
  state.os = 'ios'
})

afterEach(() => {
  state.os = 'ios'
})

for (const os of ['ios', 'android'] as const) {
  test(`colour swatches announce as radio buttons on ${os}`, () => {
    state.os = os
    const chosen = STORE_COLOR_PRESETS[1]!
    const other = STORE_COLOR_PRESETS[0]!
    const view = mount(
      createElement(LoyaltyCardForm, {
        initial: {
          storeName: 'Corner Shop',
          cardNumber: '',
          barcodeFormat: 'EAN_13',
          holder: '',
          note: '',
        },
        storeFixed: false,
        colorPickable: true,
        initialColor: chosen.hex,
        submitting: false,
        problem: null,
        onSubmit: () => {},
      }),
    )

    const selected = view.container.querySelector(
      `[data-testid="loyalty-card-color-${chosen.id}"]`,
    )
    const unselected = view.container.querySelector(
      `[data-testid="loyalty-card-color-${other.id}"]`,
    )

    if (os === 'ios') {
      expect(selected?.getAttribute('role')).toBe('button')
      expect(selected?.getAttribute('aria-selected')).toBe('true')
      expect(selected?.getAttribute('aria-valuetext')).toBe(en.a11y.radioButton)
      expect(unselected?.getAttribute('role')).toBe('button')
      expect(unselected?.getAttribute('aria-selected')).toBe('false')
      expect(unselected?.getAttribute('aria-valuetext')).toBe(en.a11y.radioButton)
    } else {
      expect(selected?.getAttribute('role')).toBe('radio')
      expect(selected?.getAttribute('aria-checked')).toBe('true')
      expect(unselected?.getAttribute('role')).toBe('radio')
      expect(unselected?.getAttribute('aria-checked')).toBe('false')
    }

    view.unmount()
  })
}
