// @vitest-environment jsdom
/**
 * The Baby number field names the shared Done bar on its decimal keypad
 * (APP-711).
 */
import { act, type ReactNode } from 'react'
import { afterEach, expect, test, vi } from 'vitest'

import { mount } from '../../testing/dom'
import { NumberField } from './NumberField'

type Props = Record<string, unknown> & { children?: ReactNode }

const input = vi.hoisted(() => ({
  props: {} as Record<string, unknown>,
  dismiss: vi.fn(),
}))

vi.mock('react-native', async () => {
  const React = await import('react')
  const h = React.createElement
  const box = ({ children }: Props) => h('div', null, children)
  return {
    Platform: { OS: 'ios' },
    Keyboard: { dismiss: input.dismiss },
    InputAccessoryView: ({ nativeID, children }: Props) =>
      h('div', { 'data-accessory': nativeID }, children),
    Pressable: ({ testID, onPress, children }: Props) =>
      h(
        'button',
        { 'data-testid': testID, onClick: onPress as () => void },
        children as ReactNode,
      ),
    Text: box,
    View: box,
    StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 0.5 },
    TextInput: (props: Props) => {
      input.props = props
      return h('input')
    },
  }
})
vi.mock('../../feedback/haptics', () => ({
  haptics: { selectionChanged: () => {} },
}))
vi.mock('../../i18n', () => ({
  useI18n: () => ({ t: { actions: { done: 'Done', next: 'Next' } } }),
}))
vi.mock('../../theme/tokens', () => ({
  RADIUS: {},
  SIZE: { hitMin: 44 },
  SPACE: { 1: 4, 2: 8, 4: 16 },
  TABULAR: {},
  TYPE: { body: {}, bodyStrong: {} },
  useTokens: () => ({ tintOf: () => ({}) }),
}))

let unmount: (() => void) | undefined
afterEach(() => {
  unmount?.()
  unmount = undefined
  input.dismiss.mockClear()
})

test('the decimal field has a Done bar tied to it that dismisses the keyboard', () => {
  const m = mount(
    <NumberField
      field={
        { options: [], fallback: '', unit: 'ml' } as unknown as Parameters<
          typeof NumberField
        >[0]['field']
      }
      value=""
      onChange={() => {}}
      label="Amount"
      decreaseLabel="Less"
      increaseLabel="More"
    />,
  )
  unmount = m.unmount
  const id = input.props.inputAccessoryViewID as string
  expect(id).toBeTruthy()
  expect(m.container.querySelector(`[data-accessory="${id}"]`)).not.toBeNull()
  expect(m.container.textContent).toContain('Done')
  act(() =>
    m.container
      .querySelector<HTMLButtonElement>(`[data-testid="${id}-done"]`)
      ?.click(),
  )
  expect(input.dismiss).toHaveBeenCalledTimes(1)
})
