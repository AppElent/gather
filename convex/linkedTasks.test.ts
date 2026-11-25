/**
 * Writes to a linked list (APP-448): who may make them, what they refuse, and
 * that what Todoist answers decides the result. The adapter's own calls are in
 * `lib/taskProviders/todoist.test.ts`.
 */
import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  alice,
  carla,
  seedGroup,
  seedMember,
  testConvex,
} from '../test/convexHarness'
import { api } from './_generated/api'
import { CONNECTED_APP_READ_ONLY } from './lib/connectedApps'
import { IDEMPOTENCY_KEY_REQUIRED } from './lib/idempotency'

const HOME = 'linked-home'
const AWAY = 'linked-away'

async function seed() {
  const t = testConvex()
  const ids = await t.run(async (ctx) => {
    const person = (identity: typeof alice, name: string) =>
      ctx.db.insert('users', {
        clerkId: identity.subject,
        name,
        email: identity.email,
      })
    const aliceId = await person(alice, 'Alice')
    const carlaId = await person(carla, 'Carla')
    const home = await seedGroup(ctx, { name: 'Home', slug: HOME })
    const away = await seedGroup(ctx, { name: 'Away', slug: AWAY })
    await seedMember(ctx, home, aliceId, 'admin')
    await seedMember(ctx, away, carlaId, 'admin')
    await seedMember(ctx, away, aliceId, 'member')
    const connection = (provider: 'todoist' | 'notion') =>
      ctx.db.insert('integrationConnections', {
        groupId: home,
        provider,
        accessToken: `${provider}-token`,
        accountLabel: provider,
        connectedBy: aliceId,
      })
    const linked = async (provider: 'todoist' | 'notion') => {
      const connectionId = await connection(provider)
      const listId = await ctx.db.insert('taskLists', {
        groupId: home,
        name: provider,
        provider,
        providerConfig: { connectionId, sourceId: 'proj' },
        order: 0,
      })
      return { connectionId, listId }
    }
    const todoist = await linked('todoist')
    const notion = await linked('notion')
    const local = await ctx.db.insert('taskLists', {
      groupId: home,
      name: 'local',
      provider: 'local',
      order: 0,
    })
    return { aliceId, carlaId, home, todoist, notion, local }
  })
  return { t, ...ids }
}

function todoistAnswers(answer: (method: string, path: string, body: string) => Response) {
  const fetchMock = vi.fn(async (input: string, init: RequestInit = {}) =>
    answer(init.method ?? 'GET', new URL(input).pathname.replace('/api/v1', ''), String(init.body ?? '')),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status })
const create = { kind: 'create', title: ' Buy soil ' } as const

afterEach(() => vi.unstubAllGlobals())

describe('taskLists.writeTask', () => {
  test('sends the write with the Group’s token and answers the task', async () => {
    const { t, todoist } = await seed()
    const commands = (body: string) =>
      JSON.parse(new URLSearchParams(body).get('commands') ?? '[]')
    const fetchMock = todoistAnswers((method, _, body) => {
      if (method === 'GET') {
        return json({ id: 'n1', content: 'Buy soil', priority: 1, project_id: 'proj' })
      }
      const [{ uuid, temp_id }] = commands(body)
      return json({
        sync_status: { [uuid]: 'ok' },
        temp_id_mapping: { [temp_id]: 'n1' },
      })
    })
    const result = await t.withIdentity(alice).action(api.taskLists.writeTask, {
      listId: todoist.listId,
      groupSlug: HOME,
      write: create,
    })
    expect(result).toMatchObject({
      status: 'ok',
      refresh: false,
      tasks: [{ externalId: 'n1', title: 'Buy soil' }],
    })
    const [, init] = fetchMock.mock.calls[0]
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer todoist-token' })
    expect(commands(init?.body as string)[0].args.content).toBe('Buy soil')
    expect(
      await t.run((ctx) => ctx.db.query('tasks').collect()),
    ).toEqual([])
  })

  test('is refused to a stranger and at another Group’s address', async () => {
    const { t, todoist } = await seed()
    const fetchMock = todoistAnswers(() => json({}))
    for (const [who, groupSlug] of [
      [carla, HOME],
      [carla, AWAY],
      [alice, AWAY],
    ] as const) {
      await expect(
        t.withIdentity(who).action(api.taskLists.writeTask, {
          listId: todoist.listId,
          groupSlug,
          write: create,
        }),
      ).rejects.toThrow()
    }
    await expect(
      t.action(api.taskLists.writeTask, {
        listId: todoist.listId,
        groupSlug: HOME,
        write: create,
      }),
    ).rejects.toThrow()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('is refused to a read-only connected app', async () => {
    const { t, todoist } = await seed()
    const fetchMock = todoistAnswers(() => json({}))
    await expect(
      t
        .withIdentity({
          ...alice,
          client_id: 'client_claude',
          scope: 'gather:read',
        })
        .action(api.taskLists.writeTask, {
          listId: todoist.listId,
          groupSlug: HOME,
          write: create,
        }),
    ).rejects.toThrow(CONNECTED_APP_READ_ONLY)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('a connected app’s create needs a request key (ADR-0046)', async () => {
    const { t, todoist } = await seed()
    const fetchMock = todoistAnswers(() => json({}))
    await expect(
      t
        .withIdentity({
          ...alice,
          client_id: 'client_claude',
          scope: 'gather:write',
        })
        .action(api.taskLists.writeTask, {
          listId: todoist.listId,
          groupSlug: HOME,
          write: create,
        }),
    ).rejects.toThrow(IDEMPOTENCY_KEY_REQUIRED)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('Notion and local lists are refused', async () => {
    const { t, notion, local } = await seed()
    const fetchMock = todoistAnswers(() => json({}))
    for (const listId of [notion.listId, local]) {
      await expect(
        t.withIdentity(alice).action(api.taskLists.writeTask, {
          listId,
          groupSlug: HOME,
          write: create,
        }),
      ).rejects.toThrow(/read-only/)
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('writes that make no sense never reach Todoist', async () => {
    const { t, todoist } = await seed()
    const fetchMock = todoistAnswers(() => json({}))
    for (const write of [
      { kind: 'create', title: '  ' },
      { kind: 'create', title: 'x', dueDate: 'tomorrow' },
      { kind: 'update', taskId: 't1', title: '' },
      { kind: 'move', taskId: 't1', parentId: 't1' },
    ] as const) {
      await expect(
        t.withIdentity(alice).action(api.taskLists.writeTask, {
          listId: todoist.listId,
          groupSlug: HOME,
          write,
        }),
      ).rejects.toThrow()
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test.each([
    [403, { status: 'reconnect', provider: 'todoist' }],
    [503, { status: 'error', reason: 'failed' }],
  ])('a %i from Todoist', async (status, expected) => {
    const { t, todoist } = await seed()
    todoistAnswers(() => json({}, status))
    expect(
      await t.withIdentity(alice).action(api.taskLists.writeTask, {
        listId: todoist.listId,
        groupSlug: HOME,
        write: create,
      }),
    ).toEqual(expected)
  })

  test('a lost network is a failure; a task elsewhere is not found', async () => {
    const { t, todoist } = await seed()
    const write = { kind: 'setDone', taskId: 't1', done: false } as const
    const run = () =>
      t.withIdentity(alice).action(api.taskLists.writeTask, {
        listId: todoist.listId,
        groupSlug: HOME,
        write,
      })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    expect(await run()).toEqual({ status: 'error', reason: 'failed' })
    todoistAnswers(() =>
      json({ id: 't1', content: 'x', priority: 1, project_id: 'elsewhere' }),
    )
    expect(await run()).toEqual({ status: 'error', reason: 'not-found' })
  })

  test('a task moves to another list of its own connection only (APP-821)', async () => {
    const { t, todoist, notion, local } = await seed()
    const { garden, otherAccount, away } = await t.run(async (ctx) => {
      const list = await ctx.db.get(todoist.listId)
      if (!list) throw new Error('no list')
      const { _id, _creationTime, ...fields } = list
      const otherGroup = await ctx.db
        .query('groups')
        .withIndex('by_slug', (q) => q.eq('slug', AWAY))
        .unique()
      if (!otherGroup) throw new Error('no group')
      const connection = await ctx.db.get(todoist.connectionId)
      if (!connection) throw new Error('no connection')
      const other = await ctx.db.insert('integrationConnections', {
        groupId: connection.groupId,
        provider: 'todoist',
        accessToken: 'other',
        accountLabel: 'other',
        connectedBy: connection.connectedBy,
      })
      const config = { connectionId: todoist.connectionId, sourceId: 'garden' }
      const insert = (more: object) =>
        ctx.db.insert('taskLists', { ...fields, providerConfig: config, ...more })
      return {
        garden: await insert({}),
        otherAccount: await insert({
          providerConfig: { connectionId: other, sourceId: 'garden' },
        }),
        away: await insert({ groupId: otherGroup._id }),
      }
    })
    const move = (listId: typeof garden, from = todoist.listId) =>
      t.withIdentity(alice).action(api.taskLists.writeTask, {
        listId: from,
        groupSlug: HOME,
        write: { kind: 'moveToList', taskId: 't1', listId },
      })
    const task = { id: 't1', content: 'x', priority: 1, project_id: 'proj' }
    const fetchMock = todoistAnswers((method) =>
      json(method === 'GET' ? task : { ...task, project_id: 'garden' }),
    )
    for (const refused of [otherAccount, notion.listId, local]) {
      await expect(move(refused)).rejects.toThrow(/read-only/)
    }
    // Alice is in that Group too, but it is not the one she is in here.
    await expect(move(away)).rejects.toThrow(/List not found/)
    for (const from of [local, notion.listId]) {
      await expect(move(garden, from)).rejects.toThrow(/read-only/)
    }
    expect(fetchMock).not.toHaveBeenCalled()

    expect(await move(garden)).toMatchObject({ status: 'ok', refresh: true })
    const last = fetchMock.mock.calls.at(-1)
    expect(last?.[0]).toMatch(/\/tasks\/t1\/move$/)
    expect(JSON.parse(String(last?.[1]?.body))).toEqual({ project_id: 'garden' })
  })

  test('a delete is refused and never reaches Todoist', async () => {
    const { t, todoist } = await seed()
    const fetchImpl = vi.fn()
    vi.stubGlobal('fetch', fetchImpl)
    await expect(
      t.withIdentity(alice).action(api.taskLists.writeTask, {
        listId: todoist.listId,
        groupSlug: HOME,
        write: { kind: 'delete', taskId: 't1' } as never,
      }),
    ).rejects.toThrow()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  test('a connection that is gone asks to reconnect', async () => {
    const { t, todoist } = await seed()
    await t.run((ctx) => ctx.db.delete(todoist.connectionId))
    expect(
      await t.withIdentity(alice).action(api.taskLists.writeTask, {
        listId: todoist.listId,
        groupSlug: HOME,
        write: create,
      }),
    ).toEqual({ status: 'reconnect', provider: 'todoist' })
  })
})

test('lists say who can be written, and installed phones still see linked ones read-only', async () => {
  const { t } = await seed()
  const lists = await t
    .withIdentity(alice)
    .query(api.taskLists.list, { groupSlug: HOME })
  expect(
    Object.fromEntries(
      lists.map((l) => [l.name, [l.writable, l.capabilities.write]]),
    ),
  ).toEqual({
    todoist: [false, true],
    notion: [false, false],
    local: [true, false],
  })
})

test('a new Todoist connection asks to read and write, and names where to return', async () => {
  const { t } = await seed()
  vi.stubEnv('TODOIST_CLIENT_ID', 'client')
  const url = await t.withIdentity(alice).action(api.integrations.getAuthorizeUrl, {
    provider: 'todoist',
    redirectUri: 'https://gather.example/integrations/callback',
    state: 's',
  })
  expect(Object.fromEntries(new URL(url).searchParams)).toEqual({
    client_id: 'client',
    scope: 'data:read_write',
    redirect_uri: 'https://gather.example/integrations/callback',
    state: 's',
  })
  vi.unstubAllEnvs()
})

test('finishing a Todoist connection repeats the redirect URI it set out with', async () => {
  const { t } = await seed()
  vi.stubEnv('TODOIST_CLIENT_ID', 'client')
  vi.stubEnv('TODOIST_CLIENT_SECRET', 'secret')
  const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
    Response.json({ access_token: 'token' }),
  )
  vi.stubGlobal('fetch', fetchMock)
  await t.withIdentity(alice).action(api.integrations.completeOAuth, {
    provider: 'todoist',
    groupSlug: HOME,
    code: 'code',
    redirectUri: 'https://gather.example/integrations/callback',
  })
  expect(
    Object.fromEntries(
      new URLSearchParams(String(fetchMock.mock.calls[0][1].body)),
    ),
  ).toEqual({
    client_id: 'client',
    client_secret: 'secret',
    code: 'code',
    redirect_uri: 'https://gather.example/integrations/callback',
  })
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('who a linked task is given to (APP-405)', () => {
  const SECRET = 'bob@elsewhere.example'
  /** A shared project with Alice (the connection's account), Carla and Bob. */
  function sharedProject(
    given: { uid: string | null; peopleStatus?: () => number },
  ) {
    const sent: Record<string, unknown>[] = []
    todoistAnswers((method, path, body) => {
      if (method === 'POST') {
        const [command] = JSON.parse(
          new URLSearchParams(body).get('commands') ?? '[]',
        )
        sent.push(command.args)
        if ('responsible_uid' in command.args) {
          given.uid = command.args.responsible_uid
        }
        return json({ sync_status: { [command.uuid]: 'ok' } })
      }
      const task = {
        id: 't1',
        content: 'Call plumber',
        priority: 1,
        project_id: 'proj',
        responsible_uid: given.uid,
      }
      switch (path) {
        case '/tasks':
          return json({ results: [task], next_cursor: null })
        case '/tasks/t1':
          return json(task)
        case '/projects/proj':
          return json({ is_shared: true }, given.peopleStatus?.() ?? 200)
        case '/projects/proj/collaborators':
          return json({
            results: [
              { id: 'A', name: 'Alice T', email: 'work@alice.example' },
              { id: 'C', name: 'Carla T', email: carla.email.toUpperCase() },
              { id: 'B', name: 'Bob', email: SECRET },
            ],
            next_cursor: null,
          })
        case '/user':
          return json({ id: 'A' })
        default:
          return json({}, 404)
      }
    })
    return sent
  }
  const read = ({ t, todoist }: Awaited<ReturnType<typeof seed>>) =>
    t.withIdentity(alice).action(api.taskLists.getTasks, {
      listId: todoist.listId,
      groupSlug: HOME,
    })
  const give = (
    { t, todoist }: Awaited<ReturnType<typeof seed>>,
    assigneeId: Awaited<ReturnType<typeof seed>>['aliceId'] | null,
  ) =>
    t.withIdentity(alice).action(api.taskLists.writeTask, {
      listId: todoist.listId,
      groupSlug: HOME,
      write: { kind: 'update', taskId: 't1', assigneeId },
    })

  test('a read says which Members it can be, and no address or Todoist id', async () => {
    const seeded = await seed()
    sharedProject({ uid: 'A' })
    const result = await read(seeded)
    expect(result).toMatchObject({
      status: 'ok',
      tasks: [{ externalId: 't1', assigneeId: seeded.aliceId }],
      // Carla is in the project, but no Member of this Group.
      assignable: { shared: true, memberIds: [seeded.aliceId] },
    })
    expect(JSON.stringify(result)).not.toMatch(/example|@|responsibleId/)
  })

  test('someone who is no Member is shown by name', async () => {
    const seeded = await seed()
    sharedProject({ uid: 'B' })
    expect(await read(seeded)).toMatchObject({
      tasks: [{ assigneeName: 'Bob' }],
    })
  })

  test.each([401, 403, 503])('a %i for the people still loads the list', async (status) => {
    const seeded = await seed()
    sharedProject({ uid: 'A', peopleStatus: () => status })
    const result = await read(seeded)
    expect(result).toMatchObject({ status: 'ok', tasks: [{ assigneeName: '' }] })
    expect(result).not.toHaveProperty('assignable')
  })

  test('gives a task to a Member by address, and takes it back', async () => {
    const seeded = await seed()
    await seeded.t.run((ctx) =>
      seedMember(ctx, seeded.home, seeded.carlaId, 'member'),
    )
    const sent = sharedProject({ uid: null })
    expect(await give(seeded, seeded.carlaId)).toMatchObject({
      status: 'ok',
      tasks: [{ assigneeId: seeded.carlaId }],
    })
    const cleared = await give(seeded, null)
    expect(cleared).toMatchObject({ status: 'ok', tasks: [{ externalId: 't1' }] })
    expect(JSON.stringify(cleared)).not.toContain('assignee')
    expect(sent).toEqual([
      { id: 't1', responsible_uid: 'C' },
      { id: 't1', responsible_uid: null },
    ])
  })

  test('a project person who is no Member here cannot be given it', async () => {
    const seeded = await seed()
    const sent = sharedProject({ uid: null })
    expect(await give(seeded, seeded.carlaId)).toEqual({
      status: 'error',
      reason: 'not-assignable',
    })
    expect(sent).toEqual([])
  })

  test('a write that landed while its people could not be read asks for a refresh', async () => {
    const seeded = await seed()
    sharedProject({ uid: 'A', peopleStatus: () => 503 })
    expect(
      await seeded.t.withIdentity(alice).action(api.taskLists.writeTask, {
        listId: seeded.todoist.listId,
        groupSlug: HOME,
        write: { kind: 'update', taskId: 't1', title: 'Plumber' },
      }),
    ).toMatchObject({
      status: 'ok',
      refresh: true,
      tasks: [{ externalId: 't1', assigneeName: '' }],
    })
  })
})
