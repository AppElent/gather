// @vitest-environment jsdom
/**
 * The grocery composer's aisle chip (APP-524): it shows the aisle the list
 * would give the typed line, opens the aisle menu, and an aisle chosen there
 * goes with that line only. React Native and the native menu are replaced by
 * plain elements; the store is a spy.
 */
import { en } from '@gather/core/messages'
import { act, createElement, type ReactNode } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'

import { mount } from '../../testing/dom'

const state = vi.hoisted(() => ({
  added: [] as unknown[][],
  moved: [] as unknown[][],
  parsed: [] as unknown[][],
  moveFails: false,
  server: new Map<string, string>(),
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

// The native menu as a row of buttons, one per action.
vi.mock('../../observability/native-presentation', () => ({
  showAlert: vi.fn(),
  showPrompt: vi.fn(),
}))
vi.mock('@expo/ui/community/menu', async () => {
  const React = await import('react')
  const h = React.createElement
  return {
    MenuView: ({
      testID,
      actions,
      onPressAction,
      children,
    }: {
      testID: string
      actions: { id: string; title: string; state: string }[]
      onPressAction: (event: { nativeEvent: { event: string } }) => void
      children: ReactNode
    }) =>
      h(
        'div',
        { 'data-testid': testID },
        children,
        actions.map((action) =>
          h(
            'button',
            {
              key: action.id,
              'data-testid': `${testID}-${action.id}`,
              'data-state': action.state,
              onClick: () => onPressAction({ nativeEvent: { event: action.id } }),
            },
            action.title,
          ),
        ),
      ),
  }
})

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
vi.mock('./GrocerySuggestions', () => ({ GroceryCompletions: () => null }))
vi.mock('./icons', () => ({ TASK_ICONS: {} }))
vi.mock('./taskMenu', () => ({ taskMenuActions: vi.fn() }))
vi.mock('./store', () => ({
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
      return state.moveFails
        ? Promise.reject(new Error('refused'))
        : Promise.resolve()
    },
  }),
}))
// What the list itself answers for a line (`groceryLines.aisles`).
vi.mock('../kitchen/add-to-groceries/use-aisles', () => ({
  useAisleOf: () => (title: string) => state.server.get(title) ?? 'other',
}))

import { haptics } from '../../feedback/haptics'
import { type KeptGroceryLine, TaskComposer } from './TaskRow'

beforeEach(() => {
  state.added = []
  state.moved = []
  state.parsed = []
  state.moveFails = false
  vi.mocked(haptics.itemSaved).mockClear()
  vi.mocked(haptics.actionFailed).mockClear()
  state.server = new Map([['kaas', 'dairy']])
})

function render({
  grocery = true,
  keep,
}: { grocery?: boolean; keep?: { current: KeptGroceryLine | undefined } } = {}) {
  const view = mount(
    createElement(TaskComposer, {
      listId: 'groceries',
      placeholder: 'Add an item…',
      grocery,
      keep,
    }),
  )
  const input = () =>
    view.container.querySelector<HTMLInputElement>('[data-testid="task-composer"]')!
  const chip = () =>
    view.container.querySelector<HTMLElement>(
      '[data-testid="grocery-preview-aisle"] > div',
    )
  const type = (text: string) =>
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )!.set!
      setter.call(input(), text)
      input().dispatchEvent(new Event('input', { bubbles: true }))
    })
  const choose = (aisle: string) =>
    act(() => {
      view.container
        .querySelector<HTMLElement>(`[data-testid="grocery-preview-aisle-${aisle}"]`)!
        .click()
    })
  const submit = () =>
    act(() => {
      input().dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      )
    })
  const hint = () =>
    [...view.container.querySelectorAll('[data-testid="grocery-preview"] > span')]
      .map((node) => node.textContent)
      .find((text) => text?.includes('filled in'))
  return { view, chip, type, choose, submit, hint }
}

test('the aisle the list would give the line shows before it is added', () => {
  const { chip, type } = render()
  expect(chip()).toBeNull()
  type('kaas')
  expect(chip()?.getAttribute('aria-label')).toBe('Aisle, Dairy and eggs')
  // A name nothing knows shows where it would go: Other.
  type('zeldzame zwam')
  expect(chip()?.getAttribute('aria-label')).toBe('Aisle, Other')
})

test('an aisle chosen in the menu is the one the line is added in', async () => {
  const { chip, type, choose, submit } = render()
  type('kaas')
  choose('bakery')
  expect(chip()?.getAttribute('aria-label')).toBe('Aisle, Bread and bakery')
  await submit()
  // Added as always, then moved the way the item screen moves it.
  expect(state.added).toEqual([['groceries', 'kaas', true, undefined]])
  expect(state.moved).toEqual([['task', 'bakery']])
})

test('untouched, the line is only added and the server decides', async () => {
  const { type, submit } = render()
  type('kaas')
  await submit()
  expect(state.added).toEqual([['groceries', 'kaas', true, undefined]])
  expect(state.moved).toEqual([])
})

test('choosing the aisle already shown is a choice too', async () => {
  const { type, choose, submit } = render()
  type('zeldzame zwam')
  choose('other')
  await submit()
  expect(state.moved).toEqual([['task', 'other']])
})

test('a choice goes with its line only', async () => {
  const { chip, type, choose, submit } = render()
  type('kaas')
  choose('bakery')
  await submit()
  // The next line starts fresh.
  type('kaas')
  expect(chip()?.getAttribute('aria-label')).toBe('Aisle, Dairy and eggs')
  // A line typed differently after choosing has not been given that aisle.
  choose('frozen')
  type('melk')
  expect(chip()?.getAttribute('aria-label')).toBe('Aisle, Other')
  await submit()
  expect(state.moved).toEqual([['task', 'bakery']])
})

// APP-536: the follow-ups from the APP-524 review.

test('the hint speaks only for what was filled in from the line', () => {
  state.server.set('2 kaas', 'dairy')
  const { type, choose, hint } = render()
  type('2 kaas')
  expect(hint()).toBe(en.tasks.grocery.recognised)
  // The aisle is now the Member's own: only the amount was read.
  choose('bakery')
  expect(hint()).toBe(en.tasks.grocery.recognisedAmount)
  // An amount and a name nothing knows: the aisle was not filled in either.
  type('2 zeldzame zwam')
  expect(hint()).toBe(en.tasks.grocery.recognisedAmount)
  type('kaas')
  expect(hint()).toBe(en.tasks.grocery.recognisedAisle)
  type('zeldzame zwam')
  expect(hint()).toBeUndefined()
})

test('if only the aisle move fails, the item is still added', async () => {
  state.moveFails = true
  const { type, choose, submit } = render()
  type('kaas')
  choose('bakery')
  await submit()
  await act(async () => {})
  expect(state.added).toEqual([['groceries', 'kaas', true, undefined]])
  expect(state.moved).toEqual([['task', 'bakery']])
  expect(haptics.itemSaved).toHaveBeenCalledTimes(1)
  expect(haptics.actionFailed).toHaveBeenCalledTimes(1)
})

test('a list of tasks has no aisle chip and never moves what it adds', async () => {
  const { chip, type, submit } = render({ grocery: false })
  type('kaas')
  expect(chip()).toBeNull()
  await submit()
  await act(async () => {})
  expect(state.parsed).toHaveLength(1)
  expect(state.added).toEqual([])
  expect(state.moved).toEqual([])
})

test('a half-typed line and its chosen aisle come back after the composer was away', async () => {
  const keep = { current: undefined as KeptGroceryLine | undefined }
  const first = render({ keep })
  first.type('kaas')
  first.choose('bakery')
  // Reorder mode takes the composer away and brings it back.
  first.view.unmount()
  const again = render({ keep })
  expect(
    again.view.container.querySelector<HTMLInputElement>(
      '[data-testid="task-composer"]',
    )?.value,
  ).toBe('kaas')
  expect(again.chip()?.getAttribute('aria-label')).toBe('Aisle, Bread and bakery')
  await again.submit()
  expect(state.moved).toEqual([['task', 'bakery']])
  // Once added, nothing is kept for the next time.
  expect(keep.current).toEqual({ line: '' })
})
