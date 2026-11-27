// @vitest-environment jsdom
/** The Who row on a linked Todoist list (APP-405). */
import type { Assignable } from '@gather/core/task-lists'
import { createElement, type ReactNode } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'

import { mount, settle } from '../../testing/dom'
import { AssigneeRow } from './assignee'
import type { Task, TaskList } from './types'

interface MenuProps {
  actions: { id: string; title: string; state: 'on' | 'off' }[]
  onPressAction: (event: { nativeEvent: { event: string } }) => void
  children?: ReactNode
}

const seen = vi.hoisted(() => ({
  menu: undefined as unknown,
  setAssignee: vi.fn(),
  writeFailed: vi.fn(),
}))

vi.mock('react-native', () => {
  const dom = ({ children }: { children?: ReactNode }) =>
    createElement('div', null, children)
  return {
    View: dom,
    Text: dom,
    StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  }
})
vi.mock('@expo/ui/community/menu', () => ({
  MenuView: (props: MenuProps) => {
    seen.menu = props
    return createElement('div', null, props.children)
  },
}))
vi.mock('../../convex/queries', () => ({
  useQuery: () => [
    { userId: 'u1', name: 'Eva' },
    { userId: 'u2', name: 'Sam' },
  ],
}))
vi.mock('../../feedback/haptics', () => ({
  haptics: new Proxy({}, { get: () => () => {} }),
}))
vi.mock('../../group/GroupProvider', () => ({
  useGroup: () => ({ group: { slug: 'home' } }),
}))
vi.mock('../../i18n', async () => {
  const { en } = await import('../../i18n/messages/en')
  const { fmt } = await import('@gather/core/i18n')
  return { fmt, useI18n: () => ({ t: en, locale: 'en' }) }
})
vi.mock('../../observability/native-presentation', () => ({
  showAlert: () => {},
}))
vi.mock('../../theme/icons', () => ({
  UI_ICONS: new Proxy({}, { get: () => () => null }),
}))
vi.mock('../../theme/tokens', () => ({
  SIZE: new Proxy({}, { get: () => 44 }),
  SPACE: [0, 4, 8, 12, 16, 20, 24],
  TYPE: new Proxy({}, { get: () => ({}) }),
  useTokens: () => ({}),
}))
vi.mock('./store', () => ({
  useTaskActions: () => ({ setAssignee: seen.setAssignee }),
}))
vi.mock('./writeFailed', () => ({ useWriteFailed: () => seen.writeFailed }))

const menu = () => seen.menu as MenuProps | undefined
const task = (more: Partial<Task> = {}): Task => ({
  id: 't1',
  listId: 'l1',
  linked: true,
  title: 'Call plumber',
  done: false,
  order: 0,
  labels: [],
  ...more,
})
const show = (assignable: Assignable | undefined, more?: Partial<Task>) =>
  mount(
    <AssigneeRow
      task={task(more)}
      list={{ provider: 'todoist', writable: true, assignable } as TaskList}
    />,
  ).container.textContent

beforeEach(() => {
  seen.menu = undefined
  seen.setAssignee.mockReset().mockResolvedValue(undefined)
  seen.writeFailed.mockReset()
})

test('offers the Members in the project and Nobody, and says why a write failed', async () => {
  show({ shared: true, memberIds: ['u2'] })
  expect(menu()?.actions).toEqual([
    { id: 'u2', title: 'Sam', state: 'off' },
    { id: '__nobody__', title: 'Nobody', state: 'on' },
  ])
  const refused = new Error('refused')
  seen.setAssignee.mockRejectedValue(refused)
  menu()?.onPressAction({ nativeEvent: { event: 'u2' } })
  await settle()
  expect(seen.setAssignee).toHaveBeenCalledWith(task(), 'u2')
  expect(seen.writeFailed).toHaveBeenCalledWith(refused)
})

test('names someone who is no Member, and Nobody clears them', () => {
  const bob = { assigneeName: 'Bob' }
  expect(show({ shared: true, memberIds: ['u2'] }, bob)).toContain('Bob')
  expect(menu()?.actions.map((each) => each.state)).toEqual(['off', 'off'])
  menu()?.onPressAction({ nativeEvent: { event: '__nobody__' } })
  expect(seen.setAssignee).toHaveBeenCalledWith(task(bob), null)
})

test.each([
  [undefined, 'cannot do that right now'],
  [{ shared: false, memberIds: [] }, 'Only a shared Todoist project'],
  [{ shared: true, memberIds: [] }, 'recognised'],
])('with %j it is off and says why', (assignable, reason) => {
  expect(show(assignable)).toContain(reason)
  expect(menu()).toBeUndefined()
})
