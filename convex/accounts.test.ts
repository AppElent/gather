import { describe, expect, test } from 'vitest'
import { testConvex } from '../test/convexHarness'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'

/**
 * Deleting an account, asserted from both ends.
 *
 * The deletions are the easy half. What this file is really for is the
 * survivals: a household somebody shares must come through their leaving with
 * everything in it, because the one thing account deletion must never be is a
 * way to take a shared history down on your way out.
 */

type Harness = ReturnType<typeof testConvex>

const asAlice = {
  subject: 'clerk_alice',
  name: 'Alice',
  email: 'alice@example.com',
}
const asBob = { subject: 'clerk_bob', name: 'Bob', email: 'bob@example.com' }

async function signUp(t: Harness, identity: typeof asAlice) {
  await t.withIdentity(identity).mutation(api.users.ensureUser, {})
}

async function userId(t: Harness, identity: typeof asAlice) {
  const user = await t.withIdentity(identity).query(api.users.me, {})
  if (!user) throw new Error('no user row')
  return user._id
}

/**
 * Run the account purge to completion.
 *
 * It is a chain of scheduled steps — one Group each — so a single flush only
 * gets through the first link. Draining it is what the app's own scheduler
 * does for free.
 */
async function settle(t: Harness) {
  for (let i = 0; i < 30; i++) {
    // A `runAfter(0)` is a `setTimeout`, and the harness only waits for steps
    // whose timer has already fired — so each turn of the chain needs a
    // macrotask of its own before there is anything to wait for.
    await new Promise((resolve) => setTimeout(resolve, 0))
    await t.finishInProgressScheduledFunctions()
  }
}

async function deleteAccount(t: Harness, identity: typeof asAlice) {
  await t.withIdentity(identity).mutation(api.accounts.deleteAccount, {})
  await settle(t)
}

/** A Group with a second member in it, and Alice as its admin. */
async function sharedGroup(t: Harness, alice: Id<'users'>, bob: Id<'users'>) {
  return await t.run(async (ctx) => {
    const groupId = await ctx.db.insert('groups', {
      name: 'Household',
      slug: 'household',
      isPersonal: false,
      inviteCode: 'abc123',
    })
    await ctx.db.insert('memberships', {
      groupId,
      userId: alice,
      role: 'admin',
    })
    await ctx.db.insert('memberships', { groupId, userId: bob, role: 'member' })
    return groupId
  })
}

/** A Group only Alice is in. */
async function soloGroup(t: Harness, alice: Id<'users'>) {
  return await t.run(async (ctx) => {
    const groupId = await ctx.db.insert('groups', {
      name: 'Allotment',
      slug: 'allotment',
      isPersonal: false,
      inviteCode: 'def456',
    })
    await ctx.db.insert('memberships', {
      groupId,
      userId: alice,
      role: 'admin',
    })
    return groupId
  })
}

/** One row in as many corners of a Group as the cascade has to reach. */
async function fillGroup(
  t: Harness,
  groupId: Id<'groups'>,
  author: Id<'users'>,
) {
  return await t.run(async (ctx) => {
    const imageId = await ctx.storage.store(new Blob(['jpeg']))
    await ctx.db.insert('recipes', {
      groupId,
      sharedGroupIds: [],
      createdByUserId: author,
      title: 'Stamppot',
      imageId,
      ingredients: ['kale'],
      steps: ['mash'],
      tags: [],
    })
    const listId = await ctx.db.insert('taskLists', {
      groupId,
      name: 'Chores',
      provider: 'local',
      order: 0,
    })
    await ctx.db.insert('tasks', {
      listId,
      title: 'Bins',
      done: false,
      createdBy: author,
      order: 0,
    })
    const calendarId = await ctx.db.insert('calendars', {
      groupId,
      name: 'Family',
      source: 'local',
      createdBy: author,
    })
    await ctx.db.insert('calendarEvents', {
      calendarId,
      title: 'Dentist',
      date: '2026-09-02',
      createdBy: author,
    })
    await ctx.db.insert('notes', {
      groupId,
      title: 'Wifi',
      body: 'hunter2',
      createdBy: author,
      updatedAt: 0,
    })
    await ctx.db.insert('holdings', {
      groupId,
      createdByUserId: author,
      kind: 'stock',
      symbol: 'ASML',
      name: 'ASML',
      currency: 'EUR',
      openingDate: '2026-01-01',
      openingUnits: 1,
      openingAverageCostCents: 100,
      order: 0,
    })
    await ctx.db.insert('integrationConnections', {
      groupId,
      provider: 'todoist',
      accessToken: 'secret',
      accountLabel: 'Todoist',
      connectedBy: author,
    })
    return imageId
  })
}

/** Everything still in a Group, across the tables `fillGroup` wrote to. */
async function contentOf(t: Harness, groupId: Id<'groups'>) {
  return await t.run(async (ctx) => {
    const byGroup = async (
      table:
        | 'recipes'
        | 'taskLists'
        | 'calendars'
        | 'notes'
        | 'holdings'
        | 'integrationConnections'
        | 'memberships',
    ) =>
      (await ctx.db.query(table).collect()).filter(
        (row) => row.groupId === groupId,
      ).length

    return {
      recipes: await byGroup('recipes'),
      taskLists: await byGroup('taskLists'),
      tasks: (await ctx.db.query('tasks').collect()).length,
      calendars: await byGroup('calendars'),
      calendarEvents: (await ctx.db.query('calendarEvents').collect()).length,
      notes: await byGroup('notes'),
      holdings: await byGroup('holdings'),
      connections: await byGroup('integrationConnections'),
      memberships: await byGroup('memberships'),
      group: (await ctx.db.get(groupId)) !== null,
    }
  })
}

const EMPTY = {
  recipes: 0,
  taskLists: 0,
  tasks: 0,
  calendars: 0,
  calendarEvents: 0,
  notes: 0,
  holdings: 0,
  connections: 0,
  memberships: 0,
  group: false,
}

describe('a Group nobody else is in', () => {
  test('goes, with everything in it', async () => {
    const t = testConvex()
    await signUp(t, asAlice)
    const alice = await userId(t, asAlice)
    const groupId = await soloGroup(t, alice)
    await fillGroup(t, groupId, alice)

    await deleteAccount(t, asAlice)

    expect(await contentOf(t, groupId)).toEqual(EMPTY)
  })

  test('takes its photos out of storage with it', async () => {
    const t = testConvex()
    await signUp(t, asAlice)
    const alice = await userId(t, asAlice)
    const groupId = await soloGroup(t, alice)
    const imageId = await fillGroup(t, groupId, alice)

    await deleteAccount(t, asAlice)

    const stillThere = await t.run(
      async (ctx) => (await ctx.storage.getUrl(imageId)) !== null,
    )
    expect(stillThere).toBe(false)
  })

  test('includes the Personal group', async () => {
    const t = testConvex()
    await signUp(t, asAlice)

    await deleteAccount(t, asAlice)

    const groups = await t.run(async (ctx) => ctx.db.query('groups').collect())
    expect(groups).toEqual([])
  })
})

describe('a Group somebody else is in', () => {
  test('survives, with everything in it', async () => {
    const t = testConvex()
    await signUp(t, asAlice)
    await signUp(t, asBob)
    const alice = await userId(t, asAlice)
    const bob = await userId(t, asBob)
    const groupId = await sharedGroup(t, alice, bob)
    await fillGroup(t, groupId, alice)

    await deleteAccount(t, asAlice)

    expect(await contentOf(t, groupId)).toEqual({
      ...EMPTY,
      recipes: 1,
      taskLists: 1,
      tasks: 1,
      calendars: 1,
      calendarEvents: 1,
      notes: 1,
      holdings: 1,
      connections: 1,
      // Bob's. Alice's is the only one that went.
      memberships: 1,
      group: true,
    })
  })

  test('keeps what they wrote, with the byline left dangling', async () => {
    const t = testConvex()
    await signUp(t, asAlice)
    await signUp(t, asBob)
    const alice = await userId(t, asAlice)
    const bob = await userId(t, asBob)
    const groupId = await sharedGroup(t, alice, bob)
    await fillGroup(t, groupId, alice)

    await deleteAccount(t, asAlice)

    const note = await t.run(
      async (ctx) => (await ctx.db.query('notes').collect())[0],
    )
    expect(note?.body).toBe('hunter2')
    expect(await t.run(async (ctx) => ctx.db.get(note!.createdBy))).toBeNull()
  })

  test('clears a standing cost split that named them', async () => {
    const t = testConvex()
    await signUp(t, asAlice)
    await signUp(t, asBob)
    const alice = await userId(t, asAlice)
    const bob = await userId(t, asBob)
    const groupId = await sharedGroup(t, alice, bob)
    await t.run(async (ctx) => {
      await ctx.db.insert('recurringCosts', {
        groupId,
        createdByUserId: bob,
        name: 'Internet',
        amountCents: 4500,
        frequency: 'monthly',
        category: 'utilities',
        split: [
          { userId: alice, percent: 50 },
          { userId: bob, percent: 50 },
        ],
        order: 0,
      })
    })

    await deleteAccount(t, asAlice)

    const cost = await t.run(
      async (ctx) => (await ctx.db.query('recurringCosts').collect())[0],
    )
    // Not "drop Alice's half" — a ratio that no longer adds to a hundred is
    // one the household could never save again.
    expect(cost?.split).toBeUndefined()
    expect(cost?.name).toBe('Internet')
  })

  test('keeps a saved split scenario, by name, without their id', async () => {
    const t = testConvex()
    await signUp(t, asAlice)
    await signUp(t, asBob)
    const alice = await userId(t, asAlice)
    const bob = await userId(t, asBob)
    const groupId = await sharedGroup(t, alice, bob)
    await t.run(async (ctx) => {
      await ctx.db.insert('splitScenarios', {
        groupId,
        createdByUserId: bob,
        createdAt: 0,
        name: 'Holiday',
        payments: [
          {
            party: { userId: alice, name: 'Alice' },
            amountCents: 10_000,
          },
        ],
        participants: [
          { userId: alice, name: 'Alice' },
          { userId: bob, name: 'Bob' },
        ],
        mode: 'equal',
        owed: [{ party: { userId: bob, name: 'Bob' }, amountCents: 5_000 }],
        transfers: [
          {
            from: { userId: bob, name: 'Bob' },
            to: { userId: alice, name: 'Alice' },
            amountCents: 5_000,
          },
        ],
        totalCents: 10_000,
      })
    })

    await deleteAccount(t, asAlice)

    const saved = await t.run(
      async (ctx) => (await ctx.db.query('splitScenarios').collect())[0],
    )
    expect(saved?.participants).toEqual([
      { name: 'Alice' },
      { userId: bob, name: 'Bob' },
    ])
    expect(saved?.payments[0]?.party).toEqual({ name: 'Alice' })
    expect(saved?.transfers[0]?.to).toEqual({ name: 'Alice' })
  })
})

describe('what belongs to the person rather than a Group', () => {
  test('the diary and its combos go', async () => {
    const t = testConvex()
    await signUp(t, asAlice)
    await signUp(t, asBob)
    const alice = await userId(t, asAlice)
    const bob = await userId(t, asBob)
    await t.run(async (ctx) => {
      const comboId = await ctx.db.insert('combos', {
        userId: alice,
        name: 'Breakfast',
        order: 0,
      })
      await ctx.db.insert('comboItems', {
        comboId,
        label: 'Oats',
        quantity: 50,
        quantityUnit: 'g',
      })
      await ctx.db.insert('consumptionEntries', {
        userId: alice,
        date: '2026-09-01',
        meal: 'breakfast',
        label: 'Oats',
        quantity: 50,
        quantityUnit: 'g',
        nutrition: { calories: 180 },
      })
      // Bob's, and none of Alice's business.
      await ctx.db.insert('consumptionEntries', {
        userId: bob,
        date: '2026-09-01',
        meal: 'lunch',
        label: 'Soup',
        quantity: 1,
        quantityUnit: 'piece',
        nutrition: { calories: 200 },
      })
    })

    await deleteAccount(t, asAlice)

    const left = await t.run(async (ctx) => ({
      combos: (await ctx.db.query('combos').collect()).length,
      comboItems: (await ctx.db.query('comboItems').collect()).length,
      entries: (await ctx.db.query('consumptionEntries').collect()).length,
    }))
    expect(left).toEqual({ combos: 0, comboItems: 0, entries: 1 })
  })

  test('the user row goes last, and it does go', async () => {
    const t = testConvex()
    await signUp(t, asAlice)

    await deleteAccount(t, asAlice)

    expect(await t.withIdentity(asAlice).query(api.users.me, {})).toBeNull()
  })
})

describe('while the purge is running', () => {
  test('signing in again does not hand the account back', async () => {
    const t = testConvex()
    await signUp(t, asAlice)

    // The mutation only marks and schedules; this is the window a remount
    // would land in.
    await t.withIdentity(asAlice).mutation(api.accounts.deleteAccount, {})

    await expect(
      t.withIdentity(asAlice).mutation(api.users.ensureUser, {}),
    ).rejects.toThrow('Account deleted')
  })

  test('asking twice does not start it twice', async () => {
    const t = testConvex()
    await signUp(t, asAlice)
    await t.withIdentity(asAlice).mutation(api.accounts.deleteAccount, {})
    await t.withIdentity(asAlice).mutation(api.accounts.deleteAccount, {})
    await settle(t)

    expect(await t.run(async (ctx) => ctx.db.query('users').collect())).toEqual(
      [],
    )
  })
})

describe('the preview shown before the confirmation', () => {
  test('names what goes and what stays', async () => {
    const t = testConvex()
    await signUp(t, asAlice)
    await signUp(t, asBob)
    const alice = await userId(t, asAlice)
    const bob = await userId(t, asBob)
    await soloGroup(t, alice)
    await sharedGroup(t, alice, bob)

    const preview = await t
      .withIdentity(asAlice)
      .query(api.accounts.deletionPreview, {})

    expect(preview?.email).toBe('alice@example.com')
    expect(preview?.deleted.sort()).toEqual(["Alice's things", 'Allotment'])
    expect(preview?.kept).toEqual(['Household'])
  })
})

describe('deleting a Group from the app', () => {
  test('now takes its content with it', async () => {
    const t = testConvex()
    await signUp(t, asAlice)
    const alice = await userId(t, asAlice)
    const groupId = await soloGroup(t, alice)
    const imageId = await fillGroup(t, groupId, alice)

    await t.withIdentity(asAlice).mutation(api.groups.deleteGroup, { groupId })
    await settle(t)

    expect(await contentOf(t, groupId)).toEqual(EMPTY)
    expect(
      await t.run(async (ctx) => (await ctx.storage.getUrl(imageId)) !== null),
    ).toBe(false)
  })

  test('un-shares a recipe that lives somewhere else', async () => {
    const t = testConvex()
    await signUp(t, asAlice)
    const alice = await userId(t, asAlice)
    const home = await soloGroup(t, alice)
    const other = await t.run(async (ctx) => {
      const groupId = await ctx.db.insert('groups', {
        name: 'Book club',
        slug: 'book-club',
        isPersonal: false,
        inviteCode: 'ghi789',
      })
      await ctx.db.insert('memberships', {
        groupId,
        userId: alice,
        role: 'admin',
      })
      await ctx.db.insert('recipes', {
        groupId,
        sharedGroupIds: [home],
        createdByUserId: alice,
        title: 'Borrowed',
        ingredients: [],
        steps: [],
        tags: [],
      })
      return groupId
    })

    await t
      .withIdentity(asAlice)
      .mutation(api.groups.deleteGroup, { groupId: home })
    await settle(t)

    const recipe = await t.run(
      async (ctx) => (await ctx.db.query('recipes').collect())[0],
    )
    expect(recipe?.groupId).toBe(other)
    expect(recipe?.sharedGroupIds).toEqual([])
  })
})
