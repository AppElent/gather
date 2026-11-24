// @vitest-environment jsdom
/**
 * Custom repeat from the task composer: closing it brings the composer back,
 * unless a share closed it (APP-672). `AddTask` and the composer's card are
 * real; the shell, the Repeat sheet and the store are replaced.
 */
import { act, createElement } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'

import { mount } from '../../testing/dom'
import { forgetDrafts } from '../../ui/composer-drafts'
import { AddTask } from './AddTaskComposer'

const state = vi.hoisted(() => ({
  shell: null as null | { more: { onPress: (id: string) => void } },
  open: () => {},
  closeRepeat: (_: boolean) => {},
}))

vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }))
vi.mock('expo-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@clerk/expo', () => ({ useAuth: () => ({ userId: 'u1' }) }))
vi.mock('@expo/ui/community/datetime-picker', () => ({ DateTimePicker: () => null }))
vi.mock('../../components/DateTimeField', () => ({ DateTimeWheel: () => null }))
vi.mock('../../features/notifications/use-push-permission', () => ({
  usePushPermission: () => ({ ask: vi.fn() }),
}))
vi.mock('../../feedback/haptics', () => ({
  haptics: new Proxy({}, { get: () => () => {} }),
}))
vi.mock('../../group/GroupProvider', () => ({
  useGroup: () => ({ group: { _id: 'g1', slug: 'home' } }),
}))
vi.mock('../../i18n', async () => {
  const { en } = await import('../../i18n/messages/en')
  return {
    useI18n: () => ({ t: en, locale: 'en' }),
    fmt: (text: string) => text,
    plural: () => '',
  }
})
vi.mock('../../observability/native-presentation', () => ({ showAlert: vi.fn() }))
vi.mock('../../theme/icons', () => ({ UI_ICONS: {} }))
vi.mock('../../theme/tokens', () => ({
  useTokens: () => ({ tintOf: () => ({}) }),
}))
vi.mock('../../ui/composer-panel', () => ({}))
vi.mock('../../ui/keyboard-composer', () => ({
  ComposerAddButton: ({ onPress }: { onPress: () => void }) => {
    state.open = onPress
    return 'add'
  },
  KeyboardComposer: (props: never) => {
    state.shell = props
    return 'composer'
  },
}))
vi.mock('./assignee', () => ({
  useTaskPeople: () => ({ people: [], byId: new Map() }),
}))
vi.mock('./freshTasks', () => ({ markFresh: vi.fn() }))
vi.mock('./icons', () => ({ TASK_ICONS: {} }))
vi.mock('./listFace', () => ({ ListTile: () => null }))
vi.mock('./QuickAddParts', () => ({
  QuickAddInput: () => null,
  useQuickAddLine: () => ({
    line: 'stofzuigen',
    parsed: { title: 'stofzuigen', parts: [], labels: [] },
    today: '2026-11-24',
    dismissed: [],
    load: () => {},
    setLine: () => {},
    dismiss: () => {},
  }),
}))
vi.mock('./RepeatSheet', () => ({
  RepeatSheet: ({ onClose }: { onClose: (byShare: boolean) => void }) => {
    state.closeRepeat = onClose
    return 'repeat'
  },
}))
vi.mock('./store', () => ({
  listFace: () => ({}),
  useLocalTaskState: () => ({ tasks: [] }),
  useTaskActions: () => ({}),
  useTaskLists: () => [],
}))

beforeEach(forgetDrafts)

function atRepeat() {
  const view = mount(createElement(AddTask, { place: 'index', preset: {} }))
  act(() => state.open())
  expect(view.container.textContent).toBe('composer')
  act(() => state.shell?.more.onPress('repeat:custom'))
  expect(view.container.textContent).toBe('repeat')
  return view
}

test('a close the person chose brings the composer back', () => {
  const view = atRepeat()
  act(() => state.closeRepeat(false))
  expect(view.container.textContent).toBe('composer')
  view.unmount()
})

test('a share does not: the chooser is what comes next', () => {
  const view = atRepeat()
  act(() => state.closeRepeat(true))
  expect(view.container.textContent).toBe('add')
  view.unmount()
})
