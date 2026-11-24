import { fireEvent, screen, waitFor } from '@testing-library/react'
import { getFunctionName } from 'convex/server'
import { beforeEach, expect, test, vi } from 'vitest'
import type { Id } from '../../../convex/_generated/dataModel'
import { renderWithI18n } from '../../lib/i18n/testing'
import { LocalTaskList } from './LocalTaskList'

const { data, toggleDone } = vi.hoisted(() => ({
  data: { tasks: [] as object[] },
  toggleDone: vi.fn(),
}))

vi.mock('convex/react', () => ({
  useQuery: () => data.tasks,
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(reference) === 'tasks:toggleDone' ? toggleDone : vi.fn(),
}))

const parent = { _id: 'p', title: 'Pack', done: false, order: 1 }
const step = {
  _id: 's',
  title: 'Socks',
  done: false,
  order: 2,
  parentTaskId: 'p',
}

function tick(tasks: object[], title: string) {
  data.tasks = tasks
  renderWithI18n(
    <LocalTaskList
      listId={'list' as Id<'taskLists'>}
      groupSlug="home"
      name="Trip"
      onRemoveList={() => {}}
    />,
  )
  fireEvent.click(screen.getByLabelText(`Toggle ${title}`))
}

beforeEach(() => {
  toggleDone.mockReset().mockResolvedValue(null)
})

test('"Only this" completes the parent and leaves its subtasks', async () => {
  tick([parent, step], 'Pack')
  expect(toggleDone).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Only this' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(toggleDone.mock.calls).toEqual([[{ taskId: 'p', groupSlug: 'home' }]])
})

test('"Complete all" completes the subtasks with it', async () => {
  tick([parent, step], 'Pack')
  fireEvent.click(screen.getByRole('button', { name: 'Complete all' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(toggleDone.mock.calls).toEqual([
    [{ taskId: 'p', groupSlug: 'home', withSubtasks: true }],
  ])
})

test('Cancel changes nothing', () => {
  tick([parent, step], 'Pack')
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(toggleDone).not.toHaveBeenCalled()
})

test.each([
  // As on the phone: the next occurrence reopens the subtasks either way.
  ['a repeating parent', [{ ...parent, repeat: { every: 1, unit: 'week' } }, step]],
  ['a parent whose subtasks are done', [parent, { ...step, done: true }]],
  ['a done parent', [{ ...parent, done: true }, step]],
])('%s asks nothing', (_name, tasks) => {
  tick(tasks, 'Pack')
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(toggleDone.mock.calls).toEqual([[{ taskId: 'p', groupSlug: 'home' }]])
})
