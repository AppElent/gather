import { afterEach, describe, expect, test, vi } from 'vitest'
import { testConvex } from '../test/convexHarness'
import { api, internal } from './_generated/api'

/**
 * Which household's task lists a caller gets, asserted through the real
 * queries, mutations and action — as a Member of each Group rather than off
 * the rows, because "which Group's page shows it" is the criterion.
 *
 * Lists are Group-scoped content, and so is the provider connection behind a
 * linked list — a Notion token belongs to the household that authorised it.
 * Under `/g/<slug>/tasks` both have to come from the Group in the URL, or the
 * page shows one household's lists at another household's address.
 *
 * The case worth stating twice is Alice's: she is in *both* households, which
 * is exactly what the old caller-wide helper got wrong. It asked "is this list
 * in any Group I am in", so for her the answer was yes at either address.
 */

const alice = { subject: 'clerk_alice', name: 'Alice', email: 'a@example.com' }
const bob = { subject: 'clerk_bob', name: 'Bob', email: 'b@example.com' }
const carla = { subject: 'clerk_carla', name: 'Carla', email: 'c@example.com' }

const JANSEN = 'jansen-household'
const DE_VRIES = 'de-vries-household'
const ME_CARLA = 'me-carla'

const JANSEN_TOKEN = 'jansen-notion-token'

/**
 * Two households — Alice in both, Bob only in the second — and Carla, who is in
 * neither and has only her own Personal group, which is an ordinary Group with
 * one Member and is what "somewhere I am allowed to stand" means for a stranger.
 *
 * Jansen holds a list with one task on it and a Notion connection; De Vries
 * holds a list of its own. `goneList` is an id whose row has been deleted, so a
 * refusal can be compared against the answer for a list that is not there.
 */
async function seed() {
  const t = testConvex()

  const ids = await t.run(async (ctx) => {
    const aliceId = await ctx.db.insert('users', {
      clerkId: alice.subject,
      name: 'Alice',
      email: alice.email,
    })
    const bobId = await ctx.db.insert('users', {
      clerkId: bob.subject,
      name: 'Bob',
      email: bob.email,
    })
    const carlaId = await ctx.db.insert('users', {
      clerkId: carla.subject,
      name: 'Carla',
      email: carla.email,
    })

    const jansen = await ctx.db.insert('groups', {
      name: 'Jansen Household',
      slug: JANSEN,
      isPersonal: false,
      inviteCode: 'jansen',
    })
    const devries = await ctx.db.insert('groups', {
      name: 'De Vries Household',
      slug: DE_VRIES,
      isPersonal: false,
      inviteCode: 'devries',
    })
    const carlaAlone = await ctx.db.insert('groups', {
      name: "Carla's things",
      slug: ME_CARLA,
      isPersonal: true,
      inviteCode: 'me-carla-code',
    })

    for (const [groupId, userId, role] of [
      [jansen, aliceId, 'admin'],
      [devries, aliceId, 'member'],
      [devries, bobId, 'admin'],
      [carlaAlone, carlaId, 'admin'],
    ] as const) {
      await ctx.db.insert('memberships', { groupId, userId, role })
    }

    const jansenList = await ctx.db.insert('taskLists', {
      groupId: jansen,
      name: 'Jansen chores',
      provider: 'local',
      order: 0,
    })
    const devriesList = await ctx.db.insert('taskLists', {
      groupId: devries,
      name: 'De Vries chores',
      provider: 'local',
      order: 0,
    })
    const jansenTask = await ctx.db.insert('tasks', {
      listId: jansenList,
      title: 'Take the bins out',
      done: false,
      createdBy: aliceId,
      order: 0,
    })
    const jansenConnection = await ctx.db.insert('integrationConnections', {
      groupId: jansen,
      provider: 'notion',
      accessToken: JANSEN_TOKEN,
      accountLabel: 'Jansen workspace',
      externalAccountId: 'notion-jansen',
      connectedBy: aliceId,
    })

    // A list that existed and does not any more: the answer for this id is the
    // one every other refusal has to be indistinguishable from.
    const goneList = await ctx.db.insert('taskLists', {
      groupId: jansen,
      name: 'Deleted',
      provider: 'local',
      order: 99,
    })
    await ctx.db.delete(goneList)

    return {
      aliceId,
      jansen,
      devries,
      jansenList,
      devriesList,
      jansenTask,
      jansenConnection,
      goneList,
    }
  })

  return { t, ...ids }
}

/** The message thrown, so two refusals can be compared as strings. */
async function refusal(run: Promise<unknown>): Promise<string> {
  try {
    await run
    return 'no refusal'
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

describe('reading task lists through a Group', () => {
  test('a Member gets the lists of the Group they asked for', async () => {
    const { t } = await seed()

    const jansen = await t
      .withIdentity(alice)
      .query(api.taskLists.list, { groupSlug: JANSEN })
    const devries = await t
      .withIdentity(alice)
      .query(api.taskLists.list, { groupSlug: DE_VRIES })

    expect(jansen.map((l) => l.name)).toEqual(['Jansen chores'])
    expect(devries.map((l) => l.name)).toEqual(['De Vries chores'])
  })

  test('someone outside the Group is refused', async () => {
    const { t } = await seed()

    await expect(
      t.withIdentity(bob).query(api.taskLists.list, { groupSlug: JANSEN }),
    ).rejects.toThrow(/Not a member/)
  })
})

describe('reaching one list', () => {
  test('a Member of both Groups still cannot read it at the other address', async () => {
    const { t, jansenList } = await seed()

    const here = await t
      .withIdentity(alice)
      .query(api.tasks.listByList, {
        listId: jansenList,
        groupSlug: JANSEN,
      })
    expect(here.map((task) => task.title)).toEqual(['Take the bins out'])

    await expect(
      t.withIdentity(alice).query(api.tasks.listByList, {
        listId: jansenList,
        groupSlug: DE_VRIES,
      }),
    ).rejects.toThrow(/List not found/)
  })

  test('a stranger hears what they would hear about a list that is not there', async () => {
    const { t, jansenList, goneList } = await seed()

    const real = await refusal(
      t.withIdentity(carla).query(api.tasks.listByList, {
        listId: jansenList,
        groupSlug: ME_CARLA,
      }),
    )
    const gone = await refusal(
      t.withIdentity(carla).query(api.tasks.listByList, {
        listId: goneList,
        groupSlug: ME_CARLA,
      }),
    )

    expect(real).toMatch(/List not found/)
    expect(real).toBe(gone)
  })

  test('the Group itself is still refused separately', async () => {
    const { t, jansenList } = await seed()

    // Not folded in with the two above: a typo'd or forbidden Group is a
    // different thing from a list that is not in the Group you asked about.
    await expect(
      t.withIdentity(carla).query(api.tasks.listByList, {
        listId: jansenList,
        groupSlug: JANSEN,
      }),
    ).rejects.toThrow(/Not a member/)
  })

  test('renaming and deleting are refused at the other address too', async () => {
    const { t, jansenList } = await seed()

    await expect(
      t.withIdentity(alice).mutation(api.taskLists.rename, {
        listId: jansenList,
        groupSlug: DE_VRIES,
        name: 'Renamed from next door',
      }),
    ).rejects.toThrow(/List not found/)
    await expect(
      t.withIdentity(alice).mutation(api.taskLists.remove, {
        listId: jansenList,
        groupSlug: DE_VRIES,
      }),
    ).rejects.toThrow(/List not found/)

    const jansen = await t
      .withIdentity(alice)
      .query(api.taskLists.list, { groupSlug: JANSEN })
    expect(jansen.map((l) => l.name)).toEqual(['Jansen chores'])
  })

  test('the same list is renamed at its own address', async () => {
    const { t, jansenList } = await seed()

    await t.withIdentity(alice).mutation(api.taskLists.rename, {
      listId: jansenList,
      groupSlug: JANSEN,
      name: 'Chores',
    })

    const jansen = await t
      .withIdentity(alice)
      .query(api.taskLists.list, { groupSlug: JANSEN })
    expect(jansen.map((l) => l.name)).toEqual(['Chores'])
  })

  test('a local list describes its Backend at its own address only', async () => {
    const { t, jansenList } = await seed()

    const backend = await t.withIdentity(alice).query(api.taskLists.backend, {
      listId: jansenList,
      groupSlug: JANSEN,
    })
    expect(backend).toMatchObject({
      provider: 'local',
      readOnly: false,
      source: null,
      sync: null,
      // A local list is this app, so it can do everything this app can.
      capabilities: expect.objectContaining({ create: true, delete: true }),
    })

    await expect(
      t.withIdentity(alice).query(api.taskLists.backend, {
        listId: jansenList,
        groupSlug: DE_VRIES,
      }),
    ).rejects.toThrow(/List not found/)
  })

  test('refreshing a local list is a no-op rather than an error', async () => {
    const { t, jansenList } = await seed()

    // One control in the Module, whatever the Backend — the card does not have
    // to decide whether Refresh exists before offering it.
    expect(
      await t.withIdentity(alice).action(api.taskLists.refresh, {
        listId: jansenList,
        groupSlug: JANSEN,
      }),
    ).toEqual({ status: 'ok', added: 0, updated: 0, deleted: 0 })

    const tasks = await t.withIdentity(alice).query(api.tasks.listByList, {
      listId: jansenList,
      groupSlug: JANSEN,
    })
    expect(tasks.map((task) => task.title)).toEqual(['Take the bins out'])
  })
})

describe('the tasks inside a list', () => {
  test('are added to the Group the URL named, and read back there', async () => {
    const { t, devriesList } = await seed()

    await t.withIdentity(alice).mutation(api.tasks.add, {
      listId: devriesList,
      groupSlug: DE_VRIES,
      title: 'Buy milk',
    })

    const devries = await t.withIdentity(alice).query(api.tasks.listByList, {
      listId: devriesList,
      groupSlug: DE_VRIES,
    })
    expect(devries.map((task) => task.title)).toEqual(['Buy milk'])
  })

  test('cannot be added through another Group the caller is in', async () => {
    const { t, jansenList } = await seed()

    await expect(
      t.withIdentity(alice).mutation(api.tasks.add, {
        listId: jansenList,
        groupSlug: DE_VRIES,
        title: 'Snuck in',
      }),
    ).rejects.toThrow(/List not found/)

    const jansen = await t.withIdentity(alice).query(api.tasks.listByList, {
      listId: jansenList,
      groupSlug: JANSEN,
    })
    expect(jansen.map((task) => task.title)).toEqual(['Take the bins out'])
  })

  test('cannot be ticked, edited, reordered or deleted from another Group', async () => {
    const { t, jansenList, jansenTask } = await seed()

    for (const run of [
      t.withIdentity(alice).mutation(api.tasks.toggleDone, {
        taskId: jansenTask,
        groupSlug: DE_VRIES,
      }),
      t.withIdentity(alice).mutation(api.tasks.update, {
        taskId: jansenTask,
        groupSlug: DE_VRIES,
        title: 'Rewritten from next door',
      }),
      t.withIdentity(alice).mutation(api.tasks.move, {
        taskId: jansenTask,
        groupSlug: DE_VRIES,
        direction: 'down',
      }),
      t.withIdentity(alice).mutation(api.tasks.remove, {
        taskId: jansenTask,
        groupSlug: DE_VRIES,
      }),
    ]) {
      await expect(run).rejects.toThrow(/Task not found/)
    }

    const jansen = await t.withIdentity(alice).query(api.tasks.listByList, {
      listId: jansenList,
      groupSlug: JANSEN,
    })
    expect(jansen).toEqual([
      expect.objectContaining({ title: 'Take the bins out', done: false }),
    ])
  })

  test('a task in another Group reads like a task id that names nothing', async () => {
    const { t, aliceId, jansenList, jansenTask } = await seed()

    const gone = await t.run(async (ctx) => {
      const id = await ctx.db.insert('tasks', {
        listId: jansenList,
        title: 'Deleted',
        done: false,
        createdBy: aliceId,
        order: 9,
      })
      await ctx.db.delete(id)
      return id
    })

    const real = await refusal(
      t.withIdentity(bob).mutation(api.tasks.toggleDone, {
        taskId: jansenTask,
        groupSlug: DE_VRIES,
      }),
    )
    const missing = await refusal(
      t.withIdentity(bob).mutation(api.tasks.toggleDone, {
        taskId: gone,
        groupSlug: DE_VRIES,
      }),
    )

    expect(real).toMatch(/Task not found/)
    expect(real).toBe(missing)
  })
})

describe('a provider connection', () => {
  test('is offered only in the Group that authorised it', async () => {
    const { t } = await seed()

    const jansen = await t
      .withIdentity(alice)
      .query(api.integrations.listConnections, { groupSlug: JANSEN })
    const devries = await t
      .withIdentity(alice)
      .query(api.integrations.listConnections, { groupSlug: DE_VRIES })

    expect(jansen.map((c) => c.accountLabel)).toEqual(['Jansen workspace'])
    expect(devries).toEqual([])
  })

  test('is not listed to someone outside its Group at all', async () => {
    const { t } = await seed()

    await expect(
      t
        .withIdentity(carla)
        .query(api.integrations.listConnections, { groupSlug: JANSEN }),
    ).rejects.toThrow(/Not a member/)
    expect(
      await t
        .withIdentity(carla)
        .query(api.integrations.listConnections, { groupSlug: ME_CARLA }),
    ).toEqual([])
  })

  test('cannot be borrowed by a list created in another Group', async () => {
    const { t, jansenConnection } = await seed()

    await expect(
      t.withIdentity(alice).mutation(api.taskLists.create, {
        name: 'Borrowed',
        provider: 'notion',
        groupSlug: DE_VRIES,
        providerConfig: {
          connectionId: jansenConnection,
          sourceId: 'db1',
          propertyMapping: { title: 'Name', done: 'Done' },
        },
      }),
    ).rejects.toThrow(/does not belong to this group/)
  })

  test('cannot be disconnected from another Group the caller is in', async () => {
    const { t, jansenConnection } = await seed()

    // A no-op rather than an error: a connection that is not in this Group and
    // one that has already gone must not be told apart.
    await t.withIdentity(alice).mutation(api.integrations.disconnect, {
      connectionId: jansenConnection,
      groupSlug: DE_VRIES,
    })

    const jansen = await t
      .withIdentity(alice)
      .query(api.integrations.listConnections, { groupSlug: JANSEN })
    expect(jansen.map((c) => c.accountLabel)).toEqual(['Jansen workspace'])
  })

  test('is disconnected at its own address, and keeps saying which account it was', async () => {
    const { t, jansenConnection } = await seed()

    await t.withIdentity(alice).mutation(api.integrations.disconnect, {
      connectionId: jansenConnection,
      groupSlug: JANSEN,
    })

    // The row outlives its token. A linked list has to be able to name the
    // account it is waiting on, and reconnecting that account has to land
    // back here rather than on a fresh row the list knows nothing about.
    expect(
      await t
        .withIdentity(alice)
        .query(api.integrations.listConnections, { groupSlug: JANSEN }),
    ).toEqual([
      expect.objectContaining({
        accountLabel: 'Jansen workspace',
        status: 'disconnected',
      }),
    ])
    // The token itself is gone from the row, not merely hidden from readers.
    expect(
      await t.run(
        async (ctx) => (await ctx.db.get(jansenConnection))?.accessToken ?? null,
      ),
    ).toBeNull()
  })

  test('is not usable as a source of truth once disconnected', async () => {
    const { t, jansenConnection } = await seed()

    await t.withIdentity(alice).mutation(api.integrations.disconnect, {
      connectionId: jansenConnection,
      groupSlug: JANSEN,
    })

    await expect(
      t.withIdentity(alice).mutation(api.taskLists.create, {
        name: 'Linked to nothing',
        provider: 'notion',
        groupSlug: JANSEN,
        providerConfig: {
          connectionId: jansenConnection,
          sourceId: 'db1',
          propertyMapping: { title: 'Name', done: 'Done' },
        },
      }),
    ).rejects.toThrow(/disconnected/)
  })
})

describe('a Group with more than one account at the same provider', () => {
  test('keeps both, and reconnecting one of them refills that one', async () => {
    const { t, jansen, aliceId } = await seed()

    await t.mutation(internal.integrations.storeConnection, {
      groupId: jansen,
      provider: 'todoist',
      accessToken: 'token-shared',
      accountLabel: 'household@example.com',
      externalAccountId: 'todoist-1',
      connectedBy: aliceId,
    })
    await t.mutation(internal.integrations.storeConnection, {
      groupId: jansen,
      provider: 'todoist',
      accessToken: 'token-alice',
      accountLabel: 'alice@example.com',
      externalAccountId: 'todoist-2',
      connectedBy: aliceId,
    })

    const both = await t
      .withIdentity(alice)
      .query(api.integrations.listConnections, { groupSlug: JANSEN })
    expect(
      both.filter((c) => c.provider === 'todoist').map((c) => c.accountLabel),
    ).toEqual(['household@example.com', 'alice@example.com'])

    // Re-authorising the shared account is that account again, not a third
    // connection — the account decides, not the provider.
    await t.mutation(internal.integrations.storeConnection, {
      groupId: jansen,
      provider: 'todoist',
      accessToken: 'token-shared-rotated',
      accountLabel: 'household@example.com',
      externalAccountId: 'todoist-1',
      connectedBy: aliceId,
    })

    const after = await t
      .withIdentity(alice)
      .query(api.integrations.listConnections, { groupSlug: JANSEN })
    expect(after.filter((c) => c.provider === 'todoist')).toHaveLength(2)
  })

  test('reconnecting a disconnected account puts its lists back to work', async () => {
    const { t, jansen, aliceId } = await seed()

    const connectionId = await t.mutation(
      internal.integrations.storeConnection,
      {
        groupId: jansen,
        provider: 'todoist',
        accessToken: 'token-shared',
        accountLabel: 'household@example.com',
        externalAccountId: 'todoist-1',
        connectedBy: aliceId,
      },
    )
    await t.withIdentity(alice).mutation(api.taskLists.create, {
      name: 'Household',
      provider: 'todoist',
      groupSlug: JANSEN,
      providerConfig: { connectionId, sourceId: 'p1', sourceName: 'Household' },
    })
    await t.withIdentity(alice).mutation(api.integrations.disconnect, {
      connectionId,
      groupSlug: JANSEN,
    })

    const whileGone = await t
      .withIdentity(alice)
      .query(api.taskLists.list, { groupSlug: JANSEN })
    expect(whileGone.find((l) => l.name === 'Household')?.source).toMatchObject({
      connectionStatus: 'disconnected',
    })

    const reconnected = await t.mutation(
      internal.integrations.storeConnection,
      {
        groupId: jansen,
        provider: 'todoist',
        accessToken: 'token-shared-again',
        accountLabel: 'household@example.com',
        externalAccountId: 'todoist-1',
        connectedBy: aliceId,
      },
    )
    // The same row, so the list's own connectionId still points at it.
    expect(reconnected).toBe(connectionId)
    const back = await t
      .withIdentity(alice)
      .query(api.taskLists.list, { groupSlug: JANSEN })
    expect(back.find((l) => l.name === 'Household')?.source).toMatchObject({
      connectionStatus: 'connected',
    })
  })

  test('one connection backs several lists, each with its own source', async () => {
    const { t, jansen, aliceId } = await seed()

    const connectionId = await t.mutation(
      internal.integrations.storeConnection,
      {
        groupId: jansen,
        provider: 'todoist',
        accessToken: 'token-shared',
        accountLabel: 'household@example.com',
        externalAccountId: 'todoist-1',
        connectedBy: aliceId,
      },
    )
    for (const [sourceId, sourceName] of [
      ['p1', 'Groceries'],
      ['p2', 'Renovation'],
    ]) {
      await t.withIdentity(alice).mutation(api.taskLists.create, {
        name: sourceName,
        provider: 'todoist',
        groupSlug: JANSEN,
        providerConfig: { connectionId, sourceId, sourceName },
      })
    }

    const lists = await t
      .withIdentity(alice)
      .query(api.taskLists.list, { groupSlug: JANSEN })
    const linked = lists.filter((l) => l.provider === 'todoist')
    expect(
      linked.map((l) => [l.source?.sourceName, l.source?.accountLabel]),
    ).toEqual([
      ['Groceries', 'household@example.com'],
      ['Renovation', 'household@example.com'],
    ])
    // Reuse, not duplication: no second OAuth round trip was needed for the
    // second list.
    expect(new Set(linked.map((l) => l.source?.connectionId)).size).toBe(1)
  })

  test('a connection cannot be reached from a Group it is not in', async () => {
    const { t, jansenConnection } = await seed()

    // Alice is a Member of De Vries too, which is exactly the case a
    // caller-wide check would let through.
    await expect(
      t.withIdentity(alice).action(api.integrations.listSources, {
        connectionId: jansenConnection,
        groupSlug: DE_VRIES,
      }),
    ).rejects.toThrow(/Connection not found/)
  })
})

describe('the access token', () => {
  test('is returned by no public function', async () => {
    const { t, jansenList } = await seed()
    const as = t.withIdentity(alice)

    const results = [
      await as.query(api.taskLists.list, { groupSlug: JANSEN }),
      await as.query(api.tasks.listByList, {
        listId: jansenList,
        groupSlug: JANSEN,
      }),
      await as.query(api.integrations.listConnections, { groupSlug: JANSEN }),
      await as.query(api.taskLists.backend, {
        listId: jansenList,
        groupSlug: JANSEN,
      }),
    ]

    for (const result of results) {
      const json = JSON.stringify(result)
      expect(json).not.toContain(JANSEN_TOKEN)
      expect(json).not.toContain('accessToken')
    }
    // The connection is genuinely there to be leaked — a test that passed
    // because nothing came back would prove nothing.
    const connections = await as.query(api.integrations.listConnections, {
      groupSlug: JANSEN,
    })
    expect(connections).toHaveLength(1)
  })
})

describe('adding a list from inside a Group', () => {
  test('puts it in the Group the URL named', async () => {
    const { t } = await seed()

    await t.withIdentity(alice).mutation(api.taskLists.create, {
      name: 'Groceries',
      provider: 'local',
      groupSlug: DE_VRIES,
    })

    const devries = await t
      .withIdentity(alice)
      .query(api.taskLists.list, { groupSlug: DE_VRIES })
    const jansen = await t
      .withIdentity(alice)
      .query(api.taskLists.list, { groupSlug: JANSEN })

    expect(devries.map((l) => l.name)).toEqual(['De Vries chores', 'Groceries'])
    expect(jansen.map((l) => l.name)).toEqual(['Jansen chores'])
  })

  test('is refused for a Group you are not a Member of', async () => {
    const { t } = await seed()

    await expect(
      t.withIdentity(bob).mutation(api.taskLists.create, {
        name: 'Groceries',
        provider: 'local',
        groupSlug: JANSEN,
      }),
    ).rejects.toThrow(/Not a member/)
  })
})

/**
 * An external list, from the point of view of somebody reading it.
 *
 * The provider owns these tasks and gather holds a cache (ADR-0013), so the
 * behaviour worth asserting is what a Member can read, when it is refreshed,
 * and what happens to what they were reading when the provider stops
 * answering. The Todoist API is a stubbed `fetch`; what it returns is the
 * provider's answer.
 */
describe('a Todoist-backed list', () => {
  const todoistTask = (id: string, content: string, over = {}) => ({
    id,
    content,
    priority: 1,
    ...over,
  })

  /** Jansen, with a Todoist connection and a list linked to one project. */
  async function seedLinked() {
    const base = await seed()
    const connectionId = await base.t.mutation(
      internal.integrations.storeConnection,
      {
        groupId: base.jansen,
        provider: 'todoist',
        accessToken: 'todoist-token',
        accountLabel: 'household@example.com',
        externalAccountId: 'todoist-1',
        connectedBy: base.aliceId,
      },
    )
    const listId = await base.t
      .withIdentity(alice)
      .mutation(api.taskLists.create, {
        name: 'Household',
        provider: 'todoist',
        groupSlug: JANSEN,
        providerConfig: {
          connectionId,
          sourceId: 'p1',
          sourceName: 'Household',
        },
      })
    return { ...base, connectionId, listId }
  }

  /**
   * Answer the next provider read with these tasks, or with a failure.
   *
   * A read is two requests — the open tasks from REST, the finished ones from
   * the Sync API — because Todoist drops a completed task out of `/tasks`
   * entirely and a list that fetched only the active ones would make
   * completing something look exactly like deleting it.
   */
  function provider(
    active: unknown[] | { status: number },
    completed: unknown[] = [],
  ) {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (!Array.isArray(active)) {
          return Promise.resolve(new Response('{}', { status: active.status }))
        }
        const body = String(url).includes('/completed/get_all')
          ? { items: completed }
          : active
        return Promise.resolve(
          new Response(JSON.stringify(body), { status: 200 }),
        )
      }),
    )
  }

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  async function tasksIn(
    t: Awaited<ReturnType<typeof seedLinked>>['t'],
    listId: Awaited<ReturnType<typeof seedLinked>>['listId'],
  ) {
    return await t
      .withIdentity(alice)
      .query(api.tasks.listByList, { listId, groupSlug: JANSEN })
  }

  test('has nothing until it is first read, and holds what it read', async () => {
    const { t, listId } = await seedLinked()

    const before = await t.withIdentity(alice).query(api.taskLists.backend, {
      listId,
      groupSlug: JANSEN,
    })
    expect(before.sync).toMatchObject({ neverSynced: true, state: 'ready' })
    expect(await tasksIn(t, listId)).toEqual([])

    provider([todoistTask('t1', 'Water plants'), todoistTask('t2', 'Bins')])
    expect(
      await t
        .withIdentity(alice)
        .action(api.taskLists.refresh, { listId, groupSlug: JANSEN }),
    ).toEqual({ status: 'ok', added: 2, updated: 0, deleted: 0 })

    expect((await tasksIn(t, listId)).map((task) => task.title)).toEqual([
      'Water plants',
      'Bins',
    ])
    const after = await t.withIdentity(alice).query(api.taskLists.backend, {
      listId,
      groupSlug: JANSEN,
    })
    expect(after.sync?.neverSynced).toBe(false)
    expect(after.sync?.lastSyncedAt).toBeTypeOf('number')
    expect(after.readOnly).toBe(false)
  })

  test('the provider wins the next time it is asked', async () => {
    const { t, listId } = await seedLinked()
    provider([todoistTask('t1', 'Water plants'), todoistTask('t2', 'Bins')])
    await t
      .withIdentity(alice)
      .action(api.taskLists.refresh, { listId, groupSlug: JANSEN })

    // Renamed there, and one of them deleted there.
    provider([todoistTask('t1', 'Water the plants')])
    expect(
      await t
        .withIdentity(alice)
        .action(api.taskLists.refresh, { listId, groupSlug: JANSEN }),
    ).toEqual({ status: 'ok', added: 0, updated: 1, deleted: 1 })

    expect((await tasksIn(t, listId)).map((task) => task.title)).toEqual([
      'Water the plants',
    ])
  })

  test('a provider that will not answer leaves the last tasks readable, and read-only', async () => {
    const { t, listId } = await seedLinked()
    provider([todoistTask('t1', 'Water plants')])
    await t
      .withIdentity(alice)
      .action(api.taskLists.refresh, { listId, groupSlug: JANSEN })

    provider({ status: 500 })
    const result = await t
      .withIdentity(alice)
      .action(api.taskLists.refresh, { listId, groupSlug: JANSEN })
    expect(result.status).toBe('error')

    // Still there — the last thing Todoist said is more use than an empty
    // card — but the list now says so, and nothing may be written to it.
    expect((await tasksIn(t, listId)).map((task) => task.title)).toEqual([
      'Water plants',
    ])
    const backendView = await t
      .withIdentity(alice)
      .query(api.taskLists.backend, { listId, groupSlug: JANSEN })
    expect(backendView.sync?.state).toBe('stale')
    expect(backendView.readOnly).toBe(true)
  })

  test('a provider that answers again clears the staleness', async () => {
    const { t, listId } = await seedLinked()
    provider({ status: 500 })
    await t
      .withIdentity(alice)
      .action(api.taskLists.refresh, { listId, groupSlug: JANSEN })

    provider([todoistTask('t1', 'Water plants')])
    await t
      .withIdentity(alice)
      .action(api.taskLists.refresh, { listId, groupSlug: JANSEN })

    const backendView = await t
      .withIdentity(alice)
      .query(api.taskLists.backend, { listId, groupSlug: JANSEN })
    expect(backendView.sync?.state).toBe('ready')
    expect(backendView.readOnly).toBe(false)
  })

  test('a rejected token asks for a reconnect rather than reporting a fault', async () => {
    const { t, listId } = await seedLinked()
    provider([todoistTask('t1', 'Water plants')])
    await t
      .withIdentity(alice)
      .action(api.taskLists.refresh, { listId, groupSlug: JANSEN })

    provider({ status: 401 })
    expect(
      await t
        .withIdentity(alice)
        .action(api.taskLists.refresh, { listId, groupSlug: JANSEN }),
    ).toEqual({ status: 'reconnect', provider: 'todoist' })
  })

  test('a disconnected account leaves the cache readable and points at the way back', async () => {
    const { t, listId, connectionId } = await seedLinked()
    provider([todoistTask('t1', 'Water plants')])
    await t
      .withIdentity(alice)
      .action(api.taskLists.refresh, { listId, groupSlug: JANSEN })

    await t.withIdentity(alice).mutation(api.integrations.disconnect, {
      connectionId,
      groupSlug: JANSEN,
    })

    expect((await tasksIn(t, listId)).map((task) => task.title)).toEqual([
      'Water plants',
    ])
    const backendView = await t
      .withIdentity(alice)
      .query(api.taskLists.backend, { listId, groupSlug: JANSEN })
    expect(backendView.sync?.state).toBe('reconnect')
    expect(backendView.readOnly).toBe(true)
    // The card can name the account to reconnect, which is the whole point of
    // the row outliving its token.
    expect(backendView.source).toMatchObject({
      accountLabel: 'household@example.com',
      connectionStatus: 'disconnected',
      sourceName: 'Household',
    })
  })

  test('is refreshed and described only at its own Group’s address', async () => {
    const { t, listId } = await seedLinked()
    provider([todoistTask('t1', 'Water plants')])

    for (const run of [
      t
        .withIdentity(alice)
        .action(api.taskLists.refresh, { listId, groupSlug: DE_VRIES }),
      t
        .withIdentity(alice)
        .query(api.taskLists.backend, { listId, groupSlug: DE_VRIES }),
      t
        .withIdentity(alice)
        .query(api.tasks.listByList, { listId, groupSlug: DE_VRIES }),
    ]) {
      await expect(run).rejects.toThrow(/List not found/)
    }
  })

  test('its cached tasks are never local tasks', async () => {
    const { t, listId } = await seedLinked()
    provider([todoistTask('t1', 'Water plants')])
    await t
      .withIdentity(alice)
      .action(api.taskLists.refresh, { listId, groupSlug: JANSEN })

    const [cachedTask] = await tasksIn(t, listId)
    // Every local write path refuses an external list, so a change gather
    // could not send to Todoist cannot be made to look as though it had been.
    for (const run of [
      t.withIdentity(alice).mutation(api.tasks.add, {
        listId,
        groupSlug: JANSEN,
        title: 'Written locally',
      }),
      t.withIdentity(alice).mutation(api.tasks.toggleDone, {
        taskId: cachedTask._id,
        groupSlug: JANSEN,
      }),
      t.withIdentity(alice).mutation(api.tasks.remove, {
        taskId: cachedTask._id,
        groupSlug: JANSEN,
      }),
    ]) {
      await expect(run).rejects.toThrow(/read-only/)
    }
  })
})

describe('what a Backend says it can do', () => {
  test('a Notion list is read-only, and says which fields it has at all', async () => {
    const { t, jansen, aliceId, jansenConnection } = await seed()
    const listId = await t.run(
      async (ctx) =>
        await ctx.db.insert('taskLists', {
          groupId: jansen,
          name: 'Notion chores',
          provider: 'notion',
          order: 5,
          providerConfig: {
            connectionId: jansenConnection,
            sourceId: 'db1',
            // No date, priority or labels property mapped: this database does
            // not have them, whatever Notion supports in general.
            propertyMapping: { title: 'Name', done: 'Done' },
          },
        }),
    )
    expect(aliceId).toBeDefined()

    const backendView = await t
      .withIdentity(alice)
      .query(api.taskLists.backend, { listId, groupSlug: JANSEN })
    expect(backendView.capabilities).toMatchObject({
      create: false,
      edit: false,
      complete: false,
      delete: false,
      subtasks: false,
      dueDate: false,
      priority: false,
      labels: false,
    })
  })
})

/**
 * Writing to a Todoist-backed list.
 *
 * Todoist owns these tasks, so every write goes there first and the cache is
 * updated only once Todoist has agreed (ADR-0013). What these assert is that
 * order, from the outside: what Todoist was sent, what the cache says
 * afterwards, and — when Todoist refuses — that the cache says exactly what it
 * said before.
 */
describe('writing through Todoist', () => {
  async function seedLinkedWithTask() {
    const base = await seed()
    const connectionId = await base.t.mutation(
      internal.integrations.storeConnection,
      {
        groupId: base.jansen,
        provider: 'todoist',
        accessToken: 'todoist-token',
        accountLabel: 'household@example.com',
        externalAccountId: 'todoist-1',
        connectedBy: base.aliceId,
      },
    )
    const listId = await base.t
      .withIdentity(alice)
      .mutation(api.taskLists.create, {
        name: 'Household',
        provider: 'todoist',
        groupSlug: JANSEN,
        providerConfig: {
          connectionId,
          sourceId: 'p1',
          sourceName: 'Household',
        },
      })
    // One task already in Todoist and already cached.
    stubTodoist(() =>
      jsonBody([{ id: 't1', content: 'Water plants', priority: 1 }]),
    )
    await base.t
      .withIdentity(alice)
      .action(api.taskLists.refresh, { listId, groupSlug: JANSEN })
    const [cachedTask] = await base.t
      .withIdentity(alice)
      .query(api.tasks.listByList, { listId, groupSlug: JANSEN })
    return { ...base, connectionId, listId, cachedTask }
  }

  function jsonBody(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status })
  }

  /** Answer every provider request with whatever this returns for its URL. */
  function stubTodoist(respond: (url: string) => Response) {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        calls.push({ url: String(url), init })
        return Promise.resolve(
          String(url).includes('/completed/get_all')
            ? jsonBody({ items: [] })
            : respond(String(url)),
        )
      }),
    )
    return calls
  }

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  async function tasksIn(
    t: Awaited<ReturnType<typeof seedLinkedWithTask>>['t'],
    listId: Awaited<ReturnType<typeof seedLinkedWithTask>>['listId'],
  ) {
    return await t
      .withIdentity(alice)
      .query(api.tasks.listByList, { listId, groupSlug: JANSEN })
  }

  test('a new task goes to Todoist first, and the cache takes Todoist’s version', async () => {
    const { t, listId } = await seedLinkedWithTask()
    const calls = stubTodoist(() =>
      // Todoist normalised the title; the cache believes Todoist, not us.
      jsonBody({ id: 'new-1', content: 'Buy milk (2L)', priority: 1 }),
    )

    expect(
      await t.withIdentity(alice).action(api.externalTasks.create, {
        listId,
        groupSlug: JANSEN,
        title: 'Buy milk',
      }),
    ).toEqual({ status: 'ok' })

    expect(calls[0].url).toContain('/tasks')
    expect(calls[0].init?.method).toBe('POST')
    expect((await tasksIn(t, listId)).map((task) => task.title)).toEqual([
      'Water plants',
      'Buy milk (2L)',
    ])
  })

  test('an edit reaches Todoist and then the cache', async () => {
    const { t, listId, cachedTask } = await seedLinkedWithTask()
    stubTodoist(() =>
      jsonBody({ id: 't1', content: 'Water the plants', priority: 4 }),
    )

    await t.withIdentity(alice).action(api.externalTasks.update, {
      taskId: cachedTask._id,
      groupSlug: JANSEN,
      title: 'Water the plants',
    })

    expect((await tasksIn(t, listId))[0]).toMatchObject({
      title: 'Water the plants',
      priority: 1,
    })
  })

  test('completing and reopening survive the round trip', async () => {
    const { t, listId, cachedTask } = await seedLinkedWithTask()
    const calls = stubTodoist(() => new Response(null, { status: 204 }))

    await t.withIdentity(alice).action(api.externalTasks.setDone, {
      taskId: cachedTask._id,
      groupSlug: JANSEN,
      done: true,
    })
    expect(calls.at(-1)?.url).toContain('/close')
    expect((await tasksIn(t, listId))[0].done).toBe(true)

    await t.withIdentity(alice).action(api.externalTasks.setDone, {
      taskId: cachedTask._id,
      groupSlug: JANSEN,
      done: false,
    })
    expect(calls.at(-1)?.url).toContain('/reopen')
    expect((await tasksIn(t, listId))[0].done).toBe(false)
  })

  test('a deletion Todoist accepted is a deletion here', async () => {
    const { t, listId, cachedTask } = await seedLinkedWithTask()
    stubTodoist(() => new Response(null, { status: 204 }))

    await t.withIdentity(alice).action(api.externalTasks.remove, {
      taskId: cachedTask._id,
      groupSlug: JANSEN,
    })

    expect(await tasksIn(t, listId)).toEqual([])
  })

  test('a write Todoist refused changes nothing here', async () => {
    const { t, listId, cachedTask } = await seedLinkedWithTask()
    stubTodoist(() => jsonBody({}, 400))

    await expect(
      t.withIdentity(alice).action(api.externalTasks.update, {
        taskId: cachedTask._id,
        groupSlug: JANSEN,
        title: 'Never sent',
      }),
    ).rejects.toThrow(/refused that change/)

    // The point of provider-first: an unacknowledged write leaves no trace.
    expect((await tasksIn(t, listId))[0].title).toBe('Water plants')
  })

  test('each kind of provider failure says what to do about it', async () => {
    const { t, cachedTask } = await seedLinkedWithTask()

    for (const [status, expected] of [
      [401, /expired/],
      [429, /busy/],
      [404, /no longer in todoist/i],
      [500, /refused/],
    ] as const) {
      stubTodoist(() => jsonBody({}, status))
      await expect(
        t.withIdentity(alice).action(api.externalTasks.remove, {
          taskId: cachedTask._id,
          groupSlug: JANSEN,
        }),
      ).rejects.toThrow(expected)
    }
  })

  test('a disconnected account cannot be written through', async () => {
    const { t, listId, cachedTask, connectionId } = await seedLinkedWithTask()
    await t.withIdentity(alice).mutation(api.integrations.disconnect, {
      connectionId,
      groupSlug: JANSEN,
    })
    const calls = stubTodoist(() => jsonBody({ id: 'x', content: 'x', priority: 1 }))

    for (const run of [
      t.withIdentity(alice).action(api.externalTasks.create, {
        listId,
        groupSlug: JANSEN,
        title: 'While disconnected',
      }),
      t.withIdentity(alice).action(api.externalTasks.remove, {
        taskId: cachedTask._id,
        groupSlug: JANSEN,
      }),
    ]) {
      await expect(run).rejects.toThrow(/disconnected/)
    }
    // Refused before anything left the building — no token to leave with.
    expect(calls).toEqual([])
  })

  test('is refused from another Group the caller is in', async () => {
    const { t, listId, cachedTask } = await seedLinkedWithTask()
    stubTodoist(() => jsonBody({ id: 'x', content: 'x', priority: 1 }))

    await expect(
      t.withIdentity(alice).action(api.externalTasks.create, {
        listId,
        groupSlug: DE_VRIES,
        title: 'Snuck in',
      }),
    ).rejects.toThrow(/List not found/)
    await expect(
      t.withIdentity(alice).action(api.externalTasks.setDone, {
        taskId: cachedTask._id,
        groupSlug: DE_VRIES,
        done: true,
      }),
    ).rejects.toThrow(/List not found/)
  })

  test('a write the cache did not record is saved, and says so until a refresh', async () => {
    const { t, listId } = await seedLinkedWithTask()

    // The state itself, reached the way the action reaches it. It is not an
    // error: Todoist took the change, and only gather's copy is behind.
    await t.mutation(internal.externalTasks.markPendingReconciliation, {
      listId,
    })
    expect(
      (
        await t
          .withIdentity(alice)
          .query(api.taskLists.backend, { listId, groupSlug: JANSEN })
      ).sync?.pendingReconciliation,
    ).toBe(true)

    stubTodoist(() =>
      jsonBody([{ id: 't1', content: 'Water plants', priority: 1 }]),
    )
    await t
      .withIdentity(alice)
      .action(api.taskLists.refresh, { listId, groupSlug: JANSEN })

    expect(
      (
        await t
          .withIdentity(alice)
          .query(api.taskLists.backend, { listId, groupSlug: JANSEN })
      ).sync?.pendingReconciliation,
    ).toBe(false)
  })

  test('a local list is not written through the external path', async () => {
    const { t, jansenList } = await seedLinkedWithTask()

    await expect(
      t.withIdentity(alice).action(api.externalTasks.create, {
        listId: jansenList,
        groupSlug: JANSEN,
        title: 'x',
      }),
    ).rejects.toThrow(/written locally/)
  })
})
