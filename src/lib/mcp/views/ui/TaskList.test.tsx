import type { App } from '@modelcontextprotocol/ext-apps'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TaskListResult } from '../types'
import { viewText } from './i18n'
import { TaskList } from './TaskList'

const result: TaskListResult = {
  view: 'task-list',
  groupId: 'group_1',
  groupName: 'Thuis',
  listId: 'list_1',
  listName: 'Boodschappen',
  canWrite: true,
  tasks: [
    { id: 'task_1', title: 'Melk', done: false },
    { id: 'task_2', title: 'Brood', done: true },
  ],
}

function stubApp(callServerTool: ReturnType<typeof vi.fn>) {
  return {
    callServerTool,
    updateModelContext: vi.fn().mockResolvedValue(undefined),
  } as unknown as App
}

function show(app: App, props: Partial<TaskListResult> = {}) {
  const reload = vi.fn().mockResolvedValue(undefined)
  render(
    <TaskList
      app={app}
      result={{ ...result, ...props }}
      text={viewText('en')}
      reload={reload}
      header={null}
    />,
  )
  return reload
}

afterEach(cleanup)

describe('TaskList view', () => {
  it('checks a task off through update_task and reloads', async () => {
    const call = vi.fn().mockResolvedValue({ content: [] })
    const app = stubApp(call)
    const reload = show(app)
    fireEvent.click(screen.getByRole('checkbox', { name: /Melk/ }))
    await waitFor(() => expect(reload).toHaveBeenCalled())
    expect(call).toHaveBeenCalledWith({
      name: 'update_task',
      arguments: { groupId: 'group_1', taskId: 'task_1', done: true },
    })
    expect(app.updateModelContext).toHaveBeenCalled()
  })

  it('reuses the idempotency key when an add fails, and renews it after success', async () => {
    const call = vi
      .fn()
      .mockResolvedValueOnce({ isError: true, content: [] })
      .mockResolvedValue({ content: [] })
    show(stubApp(call))
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'Kaas' } })
    fireEvent.submit(input.closest('form') as HTMLFormElement)
    await screen.findByRole('alert')
    fireEvent.submit(input.closest('form') as HTMLFormElement)
    await waitFor(() => expect(call).toHaveBeenCalledTimes(2))
    const keys = call.mock.calls.map(([req]) => req.arguments.idempotencyKey)
    expect(keys[0]).toBe(keys[1])
    await waitFor(() => expect((input as HTMLInputElement).value).toBe(''))
    fireEvent.change(input, { target: { value: 'Eieren' } })
    fireEvent.submit(input.closest('form') as HTMLFormElement)
    await waitFor(() => expect(call).toHaveBeenCalledTimes(3))
    expect(call.mock.calls[2][0].arguments.idempotencyKey).not.toBe(keys[0])
  })

  it('is read-only without write access', () => {
    const call = vi.fn()
    show(stubApp(call), { canWrite: false, readOnlyReason: 'scope' })
    expect(screen.queryByRole('textbox')).toBeNull()
    const box = screen.getByRole('checkbox', { name: /Melk/ })
    expect((box as HTMLInputElement).disabled).toBe(true)
    fireEvent.click(box)
    expect(call).not.toHaveBeenCalled()
  })
})
