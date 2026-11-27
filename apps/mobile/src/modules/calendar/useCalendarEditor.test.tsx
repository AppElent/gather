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

type Editor = ReturnType<typeof import('./useCalendarEditor').useCalendarEditor>
const state = vi.hoisted(() => ({
  write: vi.fn(),
  /** What is on disk: the one draft per user and Group. */
  stored: null as unknown,
  saving: null as null | (() => void),
  editor: null as null | Editor,
}))

vi.mock('convex/react', () => ({
  useMutation: () => () =>
    new Promise<void>((resolve) => {
      state.saving = resolve
    }),
}))
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
  readCalendarDraft: () => state.stored,
  writeCalendarDraft: (draft: unknown) => {
    state.write(draft)
    state.stored = draft
  },
  clearCalendarDraft: () => {
    state.stored = null
  },
}))

function Probe() {
  state.editor = useCalendarEditor()
  return null
}

beforeEach(() => {
  state.write.mockClear()
  state.stored = null
  state.saving = null
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

/** A draft on disk, as the 250 ms write leaves it, read by a screen that mounts. */
async function keepDraft(title: string) {
  const first = mount(createElement(Probe))
  typeTitle(title)
  act(() => void vi.advanceTimersByTime(250))
  first.unmount()
  state.write.mockClear()
  return state.stored
}

test('a restored draft is not written again when the screen goes', async () => {
  await keepDraft('Dentist')
  const view = mount(createElement(Probe))
  expect(state.editor?.draft?.values.title).toBe('Dentist')
  // Something else saved it meanwhile and the store was cleared.
  state.stored = null
  view.unmount()
  expect(state.write).not.toHaveBeenCalled()
  expect(state.stored).toBeNull()
})

test('a screen that went does not write over a newer draft', async () => {
  await keepDraft('Dentist')
  const view = mount(createElement(Probe))
  const newer = { draftId: 'create:newer', values: { title: 'Newer' } }
  state.stored = newer
  view.unmount()
  expect(state.stored).toBe(newer)
})

test('a draft saved just before the screen went does not come back', async () => {
  const view = mount(createElement(Probe))
  typeTitle('Dentist')
  await act(async () => {
    void state.editor?.save()
  })
  expect(state.editor?.draft?.status).toBe('saving')
  // The person moves on while the save is on its way.
  view.unmount()
  await act(async () => state.saving?.())
  expect(state.stored).toBeNull()
  // The next screen finds nothing to restore, and leaves nothing behind.
  const next = mount(createElement(Probe))
  expect(state.editor?.draft).toBeNull()
  next.unmount()
  expect(state.stored).toBeNull()
})

test('a draft saved after another screen restored it is not brought back by that screen', async () => {
  await keepDraft('Dentist')
  const other = mount(createElement(Probe))
  state.stored = null
  other.unmount()
  expect(state.stored).toBeNull()
})
