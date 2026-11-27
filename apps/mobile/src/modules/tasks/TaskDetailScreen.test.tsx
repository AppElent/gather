// @vitest-environment jsdom
/**
 * A linked task's title its provider refused stays in the field, to be sent
 * again (APP-799). React Native is replaced by DOM stand-ins.
 */
import type { ReactNode } from 'react'
import { act } from 'react'
import { expect, test, vi } from 'vitest'

import { mount, settle } from '../../testing/dom'
import { TaskDetail } from './TaskDetailScreen'

const state = vi.hoisted(() => ({ renameTask: vi.fn(), writeFailed: vi.fn() }))

vi.mock('react-native', async () => {
  const React = await import('react')
  const h = React.createElement
  type Props = Record<string, unknown> & { children?: ReactNode }
  const dom =
    (tag: string) =>
    ({ children, testID }: Props) =>
      h(tag, { 'data-testid': testID as string | undefined }, children)
  return {
    View: dom('div'),
    Text: dom('span'),
    Pressable: dom('button'),
    Platform: { OS: 'ios' },
    StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
    TextInput: ({ testID, value, onChangeText, onBlur }: Props) =>
      h('textarea', {
        'data-testid': testID,
        value,
        onChange: (event: { target: { value: string } }) =>
          (onChangeText as (next: string) => void)(event.target.value),
        onBlur,
      }),
  }
})
vi.mock('react-native-gesture-handler', () => ({
  LegacyScrollView: ({ children }: { children: ReactNode }) => children,
}))
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0 }),
}))
vi.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ back: () => {} }),
}))
vi.mock('../../convex/queries', () => ({ useQuery: () => undefined }))
vi.mock('../../group/GroupProvider', () => ({ useGroup: () => ({ group: {} }) }))
vi.mock('../../i18n', async () => {
  const { en: t } = await import('../../i18n/messages/en')
  const { fmt } = await import('@gather/core/i18n')
  return { fmt, useI18n: () => ({ t, locale: 'en' }) }
})
vi.mock('../../search/recentRecordsStore', () => ({ useRecordRecent: () => {} }))
vi.mock('../../theme/icons', () => ({
  UI_ICONS: new Proxy({}, { get: () => () => null }),
}))
vi.mock('../../theme/tokens', () => ({
  RADIUS: {},
  TABULAR: {},
  TYPE: new Proxy({}, { get: () => ({}) }),
  useTokens: () => new Proxy({}, { get: (_, key) => String(key) }),
}))
vi.mock('../../ui/card', () => ({
  Card: ({ children }: { children: ReactNode }) => children,
}))
vi.mock('./assignee', () => ({ AssigneeRow: () => null }))
vi.mock('./components', () => ({
  Checkbox: () => null,
  Chip: () => null,
  priorityColor: () => undefined,
}))
vi.mock('./detailWords', () => ({ detailWords: () => ({}) }))
vi.mock('./GroceryFields', () => ({ GroceryFields: () => null }))
vi.mock('./icons', () => ({
  TASK_ICONS: new Proxy({}, { get: () => () => null }),
}))
vi.mock('./reminder', () => ({ reminderLabel: () => '' }))
vi.mock('./SubtaskSection', () => ({ SubtaskSection: () => null }))
vi.mock('./store', () => ({
  useTaskOf: () => ({
    today: '2026-11-25',
    lists: [
      { id: 'one', name: 'One', provider: 'todoist', kind: 'plain', writable: true },
    ],
    tasks: [],
    task: {
      id: 'a',
      listId: 'one',
      linked: true,
      title: 'Old',
      done: false,
      labels: [],
      order: 0,
    },
  }),
  useTaskActions: () => ({ renameTask: state.renameTask }),
}))
vi.mock('./taskMenu', () => ({ useTaskSheets: () => ({ sheets: null }) }))
vi.mock('./WishlistFields', () => ({ WishlistFields: () => null }))
vi.mock('./writeFailed', () => ({ useWriteFailed: () => state.writeFailed }))

test('a refused title stays in the field and a blur sends it again', async () => {
  const refusal = new Error('refused')
  state.renameTask.mockRejectedValueOnce(refusal).mockResolvedValue(undefined)
  const view = mount(<TaskDetail taskId="a" />)
  const field = view.container.querySelector(
    '[data-testid="detail-title"]',
  ) as HTMLTextAreaElement
  const blur = () =>
    act(() => {
      field.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    })
  act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      'value',
    )?.set?.call(field, 'New')
    field.dispatchEvent(new Event('input', { bubbles: true }))
  })
  blur()
  await settle()
  expect(state.writeFailed).toHaveBeenCalledWith(refusal)
  expect(field.value).toBe('New')
  blur()
  await settle()
  expect(state.renameTask.mock.calls.map(([, title]) => title)).toEqual([
    'New',
    'New',
  ])
  view.unmount()
})
