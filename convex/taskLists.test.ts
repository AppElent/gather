import { describe, expect, test } from 'vitest'
import { testConvex } from '../test/convexHarness'
import { api } from './_generated/api'

/**
 * Which household's task lists a caller gets, asserted through the real
 * queries.
 *
 * Lists are Group-scoped content, and so is the provider connection behind a
 * linked list — a Notion token belongs to the household that authorised it.
 * Under `/g/<slug>/tasks` both have to come from the Group in the URL, or the
 * page shows one household's lists at another household's address.
 */

const alice = { subject: 'clerk_alice', name: 'Alice', email: 'a@example.com' }
const bob = { subject: 'clerk_bob', name: 'Bob', email: 'b@example.com' }

/** Two households; Alice is in both, Bob only in the second. */
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

    const jansen = await ctx.db.insert('groups', {
      name: 'Jansen Household',
      slug: 'jansen-household',
      isPersonal: false,
      inviteCode: 'jansen',
    })
    const devries = await ctx.db.insert('groups', {
      name: 'De Vries Household',
      slug: 'de-vries-household',
      isPersonal: false,
      inviteCode: 'devries',
    })

    for (const [groupId, userId, role] of [
      [jansen, aliceId, 'admin'],
      [devries, aliceId, 'member'],
      [devries, bobId, 'admin'],
    ] as const) {
      await ctx.db.insert('memberships', { groupId, userId, role })
    }

    await ctx.db.insert('taskLists', {
      groupId: jansen,
      name: 'Jansen chores',
      provider: 'local',
      order: 0,
    })
    await ctx.db.insert('taskLists', {
      groupId: devries,
      name: 'De Vries chores',
      provider: 'local',
      order: 0,
    })
    await ctx.db.insert('integrationConnections', {
      groupId: jansen,
      provider: 'notion',
      accessToken: 'jansen-token',
      accountLabel: 'Jansen workspace',
      connectedBy: aliceId,
    })

    return { jansen, devries }
  })

  return { t, ...ids }
}

describe('reading task lists through a Group', () => {
  test('a Member gets the lists of the Group they asked for', async () => {
    const { t } = await seed()

    const jansen = await t
      .withIdentity(alice)
      .query(api.taskLists.list, { groupSlug: 'jansen-household' })
    const devries = await t
      .withIdentity(alice)
      .query(api.taskLists.list, { groupSlug: 'de-vries-household' })

    expect(jansen?.map((l) => l.name)).toEqual(['Jansen chores'])
    expect(devries?.map((l) => l.name)).toEqual(['De Vries chores'])
  })

  test('someone outside the Group is refused', async () => {
    const { t } = await seed()

    await expect(
      t
        .withIdentity(bob)
        .query(api.taskLists.list, { groupSlug: 'jansen-household' }),
    ).rejects.toThrow(/Not a member/)
  })
})

describe('a provider connection', () => {
  test('is offered only in the Group that authorised it', async () => {
    const { t } = await seed()

    const jansen = await t
      .withIdentity(alice)
      .query(api.integrations.listConnections, {
        groupSlug: 'jansen-household',
      })
    const devries = await t
      .withIdentity(alice)
      .query(api.integrations.listConnections, {
        groupSlug: 'de-vries-household',
      })

    expect(jansen.map((c) => c.accountLabel)).toEqual(['Jansen workspace'])
    expect(devries).toEqual([])
  })

  test('cannot be borrowed by a list created in another Group', async () => {
    const { t } = await seed()

    const jansenConnection = (
      await t
        .withIdentity(alice)
        .query(api.integrations.listConnections, {
          groupSlug: 'jansen-household',
        })
    )[0]

    await expect(
      t.withIdentity(alice).mutation(api.taskLists.create, {
        name: 'Borrowed',
        provider: 'notion',
        groupSlug: 'de-vries-household',
        providerConfig: {
          connectionId: jansenConnection._id,
          sourceId: 'db1',
          propertyMapping: { title: 'Name', done: 'Done' },
        },
      }),
    ).rejects.toThrow(/does not belong to this group/)
  })
})

describe('adding a list from inside a Group', () => {
  test('puts it in the Group the URL named', async () => {
    const { t } = await seed()

    await t.withIdentity(alice).mutation(api.taskLists.create, {
      name: 'Groceries',
      provider: 'local',
      groupSlug: 'de-vries-household',
    })

    const devries = await t
      .withIdentity(alice)
      .query(api.taskLists.list, { groupSlug: 'de-vries-household' })
    const jansen = await t
      .withIdentity(alice)
      .query(api.taskLists.list, { groupSlug: 'jansen-household' })

    expect(devries?.map((l) => l.name)).toEqual(['De Vries chores', 'Groceries'])
    expect(jansen?.map((l) => l.name)).toEqual(['Jansen chores'])
  })

  test('is refused for a Group you are not a Member of', async () => {
    const { t } = await seed()

    await expect(
      t.withIdentity(bob).mutation(api.taskLists.create, {
        name: 'Groceries',
        provider: 'local',
        groupSlug: 'jansen-household',
      }),
    ).rejects.toThrow(/Not a member/)
  })
})
