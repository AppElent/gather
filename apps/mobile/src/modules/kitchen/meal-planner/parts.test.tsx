// @vitest-environment jsdom
/**
 * The week's Boodschappen pill reads as "Boodschappen" only: an explicit label,
 * and the cart glyph hidden from VoiceOver so iOS does not read the SF Symbol's
 * name first (APP-461).
 */
import { createElement, type ReactNode } from 'react'
import { afterEach, expect, test, vi } from 'vitest'

import { mount } from '../../../testing/dom'
import { GroceriesPill } from './parts'

type Props = Record<string, unknown> & { children?: ReactNode }

vi.mock('react-native', async () => {
  const React = await import('react')
  const h = React.createElement
  return {
    View: ({ children }: Props) => h('div', null, children),
    Text: ({ children }: Props) => h('span', null, children),
    Pressable: ({ children, testID, accessibilityLabel, onPress }: Props) =>
      h(
        'button',
        {
          'data-testid': testID as string,
          'aria-label': accessibilityLabel as string | undefined,
          onClick: () => (onPress as () => void)(),
        },
        children,
      ),
    StyleSheet: { create: <T,>(styles: T) => styles },
  }
})
vi.mock('../../../theme/icons', async () => {
  const React = await import('react')
  return {
    UI_ICONS: {
      Cart: (props: Props) =>
        React.createElement('i', {
          'data-testid': 'cart',
          'aria-hidden': props.accessibilityElementsHidden ? 'true' : undefined,
          'data-android': props.importantForAccessibility,
        }),
    },
  }
})
vi.mock('../../../theme/tokens', () => ({
  RADIUS: { pill: 999 },
  SIZE: { hitMin: 44 },
  SPACE: [0, 4, 8, 12, 16],
  TYPE: { body: {} },
  useTokens: () => ({ surface: '#fff', ink: '#000' }),
}))
vi.mock('../../../feedback/haptics', () => ({ haptics: {} }))
vi.mock('../../../ui/record-thumb', () => ({ RecordThumb: () => null }))

afterEach(() => {
  document.body.innerHTML = ''
})

test('labels the pill Boodschappen and hides the cart glyph', () => {
  const onPress = vi.fn()
  const { container } = mount(
    createElement(GroceriesPill, { label: 'Boodschappen', onPress }),
  )
  const pill = container.querySelector('[data-testid="meal-planner-groceries"]')
  expect(pill?.getAttribute('aria-label')).toBe('Boodschappen')
  expect(pill?.textContent).toBe('Boodschappen')
  const cart = container.querySelector('[data-testid="cart"]')
  expect(cart?.getAttribute('aria-hidden')).toBe('true')
  expect(cart?.getAttribute('data-android')).toBe('no-hide-descendants')
  ;(pill as HTMLButtonElement).click()
  expect(onPress).toHaveBeenCalledOnce()
})
