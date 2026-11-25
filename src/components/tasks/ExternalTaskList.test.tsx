import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { getFunctionName } from 'convex/server'
import { beforeEach, expect, test, vi } from 'vitest'
import type { Id } from '../../../convex/_generated/dataModel'
import { renderWithI18n } from '../../lib/i18n/testing'
import { ExternalTaskList } from './ExternalTaskList'

const { connection, connectionListeners, getTasks, writeTask } = vi.hoisted(() => ({
  connection: { isWebSocketConnected: true },
  connectionListeners: new Set<() => void>(),
  getTasks: vi.fn(),
  writeTask: vi.fn(),
}))

// One client for every render, as the provider gives.
const convex = {
  connectionState: () => connection,
  subscribeToConnectionState: (listener: () => void) => {
    connectionListeners.add(listener)
    return () => connectionListeners.delete(listener)
  },
}

vi.mock('convex/react', () => ({
  useConvex: () => convex,
  useAction: (reference: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(reference) === 'taskLists:getTasks' ? getTasks : writeTask,
}))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}))

const parent = { externalId: 'p', title: 'Pack', done: false }
const step = {
  externalId: 's',
  title: 'Socks',
  done: false,
  parentExternalId: 'p',
}

function renderList(writes = true) {
  renderWithI18n(
    <ExternalTaskList
      listId={'list' as Id<'taskLists'>}
      groupSlug="home"
      name="Trip"
      provider={writes ? 'todoist' : 'notion'}
      writes={writes}
      onRemoveList={() => {}}
    />,
  )
}

beforeEach(() => {
  getTasks.mockReset().mockResolvedValue({ status: 'ok', tasks: [parent, step] })
  writeTask.mockReset()
  connection.isWebSocketConnected = true
})

const add = (title: string) => {
  const field = screen.getByLabelText('New task in Trip')
  fireEvent.change(field, { target: { value: title } })
  fireEvent.submit(field.closest('form') as HTMLFormElement)
}

test('Notion shows no way to write', async () => {
  renderList(false)
  await screen.findByText('Pack')
  expect(screen.queryByLabelText('New task in Trip')).toBeNull()
  expect(screen.queryByLabelText('Edit Pack')).toBeNull()
  for (const box of screen.getAllByRole('checkbox')) expect(box).toBeDisabled()
})

test('a linked task has no delete', async () => {
  renderList()
  await screen.findByLabelText('Edit Pack')
  expect(screen.queryByLabelText('Delete Pack')).toBeNull()
})

test('an added task shows once Todoist took it', async () => {
  writeTask.mockResolvedValue({
    status: 'ok',
    tasks: [{ externalId: 'n', title: 'Hat', done: false }],
    refresh: false,
  })
  renderList()
  await screen.findByText('Pack')
  add('Hat')
  expect(screen.queryByText('Hat')).toBeNull()
  await screen.findByText('Hat')
  expect(writeTask).toHaveBeenCalledWith({
    listId: 'list',
    groupSlug: 'home',
    write: { kind: 'create', title: 'Hat', requestKey: expect.any(String) },
  })
})

test('a read-only connection is asked to reconnect and nothing changes', async () => {
  writeTask.mockResolvedValue({ status: 'reconnect', provider: 'todoist' })
  renderList()
  await screen.findByText('Pack')
  add('Hat')
  await screen.findByText(/needs to be reconnected/)
  expect(screen.getByText('Socks')).toBeInTheDocument()
  expect(screen.getByLabelText('New task in Trip')).toHaveValue('Hat')
})

test('a failure says so, keeps the title and loads what Todoist has', async () => {
  writeTask.mockRejectedValue(new Error('offline'))
  renderList()
  await screen.findByText('Pack')
  add('Hat')
  await screen.findByRole('alert')
  await waitFor(() => expect(getTasks).toHaveBeenCalledTimes(2))
  expect(screen.getByLabelText('New task in Trip')).toHaveValue('Hat')
  expect(screen.queryByText('Hat')).toBeNull()
})

test('offline nothing is sent, the title stays and the list is read-only', async () => {
  renderList()
  await screen.findByText('Pack')
  connection.isWebSocketConnected = false
  add('Hat')
  expect(await screen.findByRole('alert')).toHaveTextContent(/offline/)
  expect(writeTask).not.toHaveBeenCalled()
  expect(screen.getByLabelText('New task in Trip')).toHaveValue('Hat')
  for (const box of screen.getAllByRole('checkbox')) expect(box).toBeDisabled()
})

test('after an offline refusal the list is read again once back online', async () => {
  renderList()
  await screen.findByText('Pack')
  connection.isWebSocketConnected = false
  add('Hat')
  await screen.findByRole('alert')
  const reconnect = async (online: boolean) => {
    connection.isWebSocketConnected = online
    await act(async () => {
      for (const listener of connectionListeners) listener()
    })
  }
  await reconnect(false)
  expect(getTasks).toHaveBeenCalledTimes(1)
  await reconnect(true)
  expect(getTasks).toHaveBeenCalledTimes(2)
  for (const box of screen.getAllByRole('checkbox')) expect(box).toBeEnabled()
  expect(screen.queryByRole('alert')).toBeNull()
  expect(screen.getByLabelText('New task in Trip')).toHaveValue('Hat')
  // Once per refusal: not on every reconnect.
  await reconnect(true)
  expect(getTasks).toHaveBeenCalledTimes(2)
})

test('a refused edit keeps the typed title', async () => {
  writeTask.mockResolvedValue({ status: 'error', reason: 'failed' })
  renderList()
  fireEvent.click(await screen.findByLabelText('Edit Pack'))
  const field = screen.getByDisplayValue('Pack')
  fireEvent.change(field, { target: { value: 'Pack light' } })
  fireEvent.submit(field.closest('form') as HTMLFormElement)
  await screen.findByRole('alert')
  await waitFor(() => expect(getTasks).toHaveBeenCalledTimes(2))
  expect(screen.getByDisplayValue('Pack light')).toBeInTheDocument()
})

test('a late write gives up with an error, read-only until it is answered', async () => {
  renderList()
  await screen.findByText('Pack')
  vi.useFakeTimers()
  try {
    let answer = (_: unknown) => {}
    writeTask.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)))
    add('Hat')
    await act(() => vi.advanceTimersByTimeAsync(30_000))
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByLabelText('New task in Trip')).toHaveValue('Hat')
    for (const box of screen.getAllByRole('checkbox')) expect(box).toBeDisabled()
    await act(async () => answer({ status: 'ok', tasks: [], refresh: true }))
    expect(getTasks).toHaveBeenCalledTimes(2)
    for (const box of screen.getAllByRole('checkbox')) expect(box).toBeEnabled()
    // The same title again carries the same key.
    writeTask.mockResolvedValue({ status: 'ok', tasks: [], refresh: false })
    add('Hat')
    const [first, second] = writeTask.mock.calls.map(([sent]) => sent.write)
    expect(second.requestKey).toBe(first.requestKey)
    await act(() => vi.advanceTimersByTimeAsync(0))
  } finally {
    vi.useRealTimers()
  }
})

test('a subtask with subtasks, or below one, can be moved to the top', async () => {
  const nested = { ...step, externalId: 'n', title: 'Wool', parentExternalId: 's' }
  getTasks.mockResolvedValue({ status: 'ok', tasks: [parent, step, nested] })
  writeTask.mockResolvedValue({ status: 'ok', tasks: [], refresh: false })
  renderList()
  await screen.findByText('Wool')
  for (const [title, id] of [['Socks', 's'], ['Wool', 'n']]) {
    fireEvent.click(screen.getByLabelText(`Edit ${title}`))
    fireEvent.change(screen.getByLabelText('Move under a task…'), {
      target: { value: '' },
    })
    await waitFor(() =>
      expect(writeTask).toHaveBeenLastCalledWith(
        expect.objectContaining({
          write: { kind: 'move', taskId: id, parentId: null },
        }),
      ),
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
  }
})

test('completing a parent asks, and completes its subtasks', async () => {
  writeTask.mockResolvedValue({ status: 'ok', tasks: [], refresh: false })
  renderList()
  await screen.findByText('Pack')
  fireEvent.click(screen.getByLabelText('Toggle Pack'))
  expect(writeTask).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Complete all' }))
  await waitFor(() => expect(screen.getByLabelText('Toggle Socks')).toBeChecked())
  expect(writeTask.mock.calls[0][0].write).toEqual({
    kind: 'setDone',
    taskId: 'p',
    done: true,
    withSubtasks: true,
    requestKey: expect.any(String),
  })
})

test('Complete all retried carries the same key until Todoist took it', async () => {
  const completeAll = async (times: number) => {
    await waitFor(() => expect(screen.getByLabelText('Toggle Pack')).toBeEnabled())
    fireEvent.click(screen.getByLabelText('Toggle Pack'))
    fireEvent.click(screen.getByRole('button', { name: 'Complete all' }))
    await waitFor(() => expect(writeTask).toHaveBeenCalledTimes(times))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  }
  renderList()
  await screen.findByText('Pack')
  writeTask.mockResolvedValue({ status: 'error', reason: 'failed' })
  await completeAll(1)
  // Recurring: answered open, so it can be completed again.
  writeTask.mockResolvedValue({ status: 'ok', tasks: [parent], refresh: false })
  await completeAll(2)
  await completeAll(3)
  const keys = writeTask.mock.calls.map(([sent]) => sent.write.requestKey)
  expect(keys[1]).toBe(keys[0])
  expect(keys[2]).not.toBe(keys[0])
})

test('a subtask moves out from under its parent, and an edit sends what changed', async () => {
  writeTask.mockResolvedValue({
    status: 'ok',
    tasks: [{ ...step, parentExternalId: undefined }],
    refresh: false,
  })
  renderList()
  await screen.findByText('Pack')
  fireEvent.click(screen.getByLabelText('Edit Socks'))
  fireEvent.change(screen.getByLabelText('Move under a task…'), {
    target: { value: '' },
  })
  await waitFor(() =>
    expect(writeTask.mock.calls[0][0].write).toEqual({
      kind: 'move',
      taskId: 's',
      parentId: null,
    }),
  )
  fireEvent.change(await screen.findByLabelText('Due date'), {
    target: { value: '2026-12-01' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() =>
    expect(writeTask.mock.calls[1]?.[0].write).toEqual({
      kind: 'update',
      taskId: 's',
      dueDate: '2026-12-01',
    }),
  )
})
