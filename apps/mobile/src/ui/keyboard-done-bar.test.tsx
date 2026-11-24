// @vitest-environment jsdom
/**
 * The Done accessory above the iOS decimal keypad (APP-711): present on iOS
 * for decimal keypads, absent on Android and on text keyboards, and Done
 * dismisses the keyboard.
 */
import { act, type ReactNode } from 'react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { mount } from '../testing/dom'
import { useKeyboardDoneBar } from './keyboard-done-bar'

type Props = Record<string, unknown> & { children?: ReactNode }

const rn = vi.hoisted(() => ({ os: 'ios', dismiss: vi.fn() }))

vi.mock('react-native', async () => {
  const React = await import('react')
  const h = React.createElement
  return {
    Platform: {
      get OS() {
        return rn.os
      },
    },
    Keyboard: { dismiss: rn.dismiss },
    InputAccessoryView: ({ nativeID, children }: Props) =>
      h('div', { 'data-accessory': nativeID }, children),
    Pressable: ({ testID, onPress, children }: Props) =>
      h(
        'button',
        { 'data-testid': testID, onClick: onPress as () => void },
        children as ReactNode,
      ),
    Text: ({ children }: Props) => h('span', null, children),
    View: ({ children }: Props) => h('div', null, children),
    StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 0.5 },
  }
})
vi.mock('../i18n', () => ({
  useI18n: () => ({ t: { actions: { done: 'Done', next: 'Next' } } }),
}))
vi.mock('../theme/tokens', () => ({
  SIZE: { hitMin: 44 },
  SPACE: { 1: 4, 2: 8, 4: 16 },
  TYPE: { body: {}, bodyStrong: {} },
  useTokens: () => ({}),
}))

let probe: ReturnType<typeof useKeyboardDoneBar>
function Field(props: Parameters<typeof useKeyboardDoneBar>[0]) {
  probe = useKeyboardDoneBar(props)
  return <>{probe.accessory}</>
}

let unmount: (() => void) | undefined
function render(props: Parameters<typeof useKeyboardDoneBar>[0]) {
  unmount?.()
  const m = mount(<Field {...props} />)
  unmount = m.unmount
  return m.container
}

afterEach(() => {
  unmount?.()
  unmount = undefined
  rn.os = 'ios'
  rn.dismiss.mockClear()
})

describe('useKeyboardDoneBar', () => {
  test('on iOS a decimal keypad gets a Done bar that dismisses the keyboard', () => {
    const container = render({ keyboardType: 'decimal-pad', id: 'amount' })
    expect(probe.inputAccessoryViewID).toBe('amount')
    expect(container.querySelector('[data-accessory="amount"]')).not.toBeNull()
    expect(container.textContent).toContain('Done')
    expect(container.querySelector('[data-testid="amount-next"]')).toBeNull()
    act(() =>
      container
        .querySelector<HTMLButtonElement>('[data-testid="amount-done"]')
        ?.click(),
    )
    expect(rn.dismiss).toHaveBeenCalledTimes(1)
  })

  test('Next shows only where there is a next field', () => {
    const onNext = vi.fn()
    const container = render({
      keyboardType: 'decimal-pad',
      id: 'amount',
      onNext,
    })
    act(() =>
      container
        .querySelector<HTMLButtonElement>('[data-testid="amount-next"]')
        ?.click(),
    )
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  test('a generated id is used when none is given', () => {
    render({ keyboardType: 'decimal-pad' })
    expect(probe.inputAccessoryViewID).toMatch(/^keyboard-done-/)
  })

  test('Android gets no accessory', () => {
    rn.os = 'android'
    const container = render({ keyboardType: 'decimal-pad', id: 'amount' })
    expect(probe.inputAccessoryViewID).toBeUndefined()
    expect(container.innerHTML).toBe('')
  })

  test('number-pad also gets a Done bar on iOS', () => {
    const container = render({ keyboardType: 'number-pad', id: 'count' })
    expect(probe.inputAccessoryViewID).toBe('count')
    expect(container.querySelector('[data-accessory="count"]')).not.toBeNull()
  })

  test('text and numbers-and-punctuation keyboards get no accessory', () => {
    for (const keyboardType of ['default', 'numbers-and-punctuation'] as const) {
      const container = render({ keyboardType, id: 'name' })
      expect(probe.inputAccessoryViewID).toBeUndefined()
      expect(container.innerHTML).toBe('')
    }
  })

  test('the input key follows keyboardType so a changed keypad remounts the field', () => {
    const keyFor = (keyboardType?: Parameters<typeof useKeyboardDoneBar>[0]['keyboardType']) => {
      render({ keyboardType, id: 'amount' })
      return probe.inputKey
    }
    const keys = ['default', 'decimal-pad', 'number-pad'].map((k) =>
      keyFor(k as 'default'),
    )
    expect(new Set(keys).size).toBe(3)
    expect(keyFor('decimal-pad')).toBe(keys[1])
    expect(keyFor(undefined)).toBe(keys[0])
    rn.os = 'android'
    expect(keyFor('decimal-pad')).toBe(keys[1])
  })
})
