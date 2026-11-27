// @vitest-environment jsdom
/**
 * A share that closes the meal sheet saves nothing and keeps the changes; any
 * other close saves them, against the meal the sheet first opened on (APP-622).
 */
import { act, createElement, type ReactNode } from 'react'
import { afterEach, expect, test, vi } from 'vitest'

import { closeOpenSheets, openSheet } from '../../../components/openSheets'
import { mount } from '../../../testing/dom'
import { forgetDrafts } from '../../../ui/composer-drafts'
import { MealSheet } from './meal-sheet'

type Props = Record<string, unknown> & { children?: ReactNode }

const state = vi.hoisted(() => ({
  write: vi.fn((..._: unknown[]) => Promise.resolve()),
  close: () => {},
  note: (_: string) => {},
  shownNote: '',
}))

vi.mock('react-native', async () => {
  const h = (await import('react')).createElement
  const box = ({ children }: Props) => h('div', null, children)
  return {
    View: box,
    Text: box,
    ScrollView: box,
    Pressable: box,
    TextInput: (props: Props) => {
      state.note = props.onChangeText as typeof state.note
      state.shownNote = props.value as string
      return null
    },
    StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  }
})
vi.mock('expo-router', () => ({ router: { push: vi.fn() } }))
vi.mock('@clerk/expo', () => ({ useAuth: () => ({ userId: 'u1' }) }))
vi.mock('convex/react', () => ({
  useMutation: (name: string) => (args: unknown) => state.write(name, args),
}))
vi.mock('../../../convex/api', () => ({
  api: {
    mealPlan: {
      update: 'update',
      move: 'move',
      remove: 'remove',
      restore: 'restore',
    },
  },
}))
vi.mock('../../../components/NativeSheet', () => ({
  NativeSheet: ({ children, onClose }: Props) => {
    state.close = onClose as () => void
    return children
  },
}))
vi.mock('../../../feedback/haptics', () => ({
  haptics: { itemSaved: vi.fn(), actionFailed: vi.fn() },
}))
vi.mock('../../../group/GroupProvider', () => ({
  useGroup: () => ({ group: { _id: 'g1', slug: 'home' } }),
}))
vi.mock('../../../i18n', async () => {
  const { en } = await import('../../../i18n/messages/en')
  return {
    useI18n: () => ({ t: en, locale: 'en' }),
    fmt: (text: string) => text,
  }
})
vi.mock('../../../theme/icons', () => ({
  UI_ICONS: new Proxy({}, { get: () => () => null }),
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
vi.mock('../../../ui/inset-list', () => ({
  InsetList: ({ children }: Props) => children,
  InsetRow: () => null,
}))
vi.mock('./parts', () => ({ Coin: () => null }))
vi.mock('@gather/core/week-menu', () => ({
  awayAt: () => new Map(),
  clock: () => '',
  daySlots: () => ['dinner'],
  dayTitle: () => '',
  eatersOf: () => [],
  joinNames: () => '',
  mealIn: () => undefined,
  servingsOf: () => 2,
  shortNames: () => new Map(),
  weekdayInText: () => '',
  weekdayName: () => '',
}))

function open(note: string) {
  const view = mount(
    createElement(MealSheet, {
      id: 'm1' as never,
      data: {
        meals: [
          { _id: 'm1', date: '2026-11-23', slot: 'dinner', title: 'Pasta', note },
        ],
        members: [],
        events: [],
      } as never,
      weekStart: '2026-11-23',
      onClose: () => view.unmount(),
      onSomethingElse: () => {},
      onGroceries: () => {},
      showToast: () => {},
    }),
  )
  return view
}

afterEach(() => {
  forgetDrafts()
  state.write.mockClear()
})

test('a close saves what changed', () => {
  open('oud')
  act(() => state.note('nieuw'))
  state.close()
  expect(state.write).toHaveBeenCalledWith('update', {
    groupSlug: 'home',
    id: 'm1',
    note: 'nieuw',
  })
})

test('a share saves nothing, and the sheet opens on the changes', async () => {
  open('oud')
  act(() => state.note('half'))
  const sheet = openSheet(() => {
    state.close()
    sheet.closed()
  })
  await closeOpenSheets()
  expect(state.write).not.toHaveBeenCalled()

  open('oud')
  expect(state.shownNote).toBe('half')
  state.close()
  expect(state.write).toHaveBeenCalledOnce()
})
