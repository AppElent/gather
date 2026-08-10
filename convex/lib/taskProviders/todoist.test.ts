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
  test('getAccountIdentity names the account behind the token', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        user: { id: 4242, email: 'household@example.com', full_name: 'Home' },
      }),
    )
    await expect(
      todoistAdapter.getAccountIdentity(
        'tok',
        fetchImpl as unknown as typeof fetch,
      ),
    ).resolves.toEqual({
      externalAccountId: '4242',
      accountLabel: 'household@example.com',
    })
  })

  test('getAccountIdentity fails loudly rather than inventing an identity', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ user: {} }))
    await expect(
      todoistAdapter.getAccountIdentity(
        'tok',
        fetchImpl as unknown as typeof fetch,
      ),
    ).rejects.toThrow(/did not identify/)
  })

  test('getAccountIdentity reports a rejected token as an auth failure', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 401))
    await expect(
      todoistAdapter.getAccountIdentity(
        'tok',
        fetchImpl as unknown as typeof fetch,
      ),
    ).rejects.toBeInstanceOf(ProviderAuthError)
  })

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

  test('fetchTasks returns the project’s open tasks, then its finished ones', async () => {
    const fetchImpl = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(
        url.includes('/completed/get_all')
          ? jsonResponse({ items: [{ task_id: 't2', content: 'Done one' }] })
          : jsonResponse([{ id: 't1', content: 'Task one', priority: 1 }]),
      ),
    )

    const tasks = await todoistAdapter.fetchTasks(
      'tok',
      { sourceId: 'p1' },
      fetchImpl as unknown as typeof fetch,
    )

    // Both, because a task that can be completed has to be reopenable, and
    // Todoist drops a completed task out of `/tasks` entirely.
    expect(tasks.map((t) => [t.title, t.done])).toEqual([
      ['Task one', false],
      ['Done one', true],
    ])
    expect(fetchImpl.mock.calls[0][0]).toContain('project_id=p1')
    expect(fetchImpl.mock.calls[1][0]).toContain('project_id=p1')
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

/**
 * The writes.
 *
 * Todoist is authoritative for these tasks (ADR-0013), so what matters here is
 * that the right thing is sent and that what comes back — the provider's own
 * version of the task, not ours — is what the caller gets.
 */
describe('writing to Todoist', () => {
  function bodyOf(fetchImpl: ReturnType<typeof vi.fn>, call = 0) {
    return JSON.parse(String(fetchImpl.mock.calls[call][1].body))
  }

  test('createTask sends the task to the linked project and returns Todoist’s version', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        id: 'new-1',
        content: 'Water plants',
        priority: 4,
        due: { date: '2026-08-12' },
      }),
    )

    const created = await todoistAdapter.createTask?.(
      'tok',
      { sourceId: 'p1' },
      { title: 'Water plants', priority: 1, dueDate: '2026-08-12' },
      fetchImpl as unknown as typeof fetch,
    )

    expect(bodyOf(fetchImpl)).toEqual({
      content: 'Water plants',
      due_date: '2026-08-12',
      // UI priority 1 (most urgent) is Todoist's 4.
      priority: 4,
      project_id: 'p1',
    })
    expect(created).toMatchObject({ externalId: 'new-1', priority: 1 })
  })

  test('updateTask mentions only the fields being changed', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ id: 't1', content: 'New', priority: 1 }))

    await todoistAdapter.updateTask?.(
      'tok',
      { sourceId: 'p1' },
      't1',
      { title: 'New' },
      fetchImpl as unknown as typeof fetch,
    )

    // Mentioning a field is how Todoist is told to change it, so "leave the
    // due date alone" has to mean saying nothing about it.
    expect(bodyOf(fetchImpl)).toEqual({ content: 'New' })
  })

  test('clearing a due date is a phrase rather than an absence', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ id: 't1', content: 'x', priority: 1 }))

    await todoistAdapter.updateTask?.(
      'tok',
      { sourceId: 'p1' },
      't1',
      { dueDate: null, labels: null },
      fetchImpl as unknown as typeof fetch,
    )

    expect(bodyOf(fetchImpl)).toEqual({ due_string: 'no date', labels: [] })
  })

  test('completing and reopening are the endpoints Todoist has for them', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))

    await todoistAdapter.setDone?.(
      'tok',
      { sourceId: 'p1' },
      't1',
      true,
      fetchImpl as unknown as typeof fetch,
    )
    await todoistAdapter.setDone?.(
      'tok',
      { sourceId: 'p1' },
      't1',
      false,
      fetchImpl as unknown as typeof fetch,
    )

    expect(fetchImpl.mock.calls[0][0]).toContain('/tasks/t1/close')
    expect(fetchImpl.mock.calls[1][0]).toContain('/tasks/t1/reopen')
  })

  test('deleteTask deletes, and a 204 is not read as a body', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))

    await expect(
      todoistAdapter.deleteTask?.(
        'tok',
        { sourceId: 'p1' },
        't1',
        fetchImpl as unknown as typeof fetch,
      ),
    ).resolves.toBeUndefined()
    expect(fetchImpl.mock.calls[0][1].method).toBe('DELETE')
  })

  test('a rate limit is its own answer, not a fault', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response('{}', { status: 429, headers: { 'Retry-After': '30' } }),
    )

    // Different from a refusal because the reader is told something different:
    // wait, rather than change what you sent.
    await expect(
      todoistAdapter.createTask?.(
        'tok',
        { sourceId: 'p1' },
        { title: 'x' },
        fetchImpl as unknown as typeof fetch,
      ),
    ).rejects.toMatchObject({
      name: 'ProviderRateLimitError',
      retryAfterSeconds: 30,
    })
  })

  test('a refusal carries the status it was refused with', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 404))

    await expect(
      todoistAdapter.deleteTask?.(
        'tok',
        { sourceId: 'p1' },
        'gone',
        fetchImpl as unknown as typeof fetch,
      ),
    ).rejects.toMatchObject({ name: 'ProviderRequestError', status: 404 })
  })

  test('an expired token still asks for a reconnect', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 401))

    await expect(
      todoistAdapter.createTask?.(
        'tok',
        { sourceId: 'p1' },
        { title: 'x' },
        fetchImpl as unknown as typeof fetch,
      ),
    ).rejects.toBeInstanceOf(ProviderAuthError)
  })
})

describe('Todoist subtasks', () => {
  test('a task’s parent comes back as the provider’s own id', () => {
    expect(
      mapTodoistTask({
        id: '2',
        content: 'Buy pots',
        priority: 1,
        parent_id: '1',
      }).parentExternalId,
    ).toBe('1')
  })

  test('a top-level task has no parent rather than a null one', () => {
    expect(
      mapTodoistTask({ id: '1', content: 'x', priority: 1, parent_id: null })
        .parentExternalId,
    ).toBeUndefined()
  })

  test('creating a subtask names its parent to Todoist', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ id: '2', content: 'Buy pots', priority: 1, parent_id: '1' }),
      )

    await todoistAdapter.createTask?.(
      'tok',
      { sourceId: 'p1' },
      { title: 'Buy pots', parentExternalId: '1' },
      fetchImpl as unknown as typeof fetch,
    )

    expect(JSON.parse(String(fetchImpl.mock.calls[0][1].body))).toMatchObject({
      parent_id: '1',
      project_id: 'p1',
    })
  })

  test('moving goes through the Sync API, which REST v2 has no endpoint for', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ sync_status: { 'uuid-1': 'ok' } }))

    await todoistAdapter.moveTask?.(
      'tok',
      { sourceId: 'p1' },
      '2',
      '1',
      fetchImpl as unknown as typeof fetch,
    )

    const body = String(fetchImpl.mock.calls[0][1].body)
    expect(fetchImpl.mock.calls[0][0]).toContain('/sync/v9/sync')
    expect(JSON.parse(new URLSearchParams(body).get('commands') ?? '[]')[0]).toMatchObject({
      type: 'item_move',
      args: { id: '2', parent_id: '1' },
    })
  })

  test('moving to the top level names the project instead of a parent', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ sync_status: { 'uuid-1': 'ok' } }))

    await todoistAdapter.moveTask?.(
      'tok',
      { sourceId: 'p1' },
      '2',
      null,
      fetchImpl as unknown as typeof fetch,
    )

    const body = String(fetchImpl.mock.calls[0][1].body)
    expect(
      JSON.parse(new URLSearchParams(body).get('commands') ?? '[]')[0].args,
    ).toEqual({ id: '2', project_id: 'p1' })
  })

  test('a move Todoist refused is a refusal, not a 200', async () => {
    // The Sync API answers 200 with a per-command status, so a refusal here is
    // not an HTTP error and would otherwise pass for success.
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        sync_status: { 'uuid-1': { error: 'Invalid parent', error_code: 15 } },
      }),
    )

    await expect(
      todoistAdapter.moveTask?.(
        'tok',
        { sourceId: 'p1' },
        '2',
        '1',
        fetchImpl as unknown as typeof fetch,
      ),
    ).rejects.toMatchObject({ name: 'ProviderRequestError' })
  })

  test('declares the nesting it can hold, so nobody has to know whose limit it is', () => {
    expect(todoistAdapter.capabilities).toMatchObject({
      subtasks: true,
      maxDepth: 4,
      // Ordering stays Todoist's.
      reorder: false,
    })
  })
})
