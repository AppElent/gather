// @vitest-environment jsdom
/** The week menu opens on the Group's week, not this phone's (APP-779). */
import { createElement } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { mount } from '../../../testing/dom'
import { MealPlannerScreen } from './meal-planner-screen'
import { PlanSheet } from './plan-sheet'
import type { WeekData } from './week'

const state = vi.hoisted(() => ({
  timeZone: undefined as string | undefined,
  weeks: [] as unknown[],
  today: [] as string[],
}))
const nothing = vi.hoisted(() => () => null)
vi.mock('react-native', () => ({
  StyleSheet: { create: (s: unknown) => s, hairlineWidth: 1 },
  Animated: { Value: class {}, View: nothing },
  Pressable: nothing,
  ScrollView: nothing,
  Text: nothing,
  TextInput: nothing,
  View: nothing,
  useWindowDimensions: () => ({ fontScale: 1 }),
}))
vi.mock('react-native-gesture-handler', () => {
  const gesture: unknown = new Proxy(() => gesture, { get: () => () => gesture })
  return {
    Directions: {},
    Gesture: gesture,
    GestureDetector: nothing,
    LegacyScrollView: nothing,
  }
})
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({}),
}))
vi.mock('@expo/ui/community/menu', () => ({ MenuView: nothing }))
vi.mock('expo-router', () => ({
  router: {},
  Stack: { Screen: nothing },
}))
vi.mock('convex/react', () => ({
  useAction: () => async () => {},
  useMutation: () => async () => {},
  useConvexConnectionState: () => ({ isWebSocketConnected: true }),
}))
vi.mock('../../../convex/api', () => ({
  api: {
    mealPlan: { week: 'week' },
    mealPlanDrafts: {},
    aiUsage: {},
    groceryStaples: {},
  },
}))
vi.mock('../../../convex/queries', () => ({
  useQuery: (name: unknown, args: unknown) => {
    if (name === 'week') state.weeks.push(args)
    return undefined
  },
}))
vi.mock('../../../group/GroupProvider', () => ({
  useGroup: () => ({ group: { slug: 'home', timeZone: state.timeZone } }),
}))
vi.mock('../../../feedback/haptics', () => ({ haptics: {} }))
vi.mock('../../../i18n', async () => {
  const { en } = await import('../../../i18n/messages/en')
  return {
    useI18n: () => ({ t: en, locale: 'en' }),
    fmt: (text: string) => text,
    plural: () => '',
  }
})
vi.mock('../../../settings/module-pages', () => ({ moduleSettingsRoute: () => '' }))
vi.mock('../../../theme/icons', () => ({
  UI_ICONS: new Proxy({}, { get: () => nothing }),
}))
vi.mock('../../../theme/tokens', () => {
  const any: unknown = new Proxy({}, { get: () => ({}) })
  return {
    RADIUS: any,
    SIZE: any,
    SPACE: any,
    TABULAR: {},
    TYPE: any,
    useTokens: () => ({ tintOf: () => ({}) }),
  }
})
vi.mock('../../../components/NativeSheet', () => ({ NativeSheet: nothing }))
vi.mock('../../../ui/inset-list', () => ({ InsetList: nothing, InsetRow: nothing }))
vi.mock('../../../ui/module-header-buttons', () => ({ ModuleHeaderButtons: nothing }))
vi.mock('../../../ui/module-tile', () => ({ moduleTile: () => undefined }))
vi.mock('../../../ui/screen-header', () => ({ washScreenOptions: () => ({}) }))
vi.mock('../../../ui/text-scale', () => ({ isAccessibilityTextSize: () => false }))
vi.mock('../../../ui/undo-toast', () => ({
  useUndoToast: () => ({ show: () => {}, toast: null }),
}))
vi.mock('../../../ui/wash-header', () => ({ WashHeader: nothing }))
vi.mock('../../../ui/sheet-drafts', () => ({
  useSheetDraft: () => ({ track: () => {}, failed: () => {} }),
}))
vi.mock('../../moduleDestination', () => ({ moduleHref: () => '' }))
vi.mock('./meal-groceries-sheet', () => ({ MealGroceriesSheet: nothing }))
vi.mock('./meal-sheet', () => ({ MealSheet: nothing }))
vi.mock('./parts', () => ({
  Chip: nothing,
  EmptyThumb: nothing,
  GroceriesPill: nothing,
  MealThumb: nothing,
  MemberCoins: nothing,
}))
vi.mock('./pick-sheet', () => ({ PickSheet: nothing }))
vi.mock('./proposal', () => ({
  DraftCard: nothing,
  ProposalBar: nothing,
  ProposalCard: nothing,
}))
vi.mock('./proposal-bar', () => ({
  slotKey: () => '',
  toastClearance: () => 0,
  useProposalBar: () => ({}),
}))
vi.mock('./swap-sheet', () => ({ SwapSheet: nothing }))
vi.mock('./week-groceries-sheet', () => ({ WeekGroceriesSheet: nothing }))
vi.mock('@gather/core/week-menu-plan', async (load) => ({
  ...(await load<typeof import('@gather/core/week-menu-plan')>()),
  planSlotChoices: () => [],
  defaultPlanSlots: () => [],
  planUses: () => [],
  planDays: (...args: unknown[]) => {
    state.today.push(args[5] as string)
    return []
  },
}))

beforeEach(() => {
  state.weeks = []
  state.today = []
  // Sunday the 29th in UTC; Monday at UTC+14.
  vi.useFakeTimers({ now: new Date('2026-11-29T10:30:00Z') })
})
afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

test.each([
  ['Pacific/Kiritimati', '2026-11-30', '2026-11-30'],
  ['Europe/Amsterdam', '2026-11-23', '2026-11-29'],
])('in %s', (zone, from, today) => {
  state.timeZone = zone
  mount(createElement(MealPlannerScreen))
  expect(state.weeks[0]).toMatchObject({ groupSlug: 'home', from })

  mount(
    createElement(PlanSheet, {
      weekStart: from,
      data: { preferences: {}, meals: [] } as unknown as WeekData,
      onClose: () => {},
      onPlanned: () => {},
      onChooseYourself: () => {},
      onPreferences: () => {},
    }),
  )
  expect(state.today.at(-1)).toBe(today)
})

test('an open planner follows the zone to its week', () => {
  state.timeZone = 'Europe/Amsterdam'
  const { rerender } = mount(createElement(MealPlannerScreen))
  state.timeZone = 'Pacific/Kiritimati'
  rerender(createElement(MealPlannerScreen))
  expect(state.weeks.at(-1)).toMatchObject({ from: '2026-11-30' })
})
