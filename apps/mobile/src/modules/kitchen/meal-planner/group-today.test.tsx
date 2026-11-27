// @vitest-environment jsdom
/**
 * The planner's sheets start from the Group's day, not this phone's, so they
 * agree on the week near its boundary (APP-779).
 */
import { act, createElement } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { mount } from '../../../testing/dom'
import { GroceriesSourceSheet } from '../add-to-groceries/source-sheet'
import type { WeekData } from './week'
import { WeekGroceriesSheet } from './week-groceries-sheet'

const state = vi.hoisted(() => ({
  timeZone: undefined as string | undefined,
  queries: [] as unknown[],
}))
vi.mock('react-native', () => ({
  StyleSheet: { create: (s: unknown) => s, hairlineWidth: 1 },
  Text: 'span',
  View: 'div',
  Pressable: (props: {
    testID: string
    accessibilityState?: { selected?: boolean }
  }) =>
    createElement('i', {
      'data-testid': props.testID,
      'data-selected': String(props.accessibilityState?.selected),
    }),
}))
vi.mock('expo-router', () => ({ router: {} }))
vi.mock('../../../convex/api', () => ({
  api: { mealPlan: { week: 'week', weekIngredients: 'weekIngredients' } },
}))
vi.mock('../../../convex/queries', () => ({
  useQuery: (_name: unknown, args: unknown) => {
    state.queries.push(args)
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
vi.mock('../../../theme/icons', () => ({ UI_ICONS: {} }))
vi.mock('../../../theme/tokens', () => ({
  RADIUS: {},
  SIZE: {},
  SPACE: {},
  TYPE: {},
  TABULAR: {},
  useTokens: () => ({}),
}))
vi.mock('../../../components/NativeSheet', () => ({
  NativeSheet: ({ children }: { children: unknown }) => children,
}))
vi.mock('../../../ui/section-label', () => ({ SectionLabel: () => null }))
vi.mock('../../../ui/module-tile', () => ({
  ModuleTile: () => null,
  moduleTile: () => undefined,
}))
vi.mock('../../../ui/inset-list', () => ({
  InsetList: ({ children }: { children: unknown }) => children,
  InsetRow: (props: { testID: string; onPress: () => void }) =>
    createElement('button', {
      type: 'button',
      'data-testid': props.testID,
      onClick: props.onPress,
    }),
}))
vi.mock('../../../ui/sheet-drafts', () => ({
  useSheetDraft: () => ({ track: () => {}, failed: () => {} }),
}))
vi.mock('../../moduleDestination', () => ({ moduleHref: () => '' }))
vi.mock('../add-to-groceries/add-sheet', () => ({
  AddToGroceriesSheet: ({ days }: { days: unknown }) => days,
}))
vi.mock('../add-to-groceries/use-recipe-lines', () => ({
  useIngredientLines: () => ({ lines: [], aiCount: 0, readingAsText: false }),
}))

beforeEach(() => {
  state.queries = []
  // Sunday the 29th in UTC; Saturday at UTC-11, Monday at UTC+14.
  vi.useFakeTimers({ now: new Date('2026-11-29T10:30:00Z') })
})
afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

const week = ['2026-11-23', '2026-11-28', '2026-11-29']
const data = {
  members: [],
  events: [],
  preferences: { memberDefaults: [], smart: {} },
  meals: week.map((date) => ({
    _id: date,
    date,
    slot: 'dinner',
    title: 'Soup',
    servings: 2,
    eaterIds: [],
  })),
} as unknown as WeekData

function counted() {
  const { container } = mount(
    createElement(WeekGroceriesSheet, {
      data,
      weekStart: '2026-11-23',
      onClose: () => {},
    }),
  )
  return week.filter(
    (date) =>
      container.querySelector<HTMLElement>(
        `[data-testid="week-groceries-day-${date}"]`,
      )?.dataset.selected === 'true',
  )
}

test.each([
  ['Pacific/Pago_Pago', ['2026-11-28', '2026-11-29']],
  ['Europe/Amsterdam', ['2026-11-29']],
  // Next week already: the week that is over counts whole.
  ['Pacific/Kiritimati', week],
])('the week grocery sheet counts from today in %s', (zone, days) => {
  state.timeZone = zone
  expect(counted()).toEqual(days)
})

test.each([
  ['Pacific/Kiritimati', '2026-11-30'],
  ['Europe/Amsterdam', '2026-11-23'],
])('the grocery list opens the week of today in %s', (zone, from) => {
  state.timeZone = zone
  const { container } = mount(
    createElement(GroceriesSourceSheet, {
      listId: 'list',
      onRecipes: () => {},
      onClose: () => {},
    }),
  )
  act(() =>
    container
      .querySelector<HTMLElement>('[data-testid="groceries-source-week"]')
      ?.click(),
  )
  expect(state.queries.at(-1)).toMatchObject({ groupSlug: 'home', from })
})

test('an open source sheet follows the zone to its week', () => {
  state.timeZone = 'Europe/Amsterdam'
  const sheet = () =>
    createElement(GroceriesSourceSheet, {
      listId: 'list',
      onRecipes: () => {},
      onClose: () => {},
    })
  const { container, rerender } = mount(sheet())
  act(() =>
    container
      .querySelector<HTMLElement>('[data-testid="groceries-source-week"]')
      ?.click(),
  )
  state.timeZone = 'Pacific/Kiritimati'
  rerender(sheet())
  expect(state.queries.at(-1)).toMatchObject({ from: '2026-11-30' })
})
