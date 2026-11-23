// @vitest-environment jsdom
/**
 * The item screen's amount (APP-671): every change names the amount it was
 * made over, so it never writes over another Member's. React Native, the
 * store and the theme are replaced; the component is real.
 */
import { act, createElement, type ReactNode } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'

import { mount, settle } from '../../testing/dom'
import { GroceryFields } from './GroceryFields'
import type { Task } from './types'

const state = vi.hoisted(() => ({
  writes: [] as { to: unknown; expected: unknown; fail: () => void }[],
}))

vi.mock('react-native', async () => {
  const React = await import('react')
  type Props = Record<string, unknown> & { children?: ReactNode }
  const dom =
    (tag: string) =>
    ({ children, testID, onPress }: Props) =>
      React.createElement(
        tag,
        { 'data-testid': testID as string, onClick: onPress as () => void },
        children,
      )
  return {
    View: dom('div'),
    Text: dom('span'),
    Pressable: dom('button'),
    TextInput: ({ testID, value }: Props) =>
      React.createElement('input', {
        'data-testid': testID as string,
        value: value as string,
        readOnly: true,
      }),
    StyleSheet: { create: <T,>(styles: T) => styles },
  }
})
vi.mock('@expo/ui/community/menu', () => ({ MenuView: () => null }))
vi.mock('../../feedback/haptics', () => ({
  haptics: new Proxy({}, { get: () => () => {} }),
}))
vi.mock('../../group/GroupProvider', () => ({
  useGroup: () => ({ group: { slug: 'jansen' } }),
}))
vi.mock('../../i18n', async () => {
  const { en } = await import('../../i18n/messages/en')
  return { useI18n: () => ({ t: en, locale: 'en' }) }
})
vi.mock('../../theme/icons', () => ({
  UI_ICONS: new Proxy({}, { get: () => () => null }),
}))
vi.mock('../../theme/tokens', () => ({
  SPACE: [0, 4, 8, 12, 16, 20, 24],
  TABULAR: {},
  TYPE: new Proxy({}, { get: () => ({}) }),
  useTokens: () => ({}),
}))
vi.mock('../../ui/card', () => ({
  Card: ({ children }: { children: ReactNode }) => children,
}))
vi.mock('../kitchen/add-to-groceries/use-aisles', () => ({
  useAisleOf: () => () => undefined,
}))
vi.mock('./store', () => ({
  useTaskActions: () => ({
    setAmount: (_id: string, to: unknown, expected: unknown) =>
      new Promise<void>((_resolve, reject) => {
        state.writes.push({ to, expected, fail: () => reject(new Error('changed')) })
      }),
  }),
}))

const pak = (quantity: number) => ({ quantity, unit: 'pak' as const })
const melk = { id: 'melk', title: 'Melk', done: false, ...pak(1) } as Task

beforeEach(() => {
  state.writes = []
})

function open() {
  const view = mount(createElement(GroceryFields, { task: melk, writable: true }))
  const find = (id: string) =>
    view.container.querySelector<HTMLElement>(`[data-testid="${id}"]`)!
  return {
    more: () => act(() => find('grocery-increase').click()),
    shown: () => (find('grocery-quantity') as HTMLInputElement).value,
  }
}

test('a quick second step follows the first, though the row is behind', () => {
  const { more } = open()
  more()
  more()
  expect(state.writes.map(({ to, expected }) => [expected, to])).toEqual([
    [pak(1), pak(2)],
    [pak(2), pak(3)],
  ])
})

test('a refused step shows the amount there is, and the next starts from it', async () => {
  const { more, shown } = open()
  more()
  expect(shown()).toBe('2')
  await act(async () => state.writes[0]!.fail())
  await settle()
  expect(shown()).toBe('1')
  more()
  expect(state.writes[1]).toMatchObject({ expected: pak(1), to: pak(2) })
})
