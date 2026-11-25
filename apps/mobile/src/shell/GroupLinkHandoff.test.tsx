// @vitest-environment jsdom
/**
 * A tapped notification goes back to the tabs that are already mounted, at its
 * record, instead of replacing itself with a second tabs layout (APP-775,
 * APP-817). This checks the call made to the router, not the resulting stack:
 * the stack is expo-router's, and not something a Node test can build.
 */
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { mount } from '../testing/dom'
import { GroupLinkHandoff } from './GroupLinkHandoff'
import { rememberGroupLink } from './pendingGroupLink'

const state = vi.hoisted(() => ({
  dismissTo: vi.fn(),
  replace: vi.fn(),
  openInGroup: vi.fn(),
}))

vi.mock('expo-router', () => ({
  router: { dismissTo: state.dismissTo, replace: state.replace },
}))
vi.mock('../group/GroupProvider', () => ({
  useGroup: () => ({ groups: [{ _id: 'g1', slug: 'home' }] }),
  useOpenInGroup: () => state.openInGroup,
}))

beforeEach(() => {
  state.dismissTo.mockClear()
  state.replace.mockClear()
  state.openInGroup.mockReset()
  state.openInGroup.mockImplementation((_group: string, go: () => void) => go())
})

afterEach(() => {
  document.body.innerHTML = ''
})

test('a notification for an event goes back to the mounted tabs, at the event, with its anchor', () => {
  rememberGroupLink({ groupSlug: 'home', segments: ['calendar', 'e1'] })
  mount(<GroupLinkHandoff />)
  expect(state.openInGroup).toHaveBeenCalledWith('g1', expect.any(Function))
  expect(state.dismissTo).toHaveBeenCalledExactlyOnceWith(
    { pathname: '/all/calendar/[eventId]', params: { eventId: 'e1' } },
    { withAnchor: true },
  )
  expect(state.replace).not.toHaveBeenCalled()
})

test('a task goes to its own screen the same way', () => {
  rememberGroupLink({ groupSlug: 'home', segments: ['tasks', 'task', 't1'] })
  mount(<GroupLinkHandoff />)
  expect(state.dismissTo).toHaveBeenCalledExactlyOnceWith(
    { pathname: '/all/tasks/task/[taskId]', params: { taskId: 't1' } },
    { withAnchor: true },
  )
})

test('a link for a Group that is not theirs goes back to Home and changes nothing', () => {
  rememberGroupLink({ groupSlug: 'other', segments: ['calendar', 'e1'] })
  mount(<GroupLinkHandoff />)
  expect(state.openInGroup).not.toHaveBeenCalled()
  expect(state.dismissTo).toHaveBeenCalledExactlyOnceWith('/home')
})
