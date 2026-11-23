// @vitest-environment jsdom
/**
 * The Control Center control's press opens the Loyalty card that is open with
 * the All index beneath it (APP-454), so a card opened at cold start has a
 * back button. This checks the option passed to the router, not the resulting
 * stack: the stack is expo-router's, and not something a Node test can build.
 */
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { mount, settle } from '../testing/dom'
import { HomeScreenActionLinks } from './HomeScreenActionLinks'

const state = vi.hoisted(() => ({
  navigated: [] as { href: unknown; options: unknown }[],
  requestedAt: undefined as number | undefined,
  card: null as {
    cardId: string
    groupId: string
    groupSlug: string
    at: number
  } | null,
}))

vi.mock('expo-router', () => ({
  router: {
    navigate: (href: unknown, options?: unknown) => {
      state.navigated.push({ href, options })
    },
  },
}))
vi.mock('expo-quick-actions', () => ({
  setItems: async () => {},
  initial: undefined,
  addListener: () => ({ remove: () => {} }),
}))
vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  Settings: {
    get: () => state.requestedAt,
    set: () => {},
    watchKeys: () => 1,
    clearWatch: () => {},
  },
}))
vi.mock('../convex/lastKnown', () => ({ confirmedAccount: () => null }))
vi.mock('../features/loyalty-cards/card/open-card-store', () => ({
  readOpenCard: () => state.card,
  isCardOnScreen: () => false,
}))
vi.mock('../features/loyalty-cards/offline/offline-cards', () => ({
  offlineGroupCards: () => undefined,
}))
vi.mock('../group/retainedGroup', () => ({
  readRetainedGroup: () => 'g_kitchen',
}))
vi.mock('../i18n', async () => {
  const { en } = await import('../i18n/messages/en')
  return { useI18n: () => ({ t: en, locale: 'en' }) }
})
vi.mock('../observability/report', () => ({ reportError: () => {} }))

beforeEach(() => {
  state.navigated = []
  state.requestedAt = Date.now()
  state.card = {
    cardId: 'card_1',
    groupId: 'g_kitchen',
    groupSlug: 'kitchen',
    at: Date.now(),
  }
})

afterEach(() => {
  document.body.innerHTML = ''
})

test('the control opens the open card with the All index beneath it, so it has a back button', async () => {
  mount(<HomeScreenActionLinks />)
  await settle()

  expect(state.navigated).toHaveLength(1)
  expect(state.navigated[0]?.href).toMatchObject({
    params: { cardId: 'card_1', via: 'control' },
  })
  expect(state.navigated[0]?.options).toEqual({ withAnchor: true })
})
