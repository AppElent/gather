// @vitest-environment jsdom
/**
 * Quick add left open past the Group's midnight reads the new day (APP-1001):
 * "tomorrow" typed at 00:01 is the day after the new today, not today.
 */
import { act } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { mount } from '../../testing/dom'

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
  useQuery: () => undefined,
  useQueries: () => ({}),
}))
vi.mock('react-native', () => ({
  StyleSheet: { create: (s: unknown) => s },
  Pressable: 'button',
  Text: 'span',
  TextInput: 'input',
  View: 'div',
}))
vi.mock('../../i18n', async () => {
  const { en } = await import('../../i18n/messages/en')
  return {
    useI18n: () => ({ t: en, locale: 'en' }),
    fmt: (text: string) => text,
  }
})
vi.mock('../../theme/icons', () => ({ UI_ICONS: {} }))
vi.mock('../../theme/tokens', () => ({ TYPE: {}, useTokens: () => ({}) }))
vi.mock('./icons', () => ({ TASK_ICONS: {} }))
vi.mock('./assignee', () => ({ useTaskPeople: () => ({ people: [] }) }))

import { useQuickAddLine } from './QuickAddParts'

beforeEach(() => {
  vi.useFakeTimers()
  // 23:59 in Amsterdam.
  vi.setSystemTime(new Date('2026-11-27T22:59:00Z'))
})
afterEach(() => vi.useRealTimers())

test('an idle quick add moves on to the new day at midnight', () => {
  const seen: { today: string; due?: string }[] = []
  function Field() {
    const line = useQuickAddLine(true, { line: 'Bread tomorrow', dismissed: [] })
    seen.push({ today: line.today, due: line.parsed.dueDate })
    return null
  }
  const screen = mount(<Field />)
  expect(seen.at(-1)).toEqual({ today: '2026-11-27', due: '2026-11-28' })
  act(() => vi.advanceTimersByTime(90_000))
  expect(seen.at(-1)).toEqual({ today: '2026-11-28', due: '2026-11-29' })
  screen.unmount()
})
