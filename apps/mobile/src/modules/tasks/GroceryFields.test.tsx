// @vitest-environment jsdom
/**
 * The item screen's amount (APP-671): every change names the amount it was
 * made over, so it never writes over another Member's. React Native, the
 * store and the theme are replaced; the component is real.
 */
import { act, createElement, type ReactNode, useState } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'

import { mount, settle } from '../../testing/dom'
import { GroceryFields } from './GroceryFields'
import type { Task } from './types'

const state = vi.hoisted(() => ({
  type: (_text: string) => {},
  writes: [] as { to: unknown; expected: unknown; land: () => void; fail: () => void }[],
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
    TextInput: ({ testID, value, onChangeText }: Props) => {
      state.type = onChangeText as (text: string) => void
      return React.createElement('input', {
        'data-testid': testID as string,
        value: value as string,
        readOnly: true,
      })
    },
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
      new Promise<void>((resolve, reject) => {
        state.writes.push({
          to,
          expected,
          land: resolve,
          fail: () => reject(new Error('changed')),
        })
      }),
  }),
}))

const pak = (quantity: number) => ({ quantity, unit: 'pak' as const })
const melk = { id: 'melk', title: 'Melk', done: false, ...pak(1) } as Task

beforeEach(() => {
  state.writes = []
})

function open() {
  // The harness mounts once; the row under it is told of a change here.
  let show: (task: Task) => void = () => {}
  const Screen = () => {
    const [task, setTask] = useState(melk)
    show = setTask
    return createElement(GroceryFields, { task, writable: true })
  }
  const view = mount(createElement(Screen))
  const find = (id: string) =>
    view.container.querySelector<HTMLElement>(`[data-testid="${id}"]`)!
  return {
    show: (task: Task) => act(() => show(task)),
    unit: (unit: string) => act(() => find(`grocery-unit-${unit}`).click()),
    clear: () => act(() => find('grocery-clear-amount').click()),
    more: () => act(() => find('grocery-increase').click()),
    shown: () => (find('grocery-quantity') as HTMLInputElement).value,
  }
}

test('a quick second step follows the first, though the row is behind', async () => {
  const { more } = open()
  more()
  more()
  expect(state.writes).toHaveLength(1)
  await act(async () => state.writes[0]!.land())
  await settle()
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

test('what followed a refused step is not sent: it could write over the other amount', async () => {
  const { more, clear, shown } = open()
  more()
  clear()
  await act(async () => state.writes[0]!.fail())
  await settle()
  expect(state.writes).toHaveLength(1)
  expect(shown()).toBe('1')
})

test('a step after the first landed still follows the one on its way', async () => {
  const { more, show, shown } = open()
  more()
  more()
  await act(async () => state.writes[0]!.land())
  await settle()
  // The row shows the first, while the second is on its way.
  show({ ...melk, ...pak(2) })
  expect(shown()).toBe('3')
  more()
  await act(async () => state.writes[1]!.land())
  await settle()
  expect(state.writes[2]).toMatchObject({ expected: pak(3), to: pak(4) })
})

test('a step after a new unit keeps that unit', async () => {
  const { more, unit } = open()
  unit('fles')
  more()
  await act(async () => state.writes[0]!.land())
  await settle()
  expect(state.writes[1]).toMatchObject({
    expected: { quantity: 1, unit: 'fles' },
    to: { quantity: 2, unit: 'fles' },
  })
})

test('text typed while a unit is on its way stays', async () => {
  const { unit, shown } = open()
  unit('fles')
  act(() => state.type('5'))
  await act(async () => state.writes[0]!.land())
  await settle()
  expect(shown()).toBe('5')
})

test("another Member's amount replaces text not committed yet", async () => {
  const { show, shown } = open()
  act(() => state.type('5'))
  show({ ...melk, ...pak(3) })
  expect(shown()).toBe('3')
})
