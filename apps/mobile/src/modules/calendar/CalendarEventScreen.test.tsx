// @vitest-environment jsdom
/** Edit comes back on the draft a share closed, a copy included (APP-622). */
import { act, createElement, type ReactNode } from 'react'
import { afterEach, expect, test, vi } from 'vitest'

import { closeOpenSheets, openSheet } from '../../components/openSheets'
import { mount } from '../../testing/dom'
import { forgetDrafts } from '../../ui/composer-drafts'
import { CalendarEventScreen } from './CalendarEventScreen'

type Props = Record<string, unknown> & { children?: ReactNode }
type Draft = { draftId: string; status: string; eventId: string | null }

const state = vi.hoisted(() => ({
  draft: null as Draft | null,
  dirty: true,
  edit: () => {},
  closeEditor: () => {},
  openEdit: vi.fn(),
  resume: vi.fn(),
}))

vi.mock('react-native', async () => {
  const h = (await import('react')).createElement
  const box = ({ children }: Props) => h('div', null, children)
  return {
    View: box,
    Text: box,
    ScrollView: box,
    Pressable: ({ onPress }: Props) => {
      state.edit = onPress as () => void
      return null
    },
    StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  }
})
vi.mock('expo-router', () => ({ Stack: { Screen: () => null } }))
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0 }),
}))
vi.mock('@clerk/expo', () => ({ useAuth: () => ({ userId: 'u1' }) }))
vi.mock('@gather/core/calendar', () => ({
  normalizeCalendarEvent: (event: unknown) => event,
}))
vi.mock('../../convex/api', () => ({
  api: new Proxy({}, { get: () => new Proxy({}, { get: (_, key) => key }) }),
}))
vi.mock('../../convex/queries', () => ({
  useQuery: (name: string) =>
    name === 'members'
      ? []
      : { _id: 'e1', title: '', date: '2026-11-23', assigneeIds: [] },
  usePaginatedQuery: () => ({ results: [] }),
}))
vi.mock('../../group/GroupProvider', () => ({
  useGroup: () => ({ group: { _id: 'g1', slug: 'home' } }),
}))
vi.mock('../../i18n', async () => {
  const { en } = await import('../../i18n/messages/en')
  return { useI18n: () => ({ t: en, locale: 'en' }) }
})
vi.mock('../../search/recentRecordsStore', () => ({ useRecordRecent: vi.fn() }))
vi.mock('../../theme/tokens', () => ({
  RADIUS: {},
  TYPE: {},
  useTokens: () => ({}),
}))
vi.mock('./calendarDraft', () => ({ isDraftDirty: () => state.dirty }))
vi.mock('./useCalendarEditor', () => ({ useCalendarEditor: () => state }))
vi.mock('./CalendarEditor', () => ({
  CalendarEditor: ({ onClose }: Props) => {
    state.closeEditor = onClose as () => void
    return null
  },
}))

const press = () => act(() => state.edit())

/** The editor is on `draftId` when a share closes it, leaving `status`. */
async function editAndShare(draftId: string, status: string) {
  const view = mount(createElement(CalendarEventScreen, { eventId: 'e1' }))
  state.draft = { draftId: 'edit:e1', status: 'editing', eventId: 'e1' }
  press()
  state.draft = { draftId, status: 'editing', eventId: null }
  view.rerender(createElement(CalendarEventScreen, { eventId: 'e1' }))
  const sheet = openSheet(() => {
    state.draft = state.draft && { ...state.draft, status }
    act(() => state.closeEditor())
    sheet.closed()
  })
  await closeOpenSheets()
  state.openEdit.mockClear()
  state.resume.mockClear()
  return view
}

afterEach(() => {
  forgetDrafts()
  state.dirty = true
})

test('a copy a share closed is resumed, once', async () => {
  const view = await editAndShare('create:1', 'dismissed')
  press()
  expect(state.resume).toHaveBeenCalledOnce()
  expect(state.openEdit).not.toHaveBeenCalled()
  press()
  expect(state.openEdit).toHaveBeenCalledOnce()
  view.unmount()
})

test('one whose save failed since is shown as it is', async () => {
  const view = await editAndShare('edit:e1', 'error')
  press()
  expect(state.resume).not.toHaveBeenCalled()
  expect(state.openEdit).not.toHaveBeenCalled()
  view.unmount()
})

test('a saved or untouched draft opens the event afresh', async () => {
  const saved = await editAndShare('edit:e1', 'dismissed')
  state.draft = null
  press()
  expect(state.openEdit).toHaveBeenCalledOnce()
  saved.unmount()

  state.dirty = false
  const untouched = await editAndShare('edit:e1', 'dismissed')
  press()
  expect(state.openEdit).toHaveBeenCalledOnce()
  untouched.unmount()
})
