// @vitest-environment jsdom
/** A held task's sheet, for a project linked to two lists (APP-839). */
import { act } from 'react'
import { expect, test, vi } from 'vitest'

import { mount } from '../../testing/dom'
import { useTaskSheets } from './taskMenu'
import type { Task } from './types'

vi.mock('expo-router', () => ({ useIsFocused: () => false }))
vi.mock('../../feedback/confirmDestructive', () => ({ confirmDestructive: vi.fn() }))
vi.mock('../../feedback/haptics', () => ({ haptics: {} }))
vi.mock('../../group/GroupProvider', () => ({ useGroup: () => ({ group: {} }) }))
vi.mock('../../i18n', async () => {
  const { en: t } = await import('../../i18n/messages/en')
  return { fmt: (text: string) => text, useI18n: () => ({ t, locale: 'en' }) }
})
vi.mock('../../ui/undo-toast', () => ({
  useUndoToast: () => ({ show: vi.fn(), toast: null }),
}))
vi.mock('./completeTask', () => ({ useCompleteTask: vi.fn() }))
vi.mock('./ReminderSheet', () => ({ ReminderSheet: vi.fn() }))
vi.mock('./RepeatSheet', () => ({ RepeatSheet: vi.fn() }))
vi.mock('./sections', () => ({ MoveToSectionSheet: vi.fn() }))
vi.mock('./sheets', () => ({
  DueDateSheet: ({ task }: { task: Task }) => `due in ${task.listId}`,
}))
vi.mock('./store', () => ({
  onOccurrenceCompleted: vi.fn(),
  useTaskActions: () => ({}),
}))
vi.mock('./taskDates', () => ({ dueLabel: vi.fn() }))
vi.mock('./writeFailed', () => ({ useWriteFailed: vi.fn() }))

const row = (listId: string, linked?: true) =>
  ({ id: 'a', title: 'a', done: false, labels: [], order: 0, listId, linked }) as Task

function screen(start: Task[]) {
  let onAction = (_task: Task, _action: string) => {}
  function Screen({ tasks }: { tasks: Task[] }) {
    const sheets = useTaskSheets({ tasks })
    onAction = sheets.onAction
    return sheets.sheets
  }
  const view = mount(<Screen tasks={start} />)
  return {
    hold: (task: Task) => act(() => onAction(task, 'due')),
    shows: (tasks: Task[]) => view.rerender(<Screen tasks={tasks} />),
    text: () => view.container.textContent,
    unmount: view.unmount,
  }
}

test('its sheet is for the list that was held', () => {
  const rows = [row('one', true), row('two', true)]
  const { hold, shows, text, unmount } = screen(rows)
  hold(rows[1])
  expect(text()).toBe('due in two')
  hold(rows[0])
  expect(text()).toBe('due in one')
  // Gone from that list, it does not turn into the other list's task.
  shows([rows[1]])
  expect(text()).toBe('')
  unmount()
})

test("a local task's sheet follows it to another list", () => {
  const { hold, shows, text, unmount } = screen([row('one')])
  hold(row('one'))
  shows([row('two')])
  expect(text()).toBe('due in two')
  unmount()
})
