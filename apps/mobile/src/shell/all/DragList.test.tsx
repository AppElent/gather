// @vitest-environment jsdom
/**
 * What `DragList` adds for a screen reader and for rows that arrive while it
 * is open (APP-453). The drag arithmetic is `arrange.test.ts`; the pan is
 * Gesture Handler's. Here the rows are plain elements that expose the props
 * the list gives them.
 */
import { act, createElement, type ReactNode } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'

import { mount } from '../../testing/dom'
import { DragList } from './DragList'

type Row = {
  accessible?: boolean
  accessibilityLabel?: string
  accessibilityActions?: { name: string; label: string }[]
  onAccessibilityAction?: (event: {
    nativeEvent: { actionName: string }
  }) => void
}

const state = vi.hoisted(() => ({
  rows: new Map<string, unknown>(),
  announced: [] as string[],
  saved: 0,
}))

vi.mock('react-native', async () => {
  const React = await import('react')
  type Props = Record<string, unknown> & { children?: ReactNode }
  const dom = (tag: string) => (props: Props) =>
    React.createElement(
      tag,
      { 'data-testid': props.testID as string | undefined },
      props.children,
    )
  const row = ({ children, testID, ...rest }: Props) => {
    state.rows.set(testID as string, rest)
    return React.createElement('div', { 'data-testid': testID }, children)
  }
  return {
    View: dom('div'),
    Text: dom('span'),
    Animated: { View: row, Value: class { setValue() {} } },
    AccessibilityInfo: {
      announceForAccessibility: (text: string) => state.announced.push(text),
    },
    StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  }
})
vi.mock('react-native-gesture-handler', () => {
  const pan: Record<string, unknown> = {}
  for (const name of [
    'runOnJS',
    'blocksExternalGesture',
    'onBegin',
    'onUpdate',
    'onFinalize',
  ])
    pan[name] = () => pan
  return {
    Gesture: { Pan: () => pan },
    GestureDetector: ({ children }: { children: ReactNode }) => children,
  }
})
vi.mock('../../feedback/haptics', () => ({
  haptics: {
    selectionChanged: () => {},
    itemSaved: () => {
      state.saved += 1
    },
  },
}))
vi.mock('../../theme/icons', () => ({
  UI_ICONS: new Proxy({}, { get: () => () => null }),
}))
vi.mock('../../theme/tokens', () => ({
  SIZE: { rowMin: 44 },
  SPACE: [0, 4, 8],
  RADIUS: { card: 12 },
  TYPE: {},
  useTokens: () => ({}),
}))
vi.mock('../../ui/module-tile', () => ({ ModuleTile: () => null }))

const items = (...ids: string[]) =>
  ids.map((id) => ({ id, label: `Card ${id}`, detail: id === 'a' ? 'Nora' : undefined }))

const rowOf = (id: string) => state.rows.get(`row-edit-${id}`) as Row
const run = (id: string, actionName: 'moveUp' | 'moveDown') =>
  act(() => rowOf(id).onAccessibilityAction?.({ nativeEvent: { actionName } }))
/** The row ids in the order they are drawn. */
const order = () =>
  [...document.querySelectorAll('[data-testid^="row-edit-"]')].map((node) =>
    node.getAttribute('data-testid')?.replace('row-edit-', ''),
  )

const props = {
  scrollRef: { current: null },
  onDragging: () => {},
  dragLabel: (label: string) => `Reorder ${label}`,
}
const moveActions = {
  up: 'Move up',
  down: 'Move down',
  moved: (label: string, position: number, total: number) =>
    `${label} to ${position}/${total}`,
}

beforeEach(() => {
  state.rows.clear()
  state.announced = []
  state.saved = 0
})

test('a row added while the list is open lands where the caller says', () => {
  const view = mount(
    createElement(DragList, {
      ...props,
      items: items('a', 'b'),
      onCommit: () => {},
      rowTestID: 'row',
      arrivals: 'first',
    }),
  )
  view.rerender(
    createElement(DragList, {
      ...props,
      items: items('n', 'a', 'b'),
      onCommit: () => {},
      rowTestID: 'row',
      arrivals: 'first',
    }),
  )
  expect(order()).toEqual(['n', 'a', 'b'])

  view.unmount()
})

test('by default a row added while the list is open goes last', () => {
  const view = mount(
    createElement(DragList, {
      ...props,
      items: items('a', 'b'),
      onCommit: () => {},
      rowTestID: 'row',
    }),
  )
  view.rerender(
    createElement(DragList, {
      ...props,
      items: items('n', 'a', 'b'),
      onCommit: () => {},
      rowTestID: 'row',
    }),
  )
  expect(order()).toEqual(['a', 'b', 'n'])
  view.unmount()
})

test('without move actions a row is not one stop for a screen reader', () => {
  const view = mount(
    createElement(DragList, {
      ...props,
      items: items('a', 'b'),
      onCommit: () => {},
      rowTestID: 'row',
    }),
  )
  expect(rowOf('a').accessible).toBeUndefined()
  expect(rowOf('a').accessibilityActions).toBeUndefined()
  view.unmount()
})

test('Move up and Move down save the same whole order a drop does, and say where the row went', () => {
  const saved: string[][] = []
  const view = mount(
    createElement(DragList, {
      ...props,
      items: items('a', 'b', 'c'),
      onCommit: (ids: string[]) => saved.push(ids),
      rowTestID: 'row',
      moveActions,
    }),
  )
  // The first row cannot go up, the last cannot go down.
  expect(rowOf('a').accessibilityActions).toEqual([
    { name: 'moveDown', label: 'Move down' },
  ])
  expect(rowOf('b').accessibilityActions?.map((action) => action.name)).toEqual(
    ['moveUp', 'moveDown'],
  )
  expect(rowOf('c').accessibilityActions).toEqual([
    { name: 'moveUp', label: 'Move up' },
  ])
  expect(rowOf('a').accessible).toBe(true)
  expect(rowOf('a').accessibilityLabel).toBe('Card a, Nora')
  expect(rowOf('b').accessibilityLabel).toBe('Card b')

  run('c', 'moveUp')
  expect(saved).toEqual([['a', 'c', 'b']])
  expect(state.announced).toEqual(['Card c to 2/3'])
  expect(state.saved).toBe(1)
  expect(order()).toEqual(['a', 'c', 'b'])

  run('a', 'moveDown')
  expect(saved[1]).toEqual(['c', 'a', 'b'])
  expect(state.announced[1]).toBe('Card a to 2/3')

  // Past an end does nothing: no save, nothing said.
  run('c', 'moveUp')
  expect(saved).toHaveLength(2)
  run('b', 'moveDown')
  expect(saved).toHaveLength(2)
  view.unmount()
})
