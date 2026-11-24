// @vitest-environment jsdom
/** A planner on the current week follows the Group's zone (APP-814). */
import { act, createElement } from 'react'
import { afterEach, expect, test, vi } from 'vitest'

import { mount } from '../../../testing/dom'
import { useGroupWeek } from './use-group-week'

const state = vi.hoisted(() => ({
  timeZone: undefined as string | undefined,
  page: (_weekStart: string) => {},
}))
vi.mock('../../../group/GroupProvider', () => ({
  useGroup: () => ({ group: { timeZone: state.timeZone } }),
}))

function Week() {
  const [weekStart, setWeekStart] = useGroupWeek()
  state.page = setWeekStart
  return weekStart
}

afterEach(() => vi.useRealTimers())

test('moves from the current week, and leaves one paged to', () => {
  // Sunday the 29th in UTC, Monday the 30th at UTC+14.
  vi.useFakeTimers({ now: new Date('2026-11-29T10:30:00Z') })
  state.timeZone = 'Europe/Amsterdam'
  const { container, rerender } = mount(createElement(Week))
  expect(container.textContent).toBe('2026-11-23')
  state.timeZone = 'Pacific/Kiritimati'
  rerender(createElement(Week))
  expect(container.textContent).toBe('2026-11-30')

  act(() => state.page('2026-12-14'))
  state.timeZone = 'Europe/Amsterdam'
  rerender(createElement(Week))
  expect(container.textContent).toBe('2026-12-14')
})
