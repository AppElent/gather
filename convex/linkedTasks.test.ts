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
    return { todoist, notion, local }
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

test('a new Todoist connection asks to read and write', async () => {
  const { t } = await seed()
  vi.stubEnv('TODOIST_CLIENT_ID', 'client')
  const url = await t.withIdentity(alice).action(api.integrations.getAuthorizeUrl, {
    provider: 'todoist',
    redirectUri: 'https://gather.example/integrations/callback',
    state: 's',
  })
  expect(new URL(url).searchParams.get('scope')).toBe('data:read_write')
  vi.unstubAllEnvs()
})
