import { describe, expect, test, vi } from 'vitest'
import { dueOnDay, mapTodoistTask, todoistAdapter } from './todoist'
import {
  ProviderAuthError,
  ProviderTaskNotFoundError,
  type TaskProviderWriter,
} from './types'

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

  test("keeps a recurring task's own words for its repeat (APP-303)", () => {
    const base = { id: '7', content: 'Bins', priority: 1 as const }
    expect(
      mapTodoistTask({
        ...base,
        due: { date: '2026-11-24', is_recurring: true, string: 'every tue' },
      }).repeatText,
    ).toBe('every tue')
    expect(
      mapTodoistTask({
        ...base,
        due: { date: '2026-11-24', is_recurring: false, string: 'nov 24' },
      }).repeatText,
    ).toBeUndefined()
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
        jsonResponse({
          results: [{ id: 'p1', name: 'Household', extra: true }],
          next_cursor: null,
        }),
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
        jsonResponse({
          results: [{ id: 't1', content: 'Task one', priority: 1 }],
          next_cursor: null,
        }),
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

describe('Todoist subtasks (APP-304)', () => {
  test('reads parent_id as the parent', () => {
    const base = { id: '8', content: 'Sweep', priority: 1 as const }
    expect(mapTodoistTask({ ...base, parent_id: '7' }).parentExternalId).toBe(
      '7',
    )
    expect(
      mapTodoistTask({ ...base, parent_id: null }).parentExternalId,
    ).toBeUndefined()
  })
})

interface Call {
  method: string
  path: string
  query: URLSearchParams
  headers: Record<string, string>
  body: string | undefined
}

/** A Todoist that answers by `METHOD /path` and records what it was asked. */
function fakeTodoist(
  answers: Record<string, unknown | ((call: Call) => unknown)>,
) {
  const calls: Call[] = []
  const fetchImpl = (async (input: string, init: RequestInit = {}) => {
    const url = new URL(input)
    expect(url.origin + url.pathname).toMatch(
      /^https:\/\/api\.todoist\.com\/api\/v1\//,
    )
    const call: Call = {
      method: init.method ?? 'GET',
      path: url.pathname.replace('/api/v1', ''),
      query: url.searchParams,
      headers: init.headers as Record<string, string>,
      body: init.body as string | undefined,
    }
    calls.push(call)
    const answer = answers[`${call.method} ${call.path}`]
    const value = typeof answer === 'function' ? answer(call) : answer
    if (value instanceof Error) throw value
    if (value instanceof Response) return value
    if (value === undefined) return new Response('{}', { status: 404 })
    if (value === null) return new Response(null, { status: 204 })
    return jsonResponse(value)
  }) as unknown as typeof fetch
  return {
    calls,
    fetchImpl,
    writes: () => calls.filter((call) => call.method !== 'GET'),
  }
}

const writer = todoistAdapter.writer as TaskProviderWriter
const config = { sourceId: 'proj' }
const apiTask = (fields: Record<string, unknown> = {}) => ({
  id: 't1',
  content: 'Water plants',
  priority: 1,
  project_id: 'proj',
  parent_id: null,
  labels: [],
  ...fields,
})
const syncOk = (call: Call) => ({
  sync_status: Object.fromEntries(
    syncCommands(call).map(({ uuid }) => [uuid, 'ok']),
  ),
})
const syncCommands = (call: Call) =>
  JSON.parse(new URLSearchParams(call.body).get('commands') ?? '[]') as {
    type: string
    uuid: string
    temp_id?: string
    args: Record<string, unknown>
  }[]

describe('Todoist API v1 reads (APP-448)', () => {
  test('follows the cursor', async () => {
    const todoist = fakeTodoist({
      'GET /tasks': (call: Call) =>
        call.query.get('cursor')
          ? { results: [apiTask({ id: 't2' })], next_cursor: null }
          : { results: [apiTask()], next_cursor: 'more' },
    })
    const tasks = await todoistAdapter.fetchTasks(
      'tok',
      config,
      todoist.fetchImpl,
    )
    expect(tasks.map((t) => t.externalId)).toEqual(['t1', 't2'])
  })

  test('a list linked with a numeric id reads through the id mapping', async () => {
    const todoist = fakeTodoist({
      'GET /id_mappings/projects/918': [{ old_id: '918', new_id: 'proj' }],
      'GET /tasks': { results: [], next_cursor: null },
    })
    await todoistAdapter.fetchTasks(
      'tok',
      { sourceId: '918' },
      todoist.fetchImpl,
    )
    expect(todoist.calls[1].query.get('project_id')).toBe('proj')
  })

  test('a due time in a fixed zone is the day there', () => {
    expect(
      mapTodoistTask({
        id: '1',
        content: 'x',
        priority: 1,
        due: { date: '2026-07-21T22:30:00Z', timezone: 'Europe/Amsterdam' },
      }).dueDate,
    ).toBe('2026-07-22')
  })
})

describe('Todoist writes (APP-448)', () => {
  test('creates on the project, under a parent, with every field and the key', async () => {
    const todoist = fakeTodoist({
      'GET /tasks/p1': apiTask({ id: 'p1' }),
      'POST /sync': (call: Call) => ({
        ...syncOk(call),
        temp_id_mapping: { [syncCommands(call)[0].temp_id ?? '']: 'new' },
      }),
      'GET /tasks/new': apiTask({ id: 'new', parent_id: 'p1', priority: 4 }),
    })
    const create = (requestKey: string) =>
      writer.createTask(
        'tok',
        config,
        {
          title: 'Buy soil',
          parentId: 'p1',
          dueDate: '2026-12-01',
          priority: 1,
          labels: ['home'],
          requestKey,
        },
        todoist.fetchImpl,
      )
    const outcome = await create('key-1')
    const [write] = todoist.writes()
    const [command] = syncCommands(write)
    expect(command).toMatchObject({
      type: 'item_add',
      args: {
        content: 'Buy soil',
        project_id: 'proj',
        parent_id: 'p1',
        due: { date: '2026-12-01' },
        priority: 4,
        labels: ['home'],
      },
    })
    expect(command.uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/,
    )
    await create('key-1')
    await create('key-2')
    const uuids = todoist.writes().map((call) => syncCommands(call)[0].uuid)
    expect(uuids[1]).toBe(uuids[0])
    expect(uuids[2]).not.toBe(uuids[0])
    expect(write.headers.Authorization).toBe('Bearer tok')
    expect(outcome.tasks[0]).toMatchObject({
      externalId: 'new',
      parentExternalId: 'p1',
      priority: 1,
    })
  })

  test('updates in one command and reads the task back', async () => {
    let reads = 0
    const todoist = fakeTodoist({
      'GET /tasks/t1': () =>
        apiTask(reads++ ? { content: 'New', labels: ['x'] } : {}),
      'POST /sync': syncOk,
    })
    const outcome = await writer.updateTask(
      'tok',
      config,
      't1',
      { title: 'New', dueDate: '2026-12-02', priority: 2, labels: ['x'] },
      todoist.fetchImpl,
    )
    expect(syncCommands(todoist.writes()[0])).toEqual([
      {
        type: 'item_update',
        uuid: expect.any(String),
        args: {
          id: 't1',
          content: 'New',
          due: { date: '2026-12-02' },
          priority: 3,
          labels: ['x'],
        },
      },
    ])
    expect(outcome).toMatchObject({
      tasks: [{ title: 'New' }],
      refresh: false,
    })
  })

  test('clears the date and the priority', async () => {
    const todoist = fakeTodoist({
      'GET /tasks/t1': apiTask({ due: { date: '2026-11-01' } }),
      'POST /sync': syncOk,
    })
    await writer.updateTask(
      'tok',
      config,
      't1',
      { dueDate: null, priority: null },
      todoist.fetchImpl,
    )
    expect(syncCommands(todoist.writes()[0])[0].args).toEqual({
      id: 't1',
      due: null,
      priority: 1,
    })
  })

  test('a new day keeps a repeat and a time, and drops one-off words', () => {
    expect(
      dueOnDay(
        {
          date: '2026-11-24T09:00:00',
          is_recurring: true,
          string: 'every tue 9am',
          lang: 'en',
          timezone: null,
        },
        '2026-11-26',
      ),
    ).toEqual({
      date: '2026-11-26T09:00:00',
      is_recurring: true,
      string: 'every tue 9am',
      lang: 'en',
    })
    expect(
      dueOnDay({ date: '2026-11-24', string: 'nov 24' }, '2026-11-26'),
    ).toEqual({ date: '2026-11-26' })
    // 09:00 in Amsterdam is 07:00Z in summer and 08:00Z in winter.
    expect(
      dueOnDay(
        { date: '2026-10-24T07:00:00Z', timezone: 'Europe/Amsterdam' },
        '2026-10-26',
      ).date,
    ).toBe('2026-10-26T08:00:00Z')
  })

  test('a failed read-back after an accepted update is saved, to be refreshed', async () => {
    let reads = 0
    const todoist = fakeTodoist({
      'GET /tasks/t1': () =>
        reads++ ? new Response('', { status: 500 }) : apiTask(),
      'POST /sync': syncOk,
    })
    expect(
      await writer.updateTask(
        'tok',
        config,
        't1',
        { title: 'x' },
        todoist.fetchImpl,
      ),
    ).toEqual({ tasks: [], refresh: true })
  })

  test('closes a task, and Todoist its subtasks with it', async () => {
    const todoist = fakeTodoist({
      'GET /tasks/t1': apiTask(),
      'POST /tasks/t1/close': null,
    })
    expect(
      await writer.closeTask(
        'tok',
        config,
        't1',
        { withSubtasks: true },
        todoist.fetchImpl,
      ),
    ).toEqual({ tasks: [], refresh: false })
  })

  test('a recurring task closes with its open subtasks only when asked', async () => {
    const recurring = apiTask({
      due: { date: '2026-11-24', is_recurring: true, string: 'every day' },
    })
    const run = async (withSubtasks: boolean) => {
      const todoist = fakeTodoist({
        'GET /tasks/t1': recurring,
        'GET /tasks': { results: [apiTask({ id: 'c1', parent_id: 't1' })], next_cursor: null },
        'POST /sync': syncOk,
      })
      const outcome = await writer.closeTask(
        'tok',
        config,
        't1',
        { withSubtasks },
        todoist.fetchImpl,
      )
      expect(outcome.refresh).toBe(true)
      return todoist
        .writes()
        .map((call) => syncCommands(call).map((c) => [c.type, c.args.id]))
    }
    // One request after the other: the task only once its subtasks are done.
    expect(await run(true)).toEqual([
      [['item_close', 'c1']],
      [['item_close', 't1']],
    ])
    expect(await run(false)).toEqual([[['item_close', 't1']]])
  })

  test('a refused subtask leaves its recurring task where it was', async () => {
    const todoist = fakeTodoist({
      'GET /tasks/t1': apiTask({
        due: { date: '2026-11-24', is_recurring: true, string: 'every day' },
      }),
      'GET /tasks': {
        results: [
          apiTask({ id: 'c1', parent_id: 't1' }),
          apiTask({ id: 'c2', parent_id: 't1' }),
        ],
        next_cursor: null,
      },
      'POST /sync': (call: Call) => {
        const [first, second] = syncCommands(call)
        return {
          sync_status: {
            [first.uuid]: 'ok',
            ...(second ? { [second.uuid]: { http_code: 500 } } : {}),
          },
        }
      },
    })
    await expect(
      writer.closeTask(
        'tok',
        config,
        't1',
        { withSubtasks: true },
        todoist.fetchImpl,
      ),
    ).rejects.toThrow(/refused/)
    expect(todoist.writes()).toHaveLength(1)
  })

  const daily = { date: '2026-11-24', is_recurring: true, string: 'every day' }

  /** A Todoist that runs a command's UUID once and refuses some tasks. */
  function recurringTodoist(below: ReturnType<typeof apiTask>[]) {
    const ran = new Set<string>()
    const closed: string[] = []
    const refused = new Set<string>()
    const gone = new Set<string>()
    const todoist = fakeTodoist({
      'GET /tasks/t1': apiTask({ due: daily }),
      'GET /tasks': () => ({
        results: [
          apiTask({ due: daily }),
          ...below.filter((each) => !gone.has(each.id)),
        ],
        next_cursor: null,
      }),
      'POST /sync': (call: Call) => ({
        sync_status: Object.fromEntries(
          syncCommands(call).map(({ uuid, args }) => {
            const id = String(args.id)
            if (refused.has(id)) return [uuid, { http_code: 500 }]
            if (!ran.has(uuid)) {
              ran.add(uuid)
              closed.push(id)
              const row: Record<string, unknown> | undefined = below.find(
                (each) => each.id === id,
              )
              if (row && !row.due) gone.add(id)
            }
            return [uuid, 'ok']
          }),
        ),
      }),
    })
    const completeAll = (requestKey?: string) =>
      writer.closeTask(
        'tok',
        config,
        't1',
        { withSubtasks: true, requestKey },
        todoist.fetchImpl,
      )
    return { closed, refused, completeAll, todoist }
  }

  test('retrying Complete all after a refusal moves each recurring subtask on once', async () => {
    const { closed, refused, completeAll } = recurringTodoist([
      apiTask({ id: 'daily', parent_id: 't1', due: daily }),
      apiTask({ id: 'once', parent_id: 't1' }),
      apiTask({ id: 'stuck', parent_id: 't1', due: daily }),
    ])
    refused.add('stuck')
    await expect(completeAll('key')).rejects.toThrow(/refused/)
    expect(closed).toEqual(['daily', 'once'])
    refused.clear()
    await completeAll('key')
    expect(closed).toEqual(['daily', 'once', 'stuck', 't1'])
    // Another Complete all is another completion.
    await completeAll('next')
    expect(closed.slice(4)).toEqual(['daily', 'stuck', 't1'])
  })

  test('the same key on a later occurrence completes again', async () => {
    const run = async (date: string) => {
      const todoist = fakeTodoist({
        'GET /tasks/t1': apiTask({ due: { ...daily, date } }),
        'GET /tasks': {
          results: [apiTask({ id: 'c', parent_id: 't1', due: daily })],
          next_cursor: null,
        },
        'POST /sync': syncOk,
      })
      await writer.closeTask(
        'tok',
        config,
        't1',
        { withSubtasks: true, requestKey: 'key' },
        todoist.fetchImpl,
      )
      return syncCommands(todoist.writes()[0])[0].uuid
    }
    const first = await run('2026-11-24T09:00:00')
    expect(await run('2026-11-24T09:00:00')).toBe(first)
    expect(await run('2026-11-24T11:00:00')).not.toBe(first)
  })

  test('Complete all closes subtasks of subtasks, the deepest first', async () => {
    const { closed, completeAll, todoist } = recurringTodoist([
      apiTask({ id: 'other' }),
      apiTask({ id: 'child', parent_id: 't1', due: daily }),
      apiTask({ id: 'grandchild', parent_id: 'child' }),
      apiTask({ id: 'deepest', parent_id: 'grandchild' }),
    ])
    await completeAll('key')
    expect(closed).toEqual(['deepest', 'grandchild', 'child', 't1'])
    expect(todoist.writes()).toHaveLength(2)
  })

  test('Complete all sends at most 100 commands at a time', async () => {
    const { closed, completeAll, todoist } = recurringTodoist(
      Array.from({ length: 101 }, (_, at) =>
        apiTask({ id: `c${at}`, parent_id: 't1' }),
      ),
    )
    await completeAll('key')
    expect(todoist.writes().map((call) => syncCommands(call).length)).toEqual([
      100, 1, 1,
    ])
    expect(closed.at(-1)).toBe('t1')
  })

  test('reopens a completed task of the project', async () => {
    let reopened = false
    const todoist = fakeTodoist({
      'GET /tasks/t1': () =>
        reopened ? apiTask() : new Response('', { status: 404 }),
      'GET /tasks/completed/by_completion_date': {
        items: [apiTask({ checked: true })],
        next_cursor: null,
      },
      'POST /tasks/t1/reopen': () => {
        reopened = true
        return null
      },
    })
    const outcome = await writer.reopenTask(
      'tok',
      config,
      't1',
      todoist.fetchImpl,
    )
    expect(outcome.tasks[0]).toMatchObject({ externalId: 't1', done: false })
    expect(todoist.calls[1].query.get('project_id')).toBe('proj')
  })

  test('moves under a parent, and back out to the project', async () => {
    const todoist = fakeTodoist({
      'GET /tasks/t1': apiTask(),
      'GET /tasks/p1': apiTask({ id: 'p1' }),
      'POST /tasks/t1/move': (call: Call) =>
        apiTask({ parent_id: JSON.parse(call.body ?? '').parent_id ?? null }),
    })
    const under = await writer.moveTask(
      'tok',
      config,
      't1',
      'p1',
      todoist.fetchImpl,
    )
    const out = await writer.moveTask(
      'tok',
      config,
      't1',
      null,
      todoist.fetchImpl,
    )
    expect(under.tasks[0].parentExternalId).toBe('p1')
    expect(out.tasks[0].parentExternalId).toBeUndefined()
    expect(todoist.writes().map((c) => JSON.parse(c.body ?? ''))).toEqual([
      { parent_id: 'p1' },
      { project_id: 'proj' },
    ])
  })

  test('moving out keeps the section', async () => {
    const todoist = fakeTodoist({
      'GET /tasks/t1': apiTask({ parent_id: 'p1', section_id: 'sec' }),
      'POST /tasks/t1/move': apiTask({ section_id: 'sec' }),
    })
    await writer.moveTask('tok', config, 't1', null, todoist.fetchImpl)
    expect(JSON.parse(todoist.writes()[0].body ?? '')).toEqual({
      section_id: 'sec',
    })
  })

  const everyWrite: [string, (f: typeof fetch) => Promise<unknown>][] = [
    ['create', (f) => writer.createTask('tok', config, { title: 'x', parentId: 't1' }, f)],
    ['update', (f) => writer.updateTask('tok', config, 't1', { title: 'x' }, f)],
    ['close', (f) => writer.closeTask('tok', config, 't1', { withSubtasks: false }, f)],
    ['reopen', (f) => writer.reopenTask('tok', config, 't1', f)],
    ['move', (f) => writer.moveTask('tok', config, 't1', null, f)],
  ]

  test.each(everyWrite)('%s refuses a task of another project', async (_, run) => {
    const todoist = fakeTodoist({
      'GET /tasks/t1': apiTask({ project_id: 'elsewhere' }),
    })
    await expect(run(todoist.fetchImpl)).rejects.toBeInstanceOf(
      ProviderTaskNotFoundError,
    )
    expect(todoist.writes()).toEqual([])
  })

  const refusing = (status: number) => {
    const refuse = () => new Response('', { status })
    return fakeTodoist({
      'GET /tasks/t1': apiTask(),
      'POST /tasks': refuse,
      'POST /sync': refuse,
      'POST /tasks/t1/close': refuse,
      'POST /tasks/t1/reopen': refuse,
      'POST /tasks/t1/move': refuse,
    })
  }

  test.each(everyWrite)('%s on a read-only connection asks to reconnect', async (_, run) => {
    await expect(run(refusing(403).fetchImpl)).rejects.toBeInstanceOf(
      ProviderAuthError,
    )
  })

  test.each(everyWrite)('%s fails when Todoist is down', async (_, run) => {
    await expect(run(refusing(503).fetchImpl)).rejects.toThrow(/503/)
  })

  test.each([
    ['FORBIDDEN', /403/],
    ['MAX_ITEMS_LIMIT_REACHED', /403/],
    ['AUTH_INSUFFICIENT_TOKEN_SCOPE', ProviderAuthError],
  ])('a 403 tagged %s', async (error_tag, expected) => {
    const forbidden = () =>
      new Response(JSON.stringify({ error_tag }), { status: 403 })
    const todoist = fakeTodoist({
      'GET /tasks/t1': apiTask(),
      'POST /tasks/t1/reopen': forbidden,
    })
    await expect(
      writer.reopenTask('tok', config, 't1', todoist.fetchImpl),
    ).rejects.toThrow(expected)
  })

  test('a task gone before its Sync command is not found', async () => {
    const todoist = fakeTodoist({
      'GET /tasks/t1': apiTask(),
      'POST /sync': (call: Call) => ({
        sync_status: {
          [syncCommands(call)[0].uuid]: {
            http_code: 400,
            error_tag: 'ITEM_NOT_FOUND',
          },
        },
      }),
    })
    await expect(
      writer.updateTask('tok', config, 't1', { title: 'x' }, todoist.fetchImpl),
    ).rejects.toBeInstanceOf(ProviderTaskNotFoundError)
  })

  test('a Sync command refused for its scope asks to reconnect', async () => {
    const todoist = fakeTodoist({
      'GET /tasks/t1': apiTask(),
      'POST /sync': (call: Call) => ({
        sync_status: {
          [syncCommands(call)[0].uuid]: { http_code: 403, error: 'scope' },
        },
      }),
    })
    await expect(
      writer.updateTask('tok', config, 't1', { title: 'x' }, todoist.fetchImpl),
    ).rejects.toBeInstanceOf(ProviderAuthError)
  })

  test('a Sync command without a status is a failure', async () => {
    const todoist = fakeTodoist({
      'GET /tasks/t1': apiTask(),
      'POST /sync': { sync_status: {} },
    })
    await expect(
      writer.updateTask('tok', config, 't1', { title: 'x' }, todoist.fetchImpl),
    ).rejects.toThrow(/refused/)
  })
})
