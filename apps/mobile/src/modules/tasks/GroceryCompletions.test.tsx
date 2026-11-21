// @vitest-environment jsdom
/**
 * The composer's completions (APP-311, APP-427): a name already open on the
 * list is never added beside it. A typed amount that adds up is added to the
 * open item and shown as `+2 pak`; anything else leaves the item as it is.
 * React Native, the store and the theme are replaced; the component is real.
 */
import type { GroceryHabit } from '@gather/core/groceries'
import { act, type ReactNode } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'

import { mount, settle } from '../../testing/dom'
import { GroceryCompletions } from './GrocerySuggestions'
import type { Task } from './types'

const state = vi.hoisted(() => ({
  habits: [] as GroceryHabit[],
  added: [] as unknown[],
  amounts: [] as unknown[][],
}))

vi.mock('react-native', async () => {
  const React = await import('react')
  const h = React.createElement
  type Props = Record<string, unknown> & { children?: ReactNode }
  const dom =
    (tag: string) =>
    ({ children, testID, accessibilityLabel, onPress }: Props) =>
      h(
        tag,
        {
          'data-testid': testID as string | undefined,
          'aria-label': accessibilityLabel as string | undefined,
          onClick: onPress as (() => void) | undefined,
        },
        children,
      )
  return {
    View: dom('div'),
    Text: dom('span'),
    Pressable: dom('button'),
    ScrollView: dom('div'),
    StyleSheet: { create: <T,>(styles: T) => styles },
  }
})
vi.mock('../../components/NativeContextMenu', () => ({
  NativeContextMenu: ({ children }: { children: ReactNode }) => children,
}))
vi.mock('../../feedback/haptics', () => ({
  haptics: new Proxy({}, { get: () => () => {} }),
}))
vi.mock('../../i18n', async () => {
  const { en } = await import('../../i18n/messages/en')
  return {
    useI18n: () => ({ t: en, locale: 'en' }),
    fmt: (text: string) => text,
    plural: () => '',
  }
})
vi.mock('../../theme/icons', () => ({
  UI_ICONS: new Proxy({}, { get: () => () => null }),
}))
vi.mock('../../theme/tokens', () => ({
  RADIUS: {},
  SIZE: {},
  SPACE: [0, 4, 8, 12, 16],
  TABULAR: {},
  TYPE: { bodyStrong: { fontWeight: '600' } },
  useTokens: () => ({}),
}))
vi.mock('./GroceryFields', async () => {
  const { formatGroceryAmount } = await import('@gather/core/groceries')
  const { en } = await import('../../i18n/messages/en')
  return {
    useGroceryAmountText:
      () => (quantity: number | undefined, unit: Task['unit']) =>
        formatGroceryAmount(quantity, unit, 'en', en.tasks.grocery.units),
  }
})
vi.mock('./store', () => ({
  useGroceryHabits: () => ({ habits: state.habits, suggestions: [] }),
  useTaskActions: () => ({
    addGrocery: async (_listId: string, item: unknown) => {
      state.added.push(item)
    },
    setAmount: async (...args: unknown[]) => {
      state.amounts.push(args)
    },
  }),
}))

const melk: GroceryHabit = {
  key: 'melk',
  title: 'melk',
  count: 4,
  intervalDays: 4,
  lastAt: 0,
  quantity: 1,
  unit: 'pak',
}

const openMelk: Task = {
  id: 'open-melk',
  listId: 'list',
  title: 'Melk',
  done: false,
  labels: [],
  quantity: 1,
  unit: 'pak',
}

beforeEach(() => {
  state.habits = [melk]
  state.added = []
  state.amounts = []
})

async function pick(line: string, tasks: Task[]) {
  const view = mount(
    <GroceryCompletions
      listId="list"
      line={line}
      tasks={tasks}
      onPicked={() => {}}
    />,
  )
  await settle()
  const row = view.container.querySelector(
    '[data-testid="completion-melk"]',
  ) as HTMLElement
  const text = row.textContent
  await act(async () => row.click())
  await settle()
  return text
}

test('a name not on the list is added with the typed amount', async () => {
  await pick('2 pak me', [])
  expect(state.added).toEqual([{ title: 'melk', quantity: 2, unit: 'pak' }])
  expect(state.amounts).toEqual([])
})

test('a typed amount that adds up goes onto the open item, shown as +2 packs', async () => {
  const text = await pick('2 pak me', [openMelk])
  expect(text).toContain('+2 packs')
  expect(state.added).toEqual([])
  expect(state.amounts).toEqual([['open-melk', 3, 'pak']])
})

test('without a typed amount the open item stays as it is', async () => {
  await pick('me', [openMelk])
  expect(state.added).toEqual([])
  expect(state.amounts).toEqual([])
})

test('the typed part of the name is its own text, for the 600 weight', async () => {
  const view = mount(
    <GroceryCompletions listId="list" line="me" tasks={[]} onPicked={() => {}} />,
  )
  await settle()
  const row = view.container.querySelector('[data-testid="completion-melk"]')
  const spans = [...(row?.querySelectorAll('span span') ?? [])].map(
    (span) => span.textContent,
  )
  expect(spans).toContain('me')
})
