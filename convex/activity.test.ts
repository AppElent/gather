import { describe, expect, test } from 'vitest'
import { testConvex } from '../test/convexHarness'
import { api } from './_generated/api'
import { type GroupActivityEntry, mergeActivity } from './activity'
import { GROUP_REFUSAL_MESSAGES } from './lib/groupAccess'

/**
 * What a Group's Home says has been happening in it.
 *
 * The criterion is not "the row belongs to this Group" but "which Group's page
 * shows it", so everything below is asserted through the real query, at a
 * Group's own address, as a Member of that Group.
 *
 * Alice is the case that matters throughout: she is in both households, so a
 * stream derived from the *caller's* memberships rather than from the Group in
 * the URL would pass every other test here and fail hers.
 */

const alice = { subject: 'clerk_alice', name: 'Alice', email: 'a@example.com' }
const bob = { subject: 'clerk_bob', name: 'Bob', email: 'b@example.com' }
const carla = { subject: 'clerk_carla', name: 'Carla', email: 'c@example.com' }

const JANSEN = 'jansen-household'
const DE_VRIES = 'de-vries-household'
const ME_ALICE = 'me-alice'

type Harness = ReturnType<typeof testConvex>

/**
 * Two households and a Personal group. Alice is in both households and has her
 * own Personal group; Bob is only in the Jansens'; Carla is only in the
 * De Vrieses'.
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
    const aliceAlone = await ctx.db.insert('groups', {
      name: "Alice's things",
      slug: ME_ALICE,
      isPersonal: true,
      inviteCode: 'me-alice-code',
    })

    for (const [groupId, userId, role] of [
      [jansen, aliceId, 'admin'],
      [jansen, bobId, 'member'],
      [devries, aliceId, 'member'],
      [devries, carlaId, 'admin'],
      [aliceAlone, aliceId, 'admin'],
    ] as const) {
      await ctx.db.insert('memberships', { groupId, userId, role })
    }

    return { aliceId, bobId, carlaId, jansen, devries, aliceAlone }
  })

  return { t, ...ids }
}

const recipeArgs = (title: string) => ({
  title,
  ingredients: ['flour'],
  steps: ['bake'],
  tags: [],
})

async function addRecipe(
  t: Harness,
  identity: typeof alice,
  groupSlug: string,
  title: string,
) {
  return await t
    .withIdentity(identity)
    .mutation(api.recipes.create, { groupSlug, ...recipeArgs(title) })
}

async function addList(t: Harness, identity: typeof alice, groupSlug: string) {
  return await t.withIdentity(identity).mutation(api.taskLists.create, {
    groupSlug,
    name: 'Shopping',
    provider: 'local',
  })
}

async function addChild(t: Harness, groupId: string, name: string) {
  return await t.run(
    async (ctx) =>
      // `babies` carries no attribution field, so a child is seeded directly
      // rather than through the mutation — nothing under test depends on who
      // added the child, only on who logged each entry.
      await ctx.db.insert('babies', {
        groupId: groupId as never,
        name,
        birthDate: '2026-01-05',
        order: 0,
      }),
  )
}

async function activityIn(t: Harness, identity: typeof alice, slug: string) {
  return await t
    .withIdentity(identity)
    .query(api.activity.forGroup, { groupSlug: slug })
}

const titles = (entries: GroupActivityEntry[]) => entries.map((e) => e.title)

describe('the stream belongs to the Group in the address', () => {
  test("a Group's activity holds its own records and none of the other Group's", async () => {
    const { t } = await seed()

    await addRecipe(t, alice, JANSEN, 'Jansen roast')
    await addRecipe(t, carla, DE_VRIES, 'De Vries stew')

    // Asserted as Alice, who is in both. A stream answered from her
    // memberships would union the two here and look right at either address.
    expect(titles(await activityIn(t, alice, JANSEN))).toEqual(['Jansen roast'])
    expect(titles(await activityIn(t, alice, DE_VRIES))).toEqual([
      'De Vries stew',
    ])
  })

  test('a Member of one Group sees the same stream as a Member of both', async () => {
    const { t } = await seed()

    await addRecipe(t, alice, JANSEN, 'Jansen roast')
    await addRecipe(t, carla, DE_VRIES, 'De Vries stew')

    expect(titles(await activityIn(t, bob, JANSEN))).toEqual(['Jansen roast'])
  })

  test('tasks and log entries stop at their own Group too', async () => {
    const { t, jansen, devries } = await seed()

    const jansenList = await addList(t, alice, JANSEN)
    const devriesList = await addList(t, carla, DE_VRIES)
    await t.withIdentity(alice).mutation(api.tasks.add, {
      listId: jansenList,
      groupSlug: JANSEN,
      title: 'Buy nappies',
    })
    await t.withIdentity(carla).mutation(api.tasks.add, {
      listId: devriesList,
      groupSlug: DE_VRIES,
      title: 'Book the vet',
    })

    const noor = await addChild(t, jansen, 'Noor')
    const sem = await addChild(t, devries, 'Sem')
    await t.withIdentity(alice).mutation(api.babyEvents.add, {
      babyId: noor,
      groupSlug: JANSEN,
      type: 'feeding',
      timestamp: 1_760_000_000_000,
      data: { method: 'bottle', amountMl: 90 },
    })
    await t.withIdentity(carla).mutation(api.babyEvents.add, {
      babyId: sem,
      groupSlug: DE_VRIES,
      type: 'diaper',
      timestamp: 1_760_000_000_000,
      data: { kind: 'wet' },
    })

    // A task's title is what somebody typed; a baby entry's is a category, and
    // this returns its `BabyEventType` key rather than an English word so the
    // client can name it in the reader's language (ADR-0011).
    const jansenStream = await activityIn(t, alice, JANSEN)
    expect(titles(jansenStream).sort()).toEqual(['Buy nappies', 'feeding'])
    expect(jansenStream.map((e) => e.context).sort()).toEqual([
      'Noor',
      'Shopping',
    ])

    const devriesStream = await activityIn(t, alice, DE_VRIES)
    expect(titles(devriesStream).sort()).toEqual(['Book the vet', 'diaper'])
  })

  test('a recipe shared into a Group is not something that happened there', async () => {
    const { t } = await seed()

    const roast = await addRecipe(t, alice, JANSEN, 'Jansen roast')
    await t
      .withIdentity(alice)
      .mutation(api.recipes.share, { id: roast, withGroupSlug: DE_VRIES })

    // The De Vrieses can read it — that is what a Share is — but nobody there
    // added it, and the moment it records happened in another household.
    const readable = await t
      .withIdentity(carla)
      .query(api.recipes.list, { groupSlug: DE_VRIES })
    expect(readable.map((r) => r.title)).toEqual(['Jansen roast'])
    expect(titles(await activityIn(t, carla, DE_VRIES))).toEqual([])
  })
})

describe('a Personal record is in no Group', () => {
  test('a food diary entry appears in no Group the person is in', async () => {
    const { t } = await seed()

    await t.withIdentity(alice).mutation(api.consumption.create, {
      date: '2026-07-30',
      meal: 'lunch',
      label: 'Cheese sandwich',
      quantity: 1,
      quantityUnit: 'serving',
      nutrition: { calories: 300 },
    })

    // It is really there to be found.
    const diary = await t
      .withIdentity(alice)
      .query(api.consumption.listForDay, { date: '2026-07-30' })
    expect(diary.map((e) => e.label)).toEqual(['Cheese sandwich'])

    expect(await activityIn(t, alice, JANSEN)).toEqual([])
    expect(await activityIn(t, alice, DE_VRIES)).toEqual([])
  })

  test('not even in the diarist’s own Personal group', async () => {
    const { t } = await seed()

    await t.withIdentity(alice).mutation(api.consumption.create, {
      date: '2026-07-30',
      meal: 'lunch',
      label: 'Cheese sandwich',
      quantity: 1,
      quantityUnit: 'serving',
      nutrition: { calories: 300 },
    })

    // The case someone will later read as an exception. A Personal group is an
    // ordinary Group with one Member (CONTEXT.md), and a Personal record
    // belongs to no Group at all — so the rule is uniform and this is not a
    // special case that got missed.
    expect(await activityIn(t, alice, ME_ALICE)).toEqual([])
  })

  test('a Personal group still carries its own Group-scoped content', async () => {
    const { t } = await seed()

    await addRecipe(t, alice, ME_ALICE, 'Just for me')

    expect(titles(await activityIn(t, alice, ME_ALICE))).toEqual([
      'Just for me',
    ])
  })
})

describe('the stream says who did it', () => {
  test('attribution is the person who did it, not the person reading', async () => {
    const { t } = await seed()

    await addRecipe(t, bob, JANSEN, 'Bob’s roast')
    const list = await addList(t, alice, JANSEN)
    await t.withIdentity(bob).mutation(api.tasks.add, {
      listId: list,
      groupSlug: JANSEN,
      title: 'Buy nappies',
    })

    // Alice is reading; Bob did both.
    const stream = await activityIn(t, alice, JANSEN)
    expect(stream.map((e) => e.byName)).toEqual(['Bob', 'Bob'])
    // And it reads the same for Bob, who is reading his own work.
    expect((await activityIn(t, bob, JANSEN)).map((e) => e.byName)).toEqual([
      'Bob',
      'Bob',
    ])
  })

  test('attribution is a name, so the client never looks a person up', async () => {
    const { t, jansen } = await seed()

    const noor = await addChild(t, jansen, 'Noor')
    await t.withIdentity(alice).mutation(api.babyEvents.add, {
      babyId: noor,
      groupSlug: JANSEN,
      type: 'feeding',
      timestamp: 1_760_000_000_000,
      data: { method: 'bottle', amountMl: 90 },
    })

    const [entry] = await activityIn(t, alice, JANSEN)
    expect(entry.byName).toBe('Alice')
    expect(entry).not.toHaveProperty('byUserId')
    // The link the Module does have a page for comes back as a row id for the
    // client to build a URL from, never as an assembled path.
    expect(entry.targetId).toBe(noor)
    expect(JSON.stringify(entry)).not.toContain('/g/')
  })
})

describe('who may read it', () => {
  test('someone who is not a Member is refused', async () => {
    const { t } = await seed()
    await addRecipe(t, alice, JANSEN, 'Jansen roast')

    await expect(activityIn(t, carla, JANSEN)).rejects.toThrow(
      GROUP_REFUSAL_MESSAGES['not-a-member'],
    )
  })

  test('a signed-out caller is refused', async () => {
    const { t } = await seed()

    await expect(
      t.query(api.activity.forGroup, { groupSlug: JANSEN }),
    ).rejects.toThrow(GROUP_REFUSAL_MESSAGES['not-signed-in'])
  })

  test('a slug no Group holds is refused as unknown', async () => {
    const { t } = await seed()

    await expect(activityIn(t, alice, 'no-such-group')).rejects.toThrow(
      GROUP_REFUSAL_MESSAGES['unknown-slug'],
    )
  })
})

describe('order and volume', () => {
  test('newest first', async () => {
    const { t } = await seed()

    await addRecipe(t, alice, JANSEN, 'First')
    await addRecipe(t, alice, JANSEN, 'Second')
    await addRecipe(t, alice, JANSEN, 'Third')

    expect(titles(await activityIn(t, alice, JANSEN))).toEqual([
      'Third',
      'Second',
      'First',
    ])
  })

  test('the cap holds, and holds at the newest end', async () => {
    const { t } = await seed()

    for (let i = 0; i < 35; i++) {
      await addRecipe(t, alice, JANSEN, `Recipe ${String(i).padStart(2, '0')}`)
    }

    const stream = await activityIn(t, alice, JANSEN)
    expect(stream).toHaveLength(30)
    expect(stream[0].title).toBe('Recipe 34')
    expect(stream.at(-1)?.title).toBe('Recipe 05')
  })
})

/**
 * The merge is exercised as a rule as well as through the query: building
 * hundreds of baby events through the real mutation to prove one recipe
 * survives would be a slow test of a pure function.
 */
describe('one busy Module does not empty the stream of the rest', () => {
  const entry = (
    kind: GroupActivityEntry['kind'],
    at: number,
  ): GroupActivityEntry => ({
    id: `${kind}-${at}`,
    kind,
    at,
    byName: 'Alice',
    title: `${kind} ${at}`,
    context: null,
    targetId: null,
  })

  test('a recipe from last week survives a hundred nappies from today', () => {
    const babyEvents = Array.from({ length: 100 }, (_, i) =>
      entry('babyEvent', 2_000 + i),
    )
    const merged = mergeActivity([entry('recipe', 1), ...babyEvents])

    expect(merged).toHaveLength(30)
    expect(merged.map((e) => e.id)).toContain('recipe-1')
    // Present, not promoted: it is the oldest thing in the stream and it sits
    // at the bottom, where its time puts it.
    expect(merged.at(-1)?.id).toBe('recipe-1')
    expect(merged[0].id).toBe('babyEvent-2099')
  })

  test('a Group with only a baby log still gets a full page of it', () => {
    const merged = mergeActivity(
      Array.from({ length: 100 }, (_, i) => entry('babyEvent', 2_000 + i)),
    )

    expect(merged).toHaveLength(30)
    expect(merged.every((e) => e.kind === 'babyEvent')).toBe(true)
  })

  test('the order is time and nothing else', () => {
    const merged = mergeActivity([
      entry('recipe', 3),
      entry('babyEvent', 1),
      entry('task', 2),
    ])

    expect(merged.map((e) => e.at)).toEqual([3, 2, 1])
  })
})

describe('who is in the Group', () => {
  test('every Member, by name and standing', async () => {
    const { t } = await seed()

    const members = await t
      .withIdentity(alice)
      .query(api.groups.members, { slug: JANSEN })

    expect(members).toEqual([
      { userId: expect.anything(), name: 'Alice', role: 'admin' },
      { userId: expect.anything(), name: 'Bob', role: 'member' },
    ])
  })

  test('a Personal group has exactly its one Member', async () => {
    const { t } = await seed()

    const members = await t
      .withIdentity(alice)
      .query(api.groups.members, { slug: ME_ALICE })

    expect(members.map((m) => m.name)).toEqual(['Alice'])
  })

  test('the invite code is not part of knowing who is here', async () => {
    const { t } = await seed()

    const members = await t
      .withIdentity(alice)
      .query(api.groups.members, { slug: JANSEN })

    expect(JSON.stringify(members)).not.toContain('jansen')
  })

  test('a Group you are not in does not list its Members to you', async () => {
    const { t } = await seed()

    await expect(
      t.withIdentity(carla).query(api.groups.members, { slug: JANSEN }),
    ).rejects.toThrow(GROUP_REFUSAL_MESSAGES['not-a-member'])
  })
})
