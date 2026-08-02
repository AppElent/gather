import { describe, expect, test } from 'vitest'
import { testConvex } from '../test/convexHarness'
import { api } from './_generated/api'

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

  test('a local list loads through the unified action, at its own address only', async () => {
    const { t, jansenList } = await seed()

    const result = await t
      .withIdentity(alice)
      .action(api.taskLists.getTasks, {
        listId: jansenList,
        groupSlug: JANSEN,
      })
    expect(result).toEqual({
      status: 'ok',
      tasks: [
        expect.objectContaining({ title: 'Take the bins out', done: false }),
      ],
    })

    await expect(
      t.withIdentity(alice).action(api.taskLists.getTasks, {
        listId: jansenList,
        groupSlug: DE_VRIES,
      }),
    ).rejects.toThrow(/List not found/)
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

  test('is disconnected at its own address', async () => {
    const { t, jansenConnection } = await seed()

    await t.withIdentity(alice).mutation(api.integrations.disconnect, {
      connectionId: jansenConnection,
      groupSlug: JANSEN,
    })

    expect(
      await t
        .withIdentity(alice)
        .query(api.integrations.listConnections, { groupSlug: JANSEN }),
    ).toEqual([])
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
      await as.action(api.taskLists.getTasks, {
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
