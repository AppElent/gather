import { expect, test, vi } from 'vitest'

import { en } from '../../i18n/messages/en'
import { taskMenuActions } from './taskMenu'
import type { Task } from './types'

vi.mock('expo-router', () => ({ useIsFocused: vi.fn() }))
vi.mock('../../feedback/confirmDestructive', () => ({ confirmDestructive: vi.fn() }))
vi.mock('../../feedback/haptics', () => ({ haptics: {} }))
vi.mock('../../group/GroupProvider', () => ({ useGroup: vi.fn() }))
vi.mock('../../i18n', () => ({ fmt: vi.fn(), useI18n: vi.fn() }))
vi.mock('../../ui/undo-toast', () => ({ useUndoToast: vi.fn() }))
vi.mock('./completeTask', () => ({ useCompleteTask: vi.fn() }))
vi.mock('./ReminderSheet', () => ({ ReminderSheet: vi.fn() }))
vi.mock('./RepeatSheet', () => ({ RepeatSheet: vi.fn() }))
vi.mock('./sections', () => ({ MoveToSectionSheet: vi.fn() }))
vi.mock('./sheets', () => ({}))
vi.mock('./store', () => ({ onMoved: vi.fn(),
  onOccurrenceCompleted: vi.fn(),
  takeMove: vi.fn(), useTaskActions: vi.fn() }))
vi.mock('./taskDates', () => ({ dueLabel: vi.fn() }))
vi.mock('./writeFailed', () => ({ useWriteFailed: vi.fn() }))

const deleteHidden = (linked: boolean) =>
  taskMenuActions({ id: 'a', title: 'a', done: false, linked } as Task, en, {
    writable: true,
    reorder: false,
  }).find((action) => action.id === 'delete')?.attributes?.hidden

test('a linked task has no delete, a local one does', () => {
  expect(deleteHidden(true)).toBe(true)
  expect(deleteHidden(false)).toBe(false)
})

test('Move to list is on a linked task too, after Move under, unless it cannot be written', () => {
  const menu = (writable: boolean, done = false, linked = true) => {
    const actions = taskMenuActions(
      { id: 'a', title: 'a', done, linked, parentTaskId: 'p' } as Task,
      en,
      { writable, reorder: false },
    )
    const at = actions.findIndex((action) => action.id === 'move')
    expect(actions[at - 1].id).toBe('under')
    expect(actions[at].attributes?.hidden).toBeFalsy()
    return actions[at].attributes?.disabled
  }
  expect(menu(true)).toBe(false)
  expect(menu(false)).toBe(true)
  expect(menu(true, true)).toBe(true)
  expect(menu(false, true, false)).toBe(false)
})
