// @vitest-environment jsdom
/**
 * The Control Center control's press opens the Loyalty card that is open with
 * the All index beneath it (APP-454), so a card opened at cold start has a
 * back button. This checks the option passed to the router, not the resulting
 * stack: the stack is expo-router's, and not something a Node test can build.
 */
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { closeOpenSheets, openSheet } from '../components/openSheets'
import { mount, settle } from '../testing/dom'
import { HomeScreenActionLinks } from './HomeScreenActionLinks'
import { linkAfterSheets } from './linkAfterSheets'
import {
  markQuickSheetOpen,
  onQuickSheetRequest,
  takeQuickSheetRequest,
} from './quickSheetRequest'

const state = vi.hoisted(() => ({
  navigated: [] as { href: unknown; options: unknown }[],
  requestedAt: undefined as number | undefined,
  onAction: (_: { id: string }) => {},
  onScreen: false,
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
  addListener: (listener: (action: { id: string }) => void) => {
    state.onAction = listener
    return { remove: () => {} }
  },
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
  isCardOnScreen: () => state.onScreen,
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
  state.onScreen = false
  takeQuickSheetRequest()
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

test('the control closes an open sheet before it opens the quick sheet (APP-774)', async () => {
  state.card = null
  const asked: (() => void)[] = []
  const sheet = openSheet(() => asked.push(() => sheet.closed()))
  mount(<HomeScreenActionLinks />)
  await settle()
  expect(asked).toHaveLength(1)
  expect(state.navigated).toEqual([])

  asked[0]?.()
  await settle()
  await settle()
  expect(state.navigated).toHaveLength(1)
})

test('a home-screen action closes an open sheet first, then opens its sheet (APP-817)', async () => {
  state.card = null
  state.requestedAt = undefined
  const asked: (() => void)[] = []
  const sheet = openSheet(() => asked.push(() => sheet.closed()))
  mount(<HomeScreenActionLinks />)
  state.onAction({ id: 'task-new' })
  await settle()
  expect(asked).toHaveLength(1)
  expect(state.navigated).toEqual([])

  asked[0]?.()
  await settle()
  await settle()
  expect(state.navigated).toHaveLength(1)
  expect(state.navigated[0]?.href).toMatchObject({
    pathname: '/quick',
    params: { action: 'task-new' },
  })
})

test('the control opens the open card only once a sheet over it has closed (APP-817)', async () => {
  const asked: (() => void)[] = []
  const sheet = openSheet(() => asked.push(() => sheet.closed()))
  mount(<HomeScreenActionLinks />)
  await settle()
  expect(asked).toHaveLength(1)
  expect(state.navigated).toEqual([])

  asked[0]?.()
  await settle()
  await settle()
  expect(state.navigated).toHaveLength(1)
  expect(state.navigated[0]?.options).toEqual({ withAnchor: true })
})

test('a quick action goes to the sheet that is up, and to its route while something waits', async () => {
  state.card = null
  state.requestedAt = undefined
  const heard = vi.fn()
  const stop = onQuickSheetRequest(heard)
  const up = markQuickSheetOpen()
  mount(<HomeScreenActionLinks />)

  state.onAction({ id: 'quick' })
  expect(heard).toHaveBeenCalledOnce()
  expect(state.navigated).toEqual([])
  takeQuickSheetRequest()

  // A link waiting on a sheet is closing the quick sheet too.
  const asked: (() => void)[] = []
  const sheet = openSheet(() => asked.push(() => sheet.closed()))
  const link = linkAfterSheets('gather-dev://all/notes')
  heard.mockClear()
  state.onAction({ id: 'quick' })
  expect(heard).not.toHaveBeenCalled()
  await settle()
  asked[0]?.()
  await link
  await settle()
  await settle()
  expect(state.navigated).toHaveLength(1)
  up()
  stop()
})

test('a request is not handed to a sheet that is still closing, though its link no longer waits (APP-817)', async () => {
  state.card = null
  state.requestedAt = undefined
  const heard = vi.fn()
  const stop = onQuickSheetRequest(heard)
  const up = markQuickSheetOpen()
  mount(<HomeScreenActionLinks />)
  const asked: (() => void)[] = []
  const sheet = openSheet(() => asked.push(() => sheet.closed()))
  const closing = closeOpenSheets()

  state.onAction({ id: 'quick' })
  expect(heard).not.toHaveBeenCalled()
  asked[0]?.()
  await closing
  await settle()
  await settle()
  expect(state.navigated).toHaveLength(1)
  up()
  stop()
})

test('a control press that finds its card on screen ends an older waiting link (APP-817)', async () => {
  state.onScreen = true
  const asked: (() => void)[] = []
  const sheet = openSheet(() => asked.push(() => sheet.closed()))
  const link = linkAfterSheets('gather-dev://all/notes')
  mount(<HomeScreenActionLinks />)
  await settle()
  asked[0]?.()
  expect(await link).toBeNull()
  expect(state.navigated).toEqual([])
})
