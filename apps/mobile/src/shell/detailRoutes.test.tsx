// @vitest-environment jsdom
/**
 * A detail route that gets another record's id starts its screen over, or text
 * still being typed in one record could be saved to the other. The router
 * pushes a second route today; the key keeps that from being what data rests on
 * (APP-774).
 */
import { useState } from 'react'
import { expect, test, vi } from 'vitest'

import AllEvent from '../../app/(app)/(tabs)/all/calendar/[eventId]'
import AllTask from '../../app/(app)/(tabs)/all/tasks/task/[taskId]'
import SearchEvent from '../../app/(app)/(tabs)/search/calendar/[eventId]'
import SearchTask from '../../app/(app)/(tabs)/search/tasks/task/[taskId]'
import { mount } from '../testing/dom'

const state = vi.hoisted(() => ({ id: 'a' }))

vi.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ taskId: state.id, eventId: state.id }),
}))
/** Shows the id it mounted with. */
function Screen({ taskId, eventId }: { taskId?: string; eventId?: string }) {
  const [first] = useState(taskId ?? eventId)
  return first
}
vi.mock('../modules/tasks/TaskDetailScreen', () => ({
  TaskDetail: (props: { taskId: string }) => Screen(props),
}))
vi.mock('../modules/calendar/CalendarEventScreen', () => ({
  CalendarEventScreen: (props: { eventId: string }) => Screen(props),
}))

test.each([
  ['task', AllTask],
  ['event', AllEvent],
  ['searched task', SearchTask],
  ['searched event', SearchEvent],
])('another %s starts the screen over', (_, Route) => {
  state.id = 'a'
  const view = mount(<Route />)
  state.id = 'b'
  view.rerender(<Route />)
  expect(view.container.textContent).toBe('b')
  view.unmount()
})
