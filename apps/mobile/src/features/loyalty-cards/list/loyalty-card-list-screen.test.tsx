// @vitest-environment jsdom
/**
 * Reorder mode on the card list (APP-440): entered from the ⋯ menu or a row's
 * hold menu, it swaps the filter and the rows for the shared drag list, saves
 * every drop as the whole order, and puts the old order back when the save is
 * refused. The drag itself is `DragList`'s, and its arithmetic is
 * `arrange.test.ts`; here the list is replaced by one that drops on a click.
 */
import { createElement, type ReactNode } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'

import { mount, settle } from '../../../testing/dom'
import { LoyaltyCardListScreen } from './loyalty-card-list-screen'

interface Item {
  id: string
  label: string
  detail?: string
}

const state = vi.hoisted(() => ({
  cards: [] as { _id: string; storeName: string; holder?: string }[],
  options: {} as Record<string, unknown>,
  reorders: [] as unknown[],
  refuse: false,
  failedHaptics: 0,
  dragMounts: 0,
  menus: [] as { id: string; onPressAction: (id: string) => void }[],
}))

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
  const Pressable = ({ children, testID, onPress }: Props) =>
    h(
      'button',
      {
        'data-testid': testID as string | undefined,
        onClick: () => (onPress as (() => void) | undefined)?.(),
      },
      children,
    )
  return {
    View: dom('div'),
    Text: dom('span'),
    Pressable,
    StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
    Platform: { OS: 'ios', select: (choices: { ios: unknown }) => choices.ios },
  }
})
vi.mock('react-native-gesture-handler', async () => {
  const React = await import('react')
  return {
    LegacyScrollView: React.forwardRef(function ScrollView(
      { children }: { children?: ReactNode },
      _ref,
    ) {
      return React.createElement('div', null, children)
    }),
  }
})
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))
vi.mock('expo-router', () => {
  const Stack = () => null
  Stack.Screen = ({ options }: { options: Record<string, unknown> }) => {
    state.options = options
    return null
  }
  return { Stack, useRouter: () => ({ push: () => {} }) }
})
vi.mock('convex/react', () => ({
  useMutation: () => {
    const run = async (args: unknown) => {
      state.reorders.push(args)
      if (state.refuse) throw new Error('refused')
    }
    return Object.assign(run, { withOptimisticUpdate: () => run })
  },
}))
vi.mock('../../../convex/api', () => ({
  api: {
    loyaltyCards: {
      list: 'loyaltyCards:list',
      reorder: 'loyaltyCards:reorder',
      remove: 'loyaltyCards:remove',
    },
  },
}))
vi.mock('../../../convex/queries', () => ({ useQuery: () => state.cards }))
vi.mock('../../../group/GroupProvider', () => ({
  useGroup: () => ({ group: { slug: 'home', name: 'Home' } }),
}))
vi.mock('../../../i18n', async () => {
  const { en } = await import('../../../i18n/messages/en')
  const { fmt } = await import('@gather/core/i18n')
  return {
    fmt,
    plural: () => '',
    useI18n: () => ({ t: en, locale: 'en' }),
  }
})
vi.mock('../../../theme/icons', () => ({
  UI_ICONS: new Proxy({}, { get: () => () => null }),
}))
vi.mock('../../../theme/tokens', () => ({
  SPACE: [0, 4, 8, 12, 16],
  RADIUS: { card: 12 },
  TYPE: {},
  useTokens: () => ({}),
}))
vi.mock('../../../feedback/haptics', () => ({
  haptics: {
    actionFailed: () => {
      state.failedHaptics += 1
    },
  },
}))
vi.mock('../../../components/LoadingSkeleton', () => ({
  LoadingSkeleton: () => null,
}))
vi.mock('../../../components/SearchField', () => ({
  SearchField: () => createElement('input', { 'data-testid': 'search' }),
}))
vi.mock('../../../ui/button', () => ({ Button: () => null }))
vi.mock('../../../ui/header-icon-button', () => ({
  HeaderIconButton: () => null,
}))
vi.mock('../../../ui/module-tile', () => ({ moduleTile: () => null }))
vi.mock('../../../ui/screen-header', () => ({ washScreenOptions: () => ({}) }))
vi.mock('../../../ui/wash-header', () => ({ WashHeader: () => null }))
vi.mock('../components/store-tile', () => ({ StoreTile: () => null }))
vi.mock('../use-delete-loyalty-card', () => ({
  useDeleteLoyaltyCard: () => () => {},
}))
vi.mock('../../../ui/inset-list', () => ({
  InsetList: ({ children }: { children: ReactNode }) =>
    createElement('div', null, children),
  InsetRow: ({
    testID,
    menu,
  }: {
    testID: string
    menu: { actions: { id: string }[]; onAction: (id: string) => void }
  }) =>
    createElement(
      'div',
      { 'data-testid': testID },
      menu.actions.map((action) =>
        createElement('button', {
          type: 'button',
          key: action.id,
          'data-testid': `${testID}-menu-${action.id}`,
          onClick: () => menu.onAction(action.id),
        }),
      ),
    ),
}))
vi.mock('@expo/ui/community/menu', () => ({
  MenuView: ({
    testID,
    actions,
    onPressAction,
  }: {
    testID: string
    actions: { id: string }[]
    onPressAction: (event: { nativeEvent: { event: string } }) => void
  }) =>
    createElement(
      'div',
      { 'data-testid': testID },
      actions.map((action) =>
        createElement('button', {
          type: 'button',
          key: action.id,
          'data-testid': `${testID}-${action.id}`,
          onClick: () => onPressAction({ nativeEvent: { event: action.id } }),
        }),
      ),
    ),
}))
// Drops the last row on top when clicked.
vi.mock('../../../shell/all/DragList', async () => {
  const React = await import('react')
  return {
    DragList: ({
      items,
      onCommit,
      dragLabel,
    }: {
      items: Item[]
      onCommit: (ids: string[]) => void
      dragLabel: (label: string) => string
    }) => {
      React.useEffect(() => {
        state.dragMounts += 1
      }, [])
      const ids = items.map((item) => item.id)
      return React.createElement(
        'button',
        {
          'data-testid': 'drag-list',
          'aria-label': items
            .map((item) => `${dragLabel(item.label)}|${item.detail ?? ''}`)
            .join(','),
          onClick: () => onCommit([ids[ids.length - 1], ...ids.slice(0, -1)]),
        },
        ids.join(','),
      )
    },
  }
})

const CARDS = [
  { _id: 'c1', storeName: 'Albert Heijn', holder: 'Nora' },
  { _id: 'c2', storeName: 'Hema' },
  { _id: 'c3', storeName: 'Zeeman' },
]

const byTestId = (id: string) =>
  document.querySelector<HTMLElement>(`[data-testid="${id}"]`)

/** The nav bar's right side, rendered from the options the screen set. */
function HeaderRight() {
  const render = state.options.headerRight as (() => ReactNode) | undefined
  return createElement('div', null, render?.())
}

function Screen() {
  return createElement(
    'div',
    null,
    createElement(LoyaltyCardListScreen),
    createElement(HeaderRight),
  )
}

beforeEach(() => {
  state.cards = CARDS
  state.options = {}
  state.reorders = []
  state.refuse = false
  state.failedHaptics = 0
  state.dragMounts = 0
})

test('the ⋯ menu enters reorder mode; a drop saves the whole order; Done leaves', async () => {
  const view = mount(createElement(Screen))
  byTestId('loyalty-card-list-menu-reorder')?.click()
  await settle()
  view.rerender(createElement(Screen))

  // The mode: no filter, no rows to open, the drag list and Done in the bar.
  expect(byTestId('search')).toBeNull()
  expect(byTestId('loyalty-card-c1')).toBeNull()
  const list = byTestId('drag-list')
  expect(list?.textContent).toBe('c1,c2,c3')
  expect(list?.getAttribute('aria-label')).toBe(
    'Reorder Albert Heijn|Nora,Reorder Hema|,Reorder Zeeman|',
  )
  expect(byTestId('loyalty-card-reorder-done')).not.toBeNull()

  list?.click()
  await settle()
  expect(state.reorders).toEqual([{ groupSlug: 'home', ids: ['c3', 'c1', 'c2'] }])

  byTestId('loyalty-card-reorder-done')?.click()
  await settle()
  view.rerender(createElement(Screen))
  expect(byTestId('drag-list')).toBeNull()
  expect(byTestId('search')).not.toBeNull()
  view.unmount()
})

test('a row’s hold menu enters reorder mode too', async () => {
  const view = mount(createElement(Screen))
  byTestId('loyalty-card-c2-menu-reorder')?.click()
  await settle()
  expect(byTestId('drag-list')).not.toBeNull()
  view.unmount()
})

test('a refused save says so, buzzes, and redraws the order Convex kept', async () => {
  state.refuse = true
  const view = mount(createElement(Screen))
  byTestId('loyalty-card-list-menu-reorder')?.click()
  await settle()
  expect(state.dragMounts).toBe(1)

  byTestId('drag-list')?.click()
  await settle()
  expect(state.failedHaptics).toBe(1)
  expect(document.body.textContent).toContain('That did not work — try again.')
  // Remounted, so it draws the list as Convex rolled it back.
  expect(state.dragMounts).toBe(2)
  view.unmount()
})

test('with fewer than two cards there is nothing to reorder', async () => {
  state.cards = CARDS.slice(0, 1)
  const view = mount(createElement(Screen))
  view.rerender(createElement(Screen))
  expect(byTestId('loyalty-card-list-menu')).toBeNull()
  expect(byTestId('loyalty-card-c1-menu-reorder')).toBeNull()
  expect(byTestId('loyalty-card-c1-menu-edit')).not.toBeNull()
  view.unmount()
})
