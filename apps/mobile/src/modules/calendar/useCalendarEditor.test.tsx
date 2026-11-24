// @vitest-environment jsdom
/**
 * The event editor writes its draft 250 ms after the last change; a screen that
 * goes inside that time writes it on the way out, or the last typing is lost
 * (APP-817).
 */
import { act, createElement } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { mount } from '../../testing/dom'
import { useCalendarEditor } from './useCalendarEditor'

const state = vi.hoisted(() => ({
  write: vi.fn(),
  editor: null as null | ReturnType<typeof import('./useCalendarEditor').useCalendarEditor>,
}))

vi.mock('convex/react', () => ({ useMutation: () => vi.fn() }))
vi.mock('../../availability/AvailabilityProvider', () => ({
  useAvailability: () => ({ serviceActionsEnabled: true }),
}))
vi.mock('../../convex/api', () => ({
  api: new Proxy({}, { get: () => new Proxy({}, { get: (_, key) => key }) }),
}))
vi.mock('../../convex/queries', () => ({ useQuery: () => ({ _id: 'u1' }) }))
vi.mock('../../feedback/haptics', () => ({
  haptics: { itemSaved: () => {}, actionFailed: () => {} },
}))
vi.mock('../../group/GroupProvider', () => ({
  useGroup: () => ({ group: { _id: 'g1', slug: 'home' } }),
}))
vi.mock('./calendarDraftStore', () => ({
  readCalendarDraft: () => null,
  writeCalendarDraft: state.write,
  clearCalendarDraft: () => {},
}))

function Probe() {
  state.editor = useCalendarEditor()
  return null
}

beforeEach(() => {
  state.write.mockClear()
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

function typeTitle(title: string) {
  act(() => state.editor?.openNew('2026-11-23', 'c1'))
  act(() => state.editor?.changeField('title', title))
}

test('the draft is written 250 ms after the last change', () => {
  const view = mount(createElement(Probe))
  typeTitle('Dentist')
  expect(state.write).not.toHaveBeenCalled()
  act(() => void vi.advanceTimersByTime(250))
  expect(state.write).toHaveBeenCalledOnce()
  view.unmount()
})

test('a screen that goes first writes it on the way out', () => {
  const view = mount(createElement(Probe))
  typeTitle('Dentist')
  view.unmount()
  expect(state.write).toHaveBeenCalledOnce()
  expect(state.write.mock.calls[0]?.[0]).toMatchObject({
    values: { title: 'Dentist' },
  })
})

test('nothing typed, nothing written', () => {
  const view = mount(createElement(Probe))
  act(() => state.editor?.openNew('2026-11-23', 'c1'))
  view.unmount()
  expect(state.write).not.toHaveBeenCalled()
})
