// @vitest-environment jsdom
/**
 * Reorder mode on a grocery list (APP-522): the column is every aisle's
 * heading with its items, and dragging an item's grip past a heading commits
 * it under that aisle. The gesture library is replaced by one whose pan the
 * test drives by hand; rows have not laid out in jsdom, so each counts as the
 * shortest a row can be (`SIZE.rowMin`, 52 here).
 */
import { act, type ReactNode } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'

import { mount } from '../../testing/dom'
import { aisleArrangement } from './groceryList'
import { ReorderMode } from './ReorderMode'

interface Pan {
  begin: () => void
  update: (event: { translationY: number }) => void
  finalize: () => void
}

const grips = vi.hoisted(() => new Map<string, Pan>())

vi.mock('react-native', async () => {
  const React = await import('react')
  const h = React.createElement
  type Props = Record<string, unknown> & { children?: ReactNode }
  const dom =
    (tag: string) =>
    ({ children, testID, accessibilityLabel }: Props) =>
      h(
        tag,
        {
          'data-testid': testID as string | undefined,
          'aria-label': accessibilityLabel as string | undefined,
        },
        children,
      )
  class Value {
    setValue() {}
  }
  return {
    View: dom('div'),
    Text: dom('span'),
    Animated: { View: dom('div'), Value },
    StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  }
})
vi.mock('react-native-gesture-handler', () => {
  const Pan = () => {
    const pan: Pan = { begin: () => {}, update: () => {}, finalize: () => {} }
    const builder = {
      pan,
      runOnJS: () => builder,
      blocksExternalGesture: () => builder,
      onBegin: (fn: Pan['begin']) => {
        pan.begin = fn
        return builder
      },
      onUpdate: (fn: Pan['update']) => {
        pan.update = fn
        return builder
      },
      onFinalize: (fn: Pan['finalize']) => {
        pan.finalize = fn
        return builder
      },
    }
    return builder
  }
  return {
    Gesture: { Pan },
    GestureDetector: ({
      gesture,
      children,
    }: {
      gesture: { pan: Pan }
      children: { props: { accessibilityLabel: string } }
    }) => {
      grips.set(children.props.accessibilityLabel, gesture.pan)
      return children as unknown as ReactNode
    },
  }
})
vi.mock('../../feedback/haptics', () => ({
  haptics: { selectionChanged: () => {}, itemSaved: () => {} },
}))
vi.mock('../../i18n', async () => {
  const { en } = await import('../../i18n/messages/en')
  return { useI18n: () => ({ t: en, locale: 'en' }) }
})
vi.mock('../../theme/icons', () => ({
  UI_ICONS: new Proxy({}, { get: () => () => null }),
}))
vi.mock('../../theme/tokens', () => ({
  RADIUS: { card: 12 },
  SIZE: { rowMin: 52 },
  SPACE: [0, 4, 8, 12, 16],
  TYPE: {},
  useTokens: () => ({}),
}))
vi.mock('../../ui/card', () => ({
  Card: ({ children }: { children: ReactNode }) => children,
}))
vi.mock('./components', () => ({ priorityColor: () => undefined }))

const display = { due: false, priority: false, labels: false }
const task = (id: string, title: string, category?: string) => ({
  id,
  title,
  category,
  done: false,
  labels: [],
  order: 0,
})

beforeEach(() => grips.clear())

test('an item dragged under the next aisle commits in that aisle', () => {
  const tasks = [task('a', 'Appels', 'produce'), task('c', 'Cola', 'drinks')]
  const commits: unknown[][] = []
  const aisles = ['produce', 'bakery', 'drinks'] as const
  const view = mount(
    <ReorderMode
      tasks={tasks as never}
      sections={aisles.map((aisle) => ({ id: aisle, name: aisle }))}
      arrangement={aisleArrangement(tasks, aisles)}
      hint="Drag an item under another aisle"
      display={display}
      today="2026-11-21"
      scrollRef={{ current: null }}
      onDragging={() => {}}
      onCommit={(...args) => commits.push(args)}
    />,
  )

  // Every aisle has its heading, Bakery too although it is empty.
  for (const aisle of aisles) {
    expect(
      view.container.querySelector(`[data-testid="reorder-heading-${aisle}"]`),
    ).not.toBeNull()
  }
  expect(view.container.textContent).toContain('Drag an item under another aisle')

  // Appels, one row down: past the Bakery heading, so into Bakery.
  const appels = grips.get('Appels') as Pan
  act(() => appels.begin())
  act(() => appels.update({ translationY: 52 }))
  act(() => appels.finalize())
  expect(commits).toEqual([
    [['a', 'c'], ['bakery', 'drinks'], { id: 'a', sectionId: 'bakery' }],
  ])

  view.unmount()
})

test('nothing lands above the first aisle, and a tap commits nothing', () => {
  const tasks = [task('a', 'Appels', 'produce'), task('p', 'Peren', 'produce')]
  const commits: unknown[] = []
  const view = mount(
    <ReorderMode
      tasks={tasks as never}
      sections={[{ id: 'produce', name: 'Produce' }]}
      arrangement={aisleArrangement(tasks, ['produce'])}
      display={display}
      today="2026-11-21"
      scrollRef={{ current: null }}
      onDragging={() => {}}
      onCommit={(...args) => commits.push(args)}
    />,
  )

  const appels = grips.get('Appels') as Pan
  act(() => appels.begin())
  act(() => appels.finalize())
  expect(commits).toEqual([])

  // Peren, dragged far up: it stops under Produce's heading, still in Produce.
  const peren = grips.get('Peren') as Pan
  act(() => peren.begin())
  act(() => peren.update({ translationY: -500 }))
  act(() => peren.finalize())
  // Rearranged within its aisle: no aisle change goes with it.
  expect(commits).toEqual([[['p', 'a'], ['produce', 'produce'], undefined]])

  view.unmount()
})
