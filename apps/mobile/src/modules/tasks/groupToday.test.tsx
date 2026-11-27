// @vitest-environment jsdom
/**
 * The day an open screen reads moves on at the Group's midnight (APP-991): a
 * repeating grocery item waiting for today comes back, and the Tasks index asks
 * `tasks.openCounts` again with the new day, without any row changing.
 */
import { onShoppingList } from '@gather/core/grocery-list'
import { getFunctionName } from 'convex/server'
import { act } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { mount } from '../../testing/dom'

const asked = vi.hoisted(() => ({ openCounts: [] as unknown[] }))

vi.mock('../../group/GroupProvider', () => ({
  useGroup: () => ({
    group: { slug: 'our-household', timeZone: 'Europe/Amsterdam' },
  }),
}))
vi.mock('convex/react', () => ({
  useAction: () => vi.fn(),
  useConvex: () => ({}),
  useMutation: () => Object.assign(vi.fn(), { withOptimisticUpdate: vi.fn() }),
}))
vi.mock('../../convex/queries', () => ({
  useQuery: (
    reference: Parameters<typeof getFunctionName>[0],
    args: unknown,
  ) => {
    if (getFunctionName(reference) === 'tasks:openCounts')
      asked.openCounts.push(args)
    return undefined
  },
  useQueries: () => ({}),
}))

import { useGroupToday, useTaskIndex } from './store'

beforeEach(() => {
  asked.openCounts.length = 0
  vi.useFakeTimers()
  // 23:59 in Amsterdam.
  vi.setSystemTime(new Date('2026-11-27T22:59:00Z'))
})
afterEach(() => vi.useRealTimers())

const coffee = {
  done: false,
  repeat: { mode: 'afterDone', every: 1, unit: 'week' },
  dueDate: '2026-11-28',
}

test('an open screen sees the waiting item come back at midnight', () => {
  const seen: boolean[] = []
  function Shopping() {
    seen.push(onShoppingList(coffee, useGroupToday()))
    useTaskIndex()
    return null
  }
  const screen = mount(<Shopping />)
  expect(seen.at(-1)).toBe(false)
  expect(asked.openCounts.at(-1)).toEqual({
    groupSlug: 'our-household',
    today: '2026-11-27',
  })
  const renders = seen.length
  // Within the day the minute check does not re-render the screen.
  act(() => vi.advanceTimersByTime(30_000))
  expect(seen.length).toBe(renders)
  act(() => vi.advanceTimersByTime(60_000))
  expect(seen.at(-1)).toBe(true)
  expect(asked.openCounts.at(-1)).toEqual({
    groupSlug: 'our-household',
    today: '2026-11-28',
  })
  screen.unmount()
})
