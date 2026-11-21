// @vitest-environment jsdom
/**
 * A grocery list's screen in Reorder mode (APP-522, APP-534): a drop saves
 * the order and the dragged item's new aisle, and a drop the server refuses
 * puts the column back to the list as Convex has it, with a short line.
 *
 * The screen is real down to `ReorderMode`; React Native, the gesture
 * library, navigation and the store are replaced, and the rows the screen
 * draws outside Reorder mode are stubs. The grips are driven by hand as in
 * `ReorderMode.test.tsx`: rows have not laid out, so each is 52 tall.
 */
import { act, type ReactNode } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'

import { mount, settle } from '../../testing/dom'
import { TaskList } from './TaskListScreen'

interface Pan {
  begin: () => void
  update: (event: { translationY: number }) => void
  finalize: () => void
}

const state = vi.hoisted(() => ({
  grips: new Map<string, Pan>(),
  tasks: [] as Record<string, unknown>[],
  reorders: [] as unknown[][],
  aisles: [] as unknown[][],
  refuse: false,
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
  class Value {
    setValue() {}
  }
  return {
    View: dom('div'),
    Text: dom('span'),
    Pressable: dom('button'),
    RefreshControl: () => null,
    Animated: { View: dom('div'), Value },
    StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  }
})
vi.mock('react-native-gesture-handler', async () => {
  const React = await import('react')
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
      state.grips.set(children.props.accessibilityLabel, gesture.pan)
      return children as unknown as ReactNode
    },
    LegacyScrollView: ({ children }: { children: ReactNode }) =>
      React.createElement('div', null, children),
  }
})
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))
vi.mock('expo-router', () => ({
  // The header's Done and ⋯ are drawn in place, so the test can press them.
  Stack: {
    Screen: ({ options }: { options: { headerRight: () => ReactNode } }) =>
      options.headerRight(),
  },
  useRouter: () => ({ push: () => {}, back: () => {} }),
}))
vi.mock('expo-router/react-navigation', () => ({
  useHeaderHeight: () => 100,
}))
vi.mock('@expo/ui/community/menu', async () => {
  const React = await import('react')
  return {
    MenuView: ({
      actions,
      onPressAction,
    }: {
      actions: { id: string }[]
      onPressAction: (event: { nativeEvent: { event: string } }) => void
    }) =>
      React.createElement(
        'div',
        null,
        actions.map((action) =>
          React.createElement('button', {
            key: action.id,
            'data-testid': `menu-${action.id}`,
            onClick: () => onPressAction({ nativeEvent: { event: action.id } }),
          }),
        ),
      ),
  }
})
vi.mock('../../feedback/haptics', () => ({
  haptics: new Proxy({}, { get: () => () => {} }),
}))
vi.mock('../../feedback/confirmDestructive', () => ({
  confirmDestructive: () => {},
}))
vi.mock('../../group/GroupProvider', () => ({
  useGroup: () => ({ group: { name: 'Thuis', slug: 'thuis' } }),
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
  RADIUS: { card: 12 },
  SIZE: { rowMin: 52 },
  SPACE: [0, 4, 8, 12, 16],
  TYPE: {},
  useTokens: () => ({}),
}))
const { stub } = vi.hoisted(() => ({ stub: () => null }))
vi.mock('../../ui/card', () => ({
  Card: ({ children }: { children: ReactNode }) => children,
}))
vi.mock('../../ui/completed-section', () => ({ CompletedSection: stub }))
vi.mock('../../ui/inset-list', () => ({ InsetList: stub }))
vi.mock('../../ui/module-tile', () => ({ moduleTile: () => null }))
vi.mock('../../ui/screen-header', () => ({ washScreenOptions: () => ({}) }))
vi.mock('../../ui/undo-toast', () => ({ useUndoToast: () => ({ show: stub }) }))
vi.mock('../../ui/wash-header', () => ({ WashHeader: stub }))
vi.mock('./components', () => ({ Chip: stub, priorityColor: () => undefined }))
vi.mock('./GroceryFields', () => ({
  GroceryAmount: stub,
  useGroceryAmountText: () => () => '',
}))
vi.mock('./GroceryListBody', () => ({ GroceryListBody: stub }))
vi.mock('./icons', () => ({
  TASK_ICONS: new Proxy({}, { get: () => stub }),
  TASK_LIST_GLYPHS: {},
}))
vi.mock('./listFace', () => ({ AppearanceSheet: stub }))
vi.mock('./packing', () => ({ PackingProgress: stub, UncheckAll: stub }))
vi.mock('./sections', () => ({ SectionHeading: stub, SectionsSheet: stub }))
vi.mock('./sheets', () => ({ RenameSheet: stub }))
vi.mock('./TaskRow', () => ({ TaskComposer: stub, TaskRow: stub }))
vi.mock('./taskMenu', () => ({
  useTaskSheets: () => ({ onAction: () => {}, sheets: null }),
}))
vi.mock('./store', () => ({
  taskSections: <T extends { done: boolean }>(tasks: readonly T[]) => ({
    active: tasks.filter((task) => !task.done),
    completed: tasks.filter((task) => task.done),
  }),
  useTaskList: () => ({
    list: {
      id: 'groceries',
      name: 'Groceries',
      provider: 'local',
      writable: true,
      display: { due: false, priority: false, labels: false },
      order: 0,
      sync: 'live',
      kind: 'plain',
      icon: 'cart',
      color: 'green',
      grocery: true,
      checkedClearedAt: null,
      aisleOrder: ['produce', 'bakery', 'drinks'],
      suggestionsOff: false,
      sections: [],
    },
    tasks: state.tasks,
    today: '2026-11-21',
    refresh: async () => 'synced',
  }),
  useTaskActions: () => ({
    reorderTasks: (...args: unknown[]) => {
      state.reorders.push(args)
      return state.refuse
        ? Promise.reject(new Error('Reorder must contain every open task'))
        : Promise.resolve()
    },
    setAisle: (...args: unknown[]) => {
      state.aisles.push(args)
      return Promise.resolve()
    },
  }),
}))

const item = (id: string, title: string, category: string, order: number) => ({
  id,
  listId: 'groceries',
  title,
  category,
  done: false,
  labels: [],
  order,
})

beforeEach(() => {
  state.grips.clear()
  state.tasks = [item('a', 'Appels', 'produce', 0), item('c', 'Cola', 'drinks', 1)]
  state.reorders = []
  state.aisles = []
  state.refuse = false
})

const openReorder = () => {
  const view = mount(<TaskList listId="groceries" moduleId="groceries" />)
  const menu = view.container.querySelector('[data-testid="menu-reorder"]')
  act(() => (menu as HTMLButtonElement).click())
  return view
}

const drag = (title: string, dy: number) => {
  const grip = state.grips.get(title) as Pan
  act(() => grip.begin())
  act(() => grip.update({ translationY: dy }))
  act(() => grip.finalize())
}

test('a grocery drop saves the order and the dragged item’s new aisle', async () => {
  const view = openReorder()
  expect(view.container.querySelector('[data-testid="reorder-done"]')).not.toBeNull()

  // Appels, one row down: past the Bakery heading, so into Bakery.
  drag('Appels', 52)
  await settle()

  expect(state.reorders).toEqual([['groceries', ['a', 'c']]])
  expect(state.aisles).toEqual([['a', 'bakery']])
  expect(view.container.querySelector('[data-testid="reorder-problem"]')).toBeNull()

  view.unmount()
})

test('a refused drop puts back the list as saved, newer items included, and says so', async () => {
  const view = openReorder()
  // Another Member adds Brood while Reorder mode is open: this phone's
  // column does not have it, so the server refuses its next drop.
  state.tasks = [...state.tasks, item('b', 'Brood', 'bakery', 2)]
  state.refuse = true
  view.rerender(<TaskList listId="groceries" moduleId="groceries" />)
  expect(view.container.querySelector('[aria-label="Brood"]')).toBeNull()

  drag('Cola', -52)
  await settle()

  const problem = view.container.querySelector('[data-testid="reorder-problem"]')
  expect(problem?.textContent).toBe("That move didn't save. This is the list as it is now.")
  // The column is the server's again: Brood is in it, and the next drop
  // sends every open item.
  expect(view.container.querySelector('[aria-label="Brood"]')).not.toBeNull()

  state.refuse = false
  drag('Appels', 52)
  await settle()
  expect(state.reorders.at(-1)?.[1]).toEqual(['a', 'b', 'c'])
  expect(view.container.querySelector('[data-testid="reorder-problem"]')).toBeNull()

  view.unmount()
})
