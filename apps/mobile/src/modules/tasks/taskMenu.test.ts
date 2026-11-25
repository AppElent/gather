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
vi.mock('./store', () => ({ onOccurrenceCompleted: vi.fn(), useTaskActions: vi.fn() }))
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
