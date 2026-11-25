// @vitest-environment jsdom
/**
 * The inline row that adds a task. A grocery list adds from its own composer
 * (`GroceryComposer.test.tsx`). React Native is replaced by plain elements;
 * the store is a spy.
 */
import { en } from '@gather/core/messages'
import { act, createElement, type ReactNode } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'

import { mount } from '../../testing/dom'

const state = vi.hoisted(() => ({
  added: [] as unknown[][],
  moved: [] as unknown[][],
  parsed: [] as unknown[][],
}))

vi.mock('react-native', async () => {
  const React = await import('react')
  const h = React.createElement
  type Props = Record<string, unknown> & { children?: ReactNode }
  const View = React.forwardRef<HTMLDivElement, Props>(
    ({ children, testID, accessibilityLabel }, ref) =>
      h(
        'div',
        {
          ref,
          'data-testid': testID as string | undefined,
          'aria-label': accessibilityLabel as string | undefined,
        },
        children as ReactNode,
      ),
  )
  const Text = ({ children }: Props) => h('span', null, children)
  // The quick-add field carries its line as styled children, not `value`.
  const textOf = (node: unknown): string =>
    typeof node === 'string'
      ? node
      : Array.isArray(node)
        ? node.map(textOf).join('')
        : React.isValidElement<{ children?: unknown }>(node)
          ? textOf(node.props.children)
          : ''
  const TextInput = ({
    testID,
    value,
    children,
    onChangeText,
    onSubmitEditing,
  }: Props) =>
    h('input', {
      'data-testid': testID as string,
      value: (value as string | undefined) ?? textOf(children),
      onChange: (event: { target: { value: string } }) =>
        (onChangeText as (text: string) => void)(event.target.value),
      onKeyDown: (event: { key: string }) => {
        if (event.key === 'Enter') (onSubmitEditing as () => void)()
      },
    })
  return {
    View,
    Text,
    TextInput,
    Pressable: View,
    Keyboard: { metrics: () => undefined },
    Platform: { OS: 'ios', select: (o: Record<string, unknown>) => o.ios },
    StyleSheet: { create: <T,>(s: T) => s, hairlineWidth: 1 },
  }
})

vi.mock('../../observability/native-presentation', () => ({
  showAlert: vi.fn(),
  usePrompt: () => vi.fn(),
}))
vi.mock('react-native-gesture-handler/ReanimatedSwipeable', () => ({
  default: () => null,
  SwipeDirection: {},
}))
vi.mock('../../components/NativeContextMenu', () => ({
  NativeContextMenu: () => null,
}))
vi.mock('../../feedback/haptics', () => ({
  haptics: {
    itemSaved: vi.fn(),
    actionFailed: vi.fn(),
    selectionChanged: vi.fn(),
  },
}))
vi.mock('../../i18n', () => ({
  useI18n: () => ({ t: { tasks: en.tasks }, locale: 'en' }),
  fmt: (s: string) => s,
}))
vi.mock('../../theme/icons', () => ({
  UI_ICONS: new Proxy({}, { get: () => () => null }),
}))
vi.mock('../../theme/tokens', () => ({
  SIZE: {},
  SPACE: [0, 4, 8, 12, 16, 20, 24],
  TYPE: {},
  TABULAR: {},
  useTokens: () => ({
    tintOf: () => ({ wash: 'wash', text: 'text' }),
  }),
}))
vi.mock('../../ui/inset-list', () => ({ useInsetSeparator: () => ({}) }))
vi.mock('../../ui/card', () => ({ Card: () => null }))
vi.mock('../../group/GroupProvider', () => ({
  useGroup: () => ({ group: { slug: 'our-household' } }),
}))
vi.mock('./assignee', () => ({ AssigneeCoin: () => null, useTaskPeople: () => ({ people: [] }) }))
vi.mock('./completeTask', () => ({ useCompleteTask: vi.fn() }))
vi.mock('./components', () => ({ Checkbox: () => null }))
vi.mock('./icons', () => ({ TASK_ICONS: {} }))
vi.mock('./taskMenu', () => ({ taskMenuActions: vi.fn() }))
vi.mock('./store', () => ({
  LinkedWriteError: class extends Error {},
  useTaskLists: () => [],
  useTaskActions: () => ({
    addTask: (...args: unknown[]) => {
      state.added.push(args)
      return Promise.resolve('task')
    },
    addParsedTask: (...args: unknown[]) => {
      state.parsed.push(args)
      return Promise.resolve({ taskId: 'task', reminderFailed: false })
    },
    setAisle: (...args: unknown[]) => {
      state.moved.push(args)
      return Promise.resolve()
    },
  }),
}))

import { haptics } from '../../feedback/haptics'
import { TaskComposer } from './TaskRow'

beforeEach(() => {
  state.added = []
  state.moved = []
  state.parsed = []
  vi.mocked(haptics.itemSaved).mockClear()
  vi.mocked(haptics.actionFailed).mockClear()
})

function render() {
  const view = mount(
    createElement(TaskComposer, {
      listId: 'groceries',
      placeholder: 'Add a task…',
    }),
  )
  const input = () =>
    view.container.querySelector<HTMLInputElement>('[data-testid="task-composer"]')!
  const type = (text: string) =>
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )!.set!
      setter.call(input(), text)
      input().dispatchEvent(new Event('input', { bubbles: true }))
    })
  const submit = () =>
    act(() => {
      input().dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      )
    })
  return { type, submit }
}

test('a list of tasks reads the line and never moves what it adds', async () => {
  const { type, submit } = render()
  type('kaas')
  await submit()
  await act(async () => {})
  expect(state.parsed).toHaveLength(1)
  expect(state.added).toEqual([])
  expect(state.moved).toEqual([])
})
