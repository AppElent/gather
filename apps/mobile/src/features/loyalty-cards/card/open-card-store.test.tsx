// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from 'vitest'

import { mount, settle } from '../../../testing/dom'
import {
  clearOpenCard,
  isCardOnScreen,
  readOpenCard,
  recordOpenCard,
  useRecordOpenCard,
} from './open-card-store'

const state = vi.hoisted(() => ({
  store: new Map<string, string>(),
  listener: null as null | ((state: string) => void),
}))

vi.mock('react-native', () => ({
  AppState: {
    addEventListener: (_: string, listener: (next: string) => void) => {
      state.listener = listener
      return { remove: () => (state.listener = null) }
    },
  },
}))

vi.mock('../../../prefs/localPreference', () => ({
  PREFERENCE_KEYS: { openLoyaltyCard: 'open' },
  readPreference: (key: string) => state.store.get(key) ?? null,
  writePreference: (key: string, value: string) => state.store.set(key, value),
  clearPreference: (key: string) => state.store.delete(key),
}))

const where = { groupId: 'g1', groupSlug: 'home' }

function Card({
  cardId = 'c1',
  focused,
  missing = false,
}: {
  cardId?: string
  focused: boolean
  missing?: boolean
}) {
  useRecordOpenCard({ cardId, ...where }, focused, missing)
  return null
}

beforeEach(() => {
  state.store.clear()
  state.listener = null
  vi.useRealTimers()
})

test('records the card while focused and forgets it when focus leaves', async () => {
  const view = mount(<Card focused />)
  await settle()
  expect(readOpenCard()).toMatchObject({ cardId: 'c1', ...where })
  expect(isCardOnScreen('c1')).toBe(true)

  // Back, another tab, or Edit pushed on top: still mounted, not focused.
  view.rerender(<Card focused={false} />)
  await settle()
  expect(readOpenCard()).toBeNull()
  expect(isCardOnScreen('c1')).toBe(false)

  view.rerender(<Card focused />)
  await settle()
  expect(readOpenCard()?.cardId).toBe('c1')
  view.unmount()
  await settle()
  expect(readOpenCard()).toBeNull()
})

test('keeps the card when the app is left, stamped with the time it left', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(1_000)
  const view = mount(<Card focused />)
  await settle()
  expect(readOpenCard()?.at).toBe(1_000)

  vi.setSystemTime(90_000)
  state.listener?.('background')
  expect(readOpenCard()).toMatchObject({ cardId: 'c1', at: 90_000 })

  // Coming back changes nothing.
  vi.setSystemTime(95_000)
  state.listener?.('active')
  expect(readOpenCard()?.at).toBe(90_000)
  view.unmount()
})

test('forgets a card that turns out to be gone, and does not record it again', async () => {
  const view = mount(<Card focused />)
  await settle()
  view.rerender(<Card focused missing />)
  await settle()
  expect(readOpenCard()).toBeNull()

  state.listener?.('background')
  expect(readOpenCard()).toBeNull()
  view.unmount()
})

test('leaving one card does not forget another recorded since', () => {
  recordOpenCard({ cardId: 'c2', ...where })
  clearOpenCard('c1')
  expect(readOpenCard()?.cardId).toBe('c2')
  clearOpenCard('c2')
  expect(readOpenCard()).toBeNull()
})
