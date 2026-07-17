import { describe, expect, test, vi } from 'vitest'
import { mapTodoistTask, todoistAdapter } from './todoist'
import { ProviderAuthError } from './types'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

describe('mapTodoistTask', () => {
  test('maps content, due date, labels, url and inverts priority', () => {
    expect(
      mapTodoistTask({
        id: '42',
        content: 'Water plants',
        due: { date: '2026-07-21' },
        priority: 4, // API 4 = UI p1 (most urgent)
        labels: ['home'],
        url: 'https://todoist.com/showTask?id=42',
      }),
    ).toEqual({
      externalId: '42',
      title: 'Water plants',
      done: false,
      dueDate: '2026-07-21',
      priority: 1,
      labels: ['home'],
      url: 'https://todoist.com/showTask?id=42',
    })
  })

  test('normal priority maps to 4 and empty labels become undefined', () => {
    const task = mapTodoistTask({
      id: '1',
      content: 'x',
      priority: 1,
      labels: [],
    })
    expect(task.priority).toBe(4)
    expect(task.labels).toBeUndefined()
    expect(task.dueDate).toBeUndefined()
  })
})

describe('todoistAdapter', () => {
  test('listAvailableSources maps projects', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse([{ id: 'p1', name: 'Household', extra: true }]),
      )
    const sources = await todoistAdapter.listAvailableSources(
      'tok',
      fetchImpl as unknown as typeof fetch,
    )
    expect(sources).toEqual([{ id: 'p1', name: 'Household' }])
  })

  test('fetchTasks requests the project and maps tasks', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse([{ id: 't1', content: 'Task one', priority: 1 }]),
      )
    const tasks = await todoistAdapter.fetchTasks(
      'tok',
      { sourceId: 'p1' },
      fetchImpl as unknown as typeof fetch,
    )
    expect(tasks[0].title).toBe('Task one')
    expect(fetchImpl.mock.calls[0][0]).toContain('project_id=p1')
  })

  test('fetchTasks throws ProviderAuthError on 401', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 401))
    await expect(
      todoistAdapter.fetchTasks(
        'tok',
        { sourceId: 'p1' },
        fetchImpl as unknown as typeof fetch,
      ),
    ).rejects.toBeInstanceOf(ProviderAuthError)
  })

  test('getSourceSchema is empty (fixed schema, nothing to map)', async () => {
    await expect(todoistAdapter.getSourceSchema('tok', 'p1')).resolves.toEqual(
      [],
    )
  })
})
