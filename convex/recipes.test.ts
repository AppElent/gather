import { describe, expect, test } from 'vitest'
import { testConvex } from '../test/convexHarness'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'

/**
 * Who can see and change a household's recipes, asserted through the real
 * queries and mutations.
 *
 * A recipe belongs to a Group. Every Member of that Group sees the same
 * collection, someone outside it sees none of it, and the person who added a
 * recipe is recorded as attribution — displayed, granting nothing. The tests
 * that matter most here are the ones that prove the *absence* of per-person
 * ownership: a fellow Member can edit what someone else added, and the person
 * who added it loses it along with their membership.
 */

const asAlice = { subject: 'clerk_alice' }
const asBob = { subject: 'clerk_bob' }
const asCarol = { subject: 'clerk_carol' }

/**
 * Alice and Bob share a household; Carol is only in the cooking club. The
 * household's two recipes were both added by Alice, and one of them is also
 * shared into the club.
 */
async function seed() {
  const t = testConvex()

  const ids = await t.run(async (ctx) => {
    const alice = await ctx.db.insert('users', {
      clerkId: asAlice.subject,
      name: 'Alice',
      email: 'alice@example.com',
    })
    const bob = await ctx.db.insert('users', {
      clerkId: asBob.subject,
      name: 'Bob',
      email: 'bob@example.com',
    })
    const carol = await ctx.db.insert('users', {
      clerkId: asCarol.subject,
      name: 'Carol',
      email: 'carol@example.com',
    })

    const household = await ctx.db.insert('groups', {
      name: 'Household',
      inviteCode: 'household-code',
      slug: 'household',
      isPersonal: false,
    })
    const cookingClub = await ctx.db.insert('groups', {
      name: 'Cooking club',
      inviteCode: 'club-code',
      slug: 'cooking-club',
      isPersonal: false,
    })

    const aliceInHousehold = await ctx.db.insert('memberships', {
      groupId: household,
      userId: alice,
      role: 'admin',
    })
    await ctx.db.insert('memberships', {
      groupId: household,
      userId: bob,
      role: 'member',
    })
    await ctx.db.insert('memberships', {
      groupId: cookingClub,
      userId: carol,
      role: 'admin',
    })

    const roast = await ctx.db.insert('recipes', {
      groupId: household,
      sharedGroupIds: [],
      createdByUserId: alice,
      title: 'Sunday roast',
      ingredients: [],
      steps: [],
      tags: [],
    })
    const sharedWithClub = await ctx.db.insert('recipes', {
      groupId: household,
      sharedGroupIds: [cookingClub],
      createdByUserId: alice,
      title: 'Pasta for a crowd',
      ingredients: [],
      steps: [],
      tags: [],
    })
    const clubOnly = await ctx.db.insert('recipes', {
      groupId: cookingClub,
      sharedGroupIds: [],
      createdByUserId: carol,
      title: 'Club sourdough',
      ingredients: [],
      steps: [],
      tags: [],
    })

    return {
      alice,
      bob,
      carol,
      household,
      cookingClub,
      aliceInHousehold,
      roast,
      sharedWithClub,
      clubOnly,
    }
  })

  return { t, ids }
}

type Harness = Awaited<ReturnType<typeof seed>>['t']

function titles(rows: Array<{ title: string }>) {
  return rows.map((r) => r.title).sort()
}

/** Take a person out of a Group, as `groups.leaveGroup` would. */
async function endMembership(t: Harness, membershipId: Id<'memberships'>) {
  await t.run(async (ctx) => {
    await ctx.db.delete(membershipId)
  })
}

/**
 * Alice is in the household *and* the cooking club; Bob is only in the
 * household and Carol only in the club. Two uses: asking for the household by
 * slug must give Alice and Bob the same answer, and moving or sharing between
 * the two Groups needs somebody who is a Member of both.
 */
async function seedWithAliceInBothGroups() {
  const { t, ids } = await seed()
  await t.run(async (ctx) => {
    await ctx.db.insert('memberships', {
      groupId: ids.cookingClub,
      userId: ids.alice,
      role: 'member',
    })
  })
  return { t, ids }
}

describe("a Group's collection is the Group's, not the caller's", () => {
  test('two Members of one Group see the identical list', async () => {
    const { t } = await seedWithAliceInBothGroups()

    const alices = await t
      .withIdentity(asAlice)
      .query(api.recipes.list, { groupSlug: 'household' })
    const bobs = await t
      .withIdentity(asBob)
      .query(api.recipes.list, { groupSlug: 'household' })

    expect(titles(alices)).toEqual(titles(bobs))
  })

  test("another Group's recipes stay out of it", async () => {
    const { t } = await seedWithAliceInBothGroups()

    const rows = await t
      .withIdentity(asAlice)
      .query(api.recipes.list, { groupSlug: 'household' })

    // Alice can see the sourdough — just not from in here.
    expect(titles(rows)).toEqual(['Pasta for a crowd', 'Sunday roast'])
    expect(titles(rows)).not.toContain('Club sourdough')
  })

  test('a recipe shared into a Group appears in that Group', async () => {
    const { t } = await seed()

    const rows = await t
      .withIdentity(asCarol)
      .query(api.recipes.list, { groupSlug: 'cooking-club' })

    expect(titles(rows)).toEqual(['Club sourdough', 'Pasta for a crowd'])
  })

  test('a Group the caller is not a Member of is refused', async () => {
    const { t } = await seed()

    await expect(
      t.withIdentity(asCarol).query(api.recipes.list, { groupSlug: 'household' }),
    ).rejects.toThrow()
  })
})

describe('recipes.list', () => {
  test('every Member of a Group sees the same recipes', async () => {
    const { t } = await seed()

    const alices = await t
      .withIdentity(asAlice)
      .query(api.recipes.list, { groupSlug: 'household' })
    const bobs = await t
      .withIdentity(asBob)
      .query(api.recipes.list, { groupSlug: 'household' })

    expect(titles(alices)).toEqual(['Pasta for a crowd', 'Sunday roast'])
    expect(titles(bobs)).toEqual(titles(alices))
  })

  test('shows a signed-out caller nothing', async () => {
    const { t } = await seed()
    await expect(
      t.query(api.recipes.list, { groupSlug: 'household' }),
    ).rejects.toThrow()
  })
})

/**
 * The diary's recipe picker, which is Personal and so reads across every Group
 * (ADR-0003). This is the one caller-wide list left, and it is not a Group's.
 */
describe('recipes.listAcrossMyGroups', () => {
  test('someone outside a Group sees none of its recipes', async () => {
    const { t } = await seed()

    const carols = await t
      .withIdentity(asCarol)
      .query(api.recipes.listAcrossMyGroups, {})
    const bobs = await t
      .withIdentity(asBob)
      .query(api.recipes.listAcrossMyGroups, {})

    // Carol is not in the household, so its collection is not hers to see —
    // except the one recipe that was shared into her club.
    expect(titles(carols)).toEqual(['Club sourdough', 'Pasta for a crowd'])
    // And Bob is not in the club, so its recipe is not his.
    expect(titles(bobs)).not.toContain('Club sourdough')
  })

  test('shows a signed-out caller nothing', async () => {
    const { t } = await seed()
    const rows = await t.query(api.recipes.listAcrossMyGroups, {})
    expect(rows).toEqual([])
  })
})

describe('recipes.get', () => {
  test('any Member of the home Group can read it', async () => {
    const { t, ids } = await seed()
    const recipe = await t
      .withIdentity(asBob)
      .query(api.recipes.get, { id: ids.roast, groupSlug: 'household' })
    expect(recipe?.title).toBe('Sunday roast')
  })

  test('a Member of a Group it is shared into can read it', async () => {
    const { t, ids } = await seed()
    const recipe = await t
      .withIdentity(asCarol)
      .query(api.recipes.get, {
        id: ids.sharedWithClub,
        groupSlug: 'cooking-club',
      })
    expect(recipe?.title).toBe('Pasta for a crowd')
  })

  test('someone in none of its Groups cannot', async () => {
    const { t, ids } = await seed()
    const recipe = await t
      .withIdentity(asCarol)
      .query(api.recipes.get, { id: ids.roast, groupSlug: 'cooking-club' })
    expect(recipe).toBeNull()
  })

  /**
   * Alice is in both Groups, and the roast lives in the household and was never
   * shared. Reading it at the club's address must fail even for her: the URL is
   * claiming the club can see this recipe, and the club cannot.
   */
  test('a recipe you can see, read from the wrong Group, is not found', async () => {
    const { t, ids } = await seed()
    await t.run(async (ctx) => {
      await ctx.db.insert('memberships', {
        groupId: ids.cookingClub,
        userId: ids.alice,
        role: 'member',
      })
    })

    const fromClub = await t
      .withIdentity(asAlice)
      .query(api.recipes.get, { id: ids.roast, groupSlug: 'cooking-club' })
    expect(fromClub).toBeNull()

    const fromHome = await t
      .withIdentity(asAlice)
      .query(api.recipes.get, { id: ids.roast, groupSlug: 'household' })
    expect(fromHome?.title).toBe('Sunday roast')
  })

  test('shows who added it', async () => {
    const { t, ids } = await seed()
    const recipe = await t
      .withIdentity(asBob)
      .query(api.recipes.get, { id: ids.roast, groupSlug: 'household' })
    expect(recipe?.addedByName).toBe('Alice')
  })

  test('a Group it was shared into reads it and cannot change it', async () => {
    const { t, ids } = await seed()
    const recipe = await t
      .withIdentity(asCarol)
      .query(api.recipes.get, {
        id: ids.sharedWithClub,
        groupSlug: 'cooking-club',
      })
    expect(recipe?.canEdit).toBe(false)
  })

  test('says which Group it lives in', async () => {
    const { t, ids } = await seed()
    const recipe = await t
      .withIdentity(asCarol)
      .query(api.recipes.get, {
        id: ids.sharedWithClub,
        groupSlug: 'cooking-club',
      })
    expect(recipe?.homeGroupName).toBe('Household')
    expect(recipe?.homeGroupSlug).toBe('household')
  })

  test('tells the home Group which Groups it is shared with, and tells a guest Group nothing', async () => {
    const { t, ids } = await seed()

    const atHome = await t
      .withIdentity(asBob)
      .query(api.recipes.get, {
        id: ids.sharedWithClub,
        groupSlug: 'household',
      })
    expect(atHome?.sharedGroups.map((g) => g.slug)).toEqual(['cooking-club'])

    const asGuest = await t
      .withIdentity(asCarol)
      .query(api.recipes.get, {
        id: ids.sharedWithClub,
        groupSlug: 'cooking-club',
      })
    expect(asGuest?.sharedGroups).toEqual([])
  })
})

describe('attribution grants nothing', () => {
  test('the person who added a recipe loses it with their membership', async () => {
    const { t, ids } = await seed()

    await endMembership(t, ids.aliceInHousehold)

    // She is still recorded as the person who added it — Bob can see that.
    const asSeenByBob = await t
      .withIdentity(asBob)
      .query(api.recipes.get, { id: ids.roast, groupSlug: 'household' })
    expect(asSeenByBob?.addedByName).toBe('Alice')

    // And it buys her nothing at all: she is refused the Group outright, and
    // the diary's cross-Group list no longer holds anything of theirs.
    await expect(
      t
        .withIdentity(asAlice)
        .query(api.recipes.get, { id: ids.roast, groupSlug: 'household' }),
    ).rejects.toThrow(/not a member/i)
    const alicesList = await t
      .withIdentity(asAlice)
      .query(api.recipes.listAcrossMyGroups, {})
    expect(alicesList).toEqual([])
  })

  test('a fellow Member can change what someone else added', async () => {
    const { t, ids } = await seed()

    await t.withIdentity(asBob).mutation(api.recipes.update, {
      id: ids.roast,
      title: 'Sunday roast, improved',
      ingredients: [],
      steps: [],
      tags: [],
    })

    const recipe = await t
      .withIdentity(asAlice)
      .query(api.recipes.get, { id: ids.roast, groupSlug: 'household' })
    expect(recipe?.title).toBe('Sunday roast, improved')
    // Attribution does not move to whoever touched it last.
    expect(recipe?.addedByName).toBe('Alice')
  })

  /**
   * Carol gets exactly what she would get for an id that was never a recipe:
   * `remove` is idempotent, so a recipe that is not there is not an error, and
   * a recipe she may not touch has to take the same branch — otherwise the
   * difference between "gone" and "refused" tells her the id was real.
   */
  test('a recipe outside your Groups cannot be deleted', async () => {
    const { t, ids } = await seed()

    await t.withIdentity(asCarol).mutation(api.recipes.remove, { id: ids.roast })

    const survives = await t
      .withIdentity(asBob)
      .query(api.recipes.get, { id: ids.roast, groupSlug: 'household' })
    expect(survives?.title).toBe('Sunday roast')
  })

  test('a recipe outside your Groups cannot be edited, and says only "not found"', async () => {
    const { t, ids } = await seed()

    await expect(
      t.withIdentity(asCarol).mutation(api.recipes.update, {
        id: ids.roast,
        title: 'Not yours',
        ingredients: [],
        steps: [],
        tags: [],
      }),
    ).rejects.toThrow(/recipe not found/i)
  })
})

describe('recipes.create', () => {
  test('puts the recipe in the Group that was asked for', async () => {
    const { t, ids } = await seed()

    const id: Id<'recipes'> = await t
      .withIdentity(asBob)
      .mutation(api.recipes.create, {
        groupSlug: 'household',
        title: 'Bob loaf',
        ingredients: ['flour'],
        steps: ['bake'],
        tags: [],
      })

    const seenByAlice = await t
      .withIdentity(asAlice)
      .query(api.recipes.get, { id, groupSlug: 'household' })
    expect(seenByAlice?.title).toBe('Bob loaf')
    expect(seenByAlice?.groupId).toBe(ids.household)
    expect(seenByAlice?.addedByName).toBe('Bob')

    const seenByCarol = await t
      .withIdentity(asCarol)
      .query(api.recipes.get, { id, groupSlug: 'cooking-club' })
    expect(seenByCarol).toBeNull()
  })

  test('refuses a Group the caller is not a Member of', async () => {
    const { t } = await seed()

    await expect(
      t.withIdentity(asBob).mutation(api.recipes.create, {
        groupSlug: 'cooking-club',
        title: 'Uninvited',
        ingredients: [],
        steps: [],
        tags: [],
      }),
    ).rejects.toThrow(/not a member/i)
  })

  test('refuses a Group that does not exist', async () => {
    const { t } = await seed()

    await expect(
      t.withIdentity(asBob).mutation(api.recipes.create, {
        groupSlug: 'no-such-group',
        title: 'Nowhere',
        ingredients: [],
        steps: [],
        tags: [],
      }),
    ).rejects.toThrow()
  })

  test('refuses an unauthenticated caller', async () => {
    const { t } = await seed()

    await expect(
      t.mutation(api.recipes.create, {
        groupSlug: 'household',
        title: 'Anonymous',
        ingredients: [],
        steps: [],
        tags: [],
      }),
    ).rejects.toThrow()
  })
})

/**
 * Move and Share, the two verbs that decide which Groups a recipe is visible in
 * (CONTEXT.md), asserted through both Groups' real lists rather than the row.
 *
 * A move puts a recipe imported into the wrong Group right; a Share lets a
 * cooking club see a recipe that still belongs to the household. The difference
 * between them is the whole point, so each test checks both halves: what the
 * destination gained, and whether the home Group changed.
 */
describe('moving a recipe between Groups', () => {
  test("changes which Group's list it appears in, for the Members of both", async () => {
    const { t, ids } = await seedWithAliceInBothGroups()

    await t.withIdentity(asAlice).mutation(api.recipes.move, {
      id: ids.roast,
      toGroupSlug: 'cooking-club',
    })

    // Bob is in the household only, and the roast has left it.
    const household = await t
      .withIdentity(asBob)
      .query(api.recipes.list, { groupSlug: 'household' })
    expect(titles(household)).toEqual(['Pasta for a crowd'])

    // Carol is in the club only, and it has arrived.
    const club = await t
      .withIdentity(asCarol)
      .query(api.recipes.list, { groupSlug: 'cooking-club' })
    expect(titles(club)).toEqual([
      'Club sourdough',
      'Pasta for a crowd',
      'Sunday roast',
    ])
  })

  test('the recipe now lives in the destination Group', async () => {
    const { t, ids } = await seedWithAliceInBothGroups()

    await t.withIdentity(asAlice).mutation(api.recipes.move, {
      id: ids.roast,
      toGroupSlug: 'cooking-club',
    })

    const moved = await t.run(async (ctx) => await ctx.db.get(ids.roast))
    expect(moved?.groupId).toBe(ids.cookingClub)
  })

  /**
   * The recipe was shared into the club and is now moved there. It is home, not
   * a guest: `sharedGroupIds` never contains `groupId` (schema).
   */
  test('moving into a Group it was shared with takes it off the shared list', async () => {
    const { t, ids } = await seedWithAliceInBothGroups()

    await t.withIdentity(asAlice).mutation(api.recipes.move, {
      id: ids.sharedWithClub,
      toGroupSlug: 'cooking-club',
    })

    const moved = await t.run(
      async (ctx) => await ctx.db.get(ids.sharedWithClub),
    )
    expect(moved?.groupId).toBe(ids.cookingClub)
    expect(moved?.sharedGroupIds).toEqual([])

    // And it is in the club's list exactly once.
    const club = await t
      .withIdentity(asCarol)
      .query(api.recipes.list, { groupSlug: 'cooking-club' })
    expect(titles(club)).toEqual(['Club sourdough', 'Pasta for a crowd'])
  })

  /** A move changes where a recipe lives. Who else was shown it is unrelated. */
  test('shares into other Groups survive the move', async () => {
    const { t, ids } = await seedWithAliceInBothGroups()

    const secondHousehold = await t.run(async (ctx) => {
      const group = await ctx.db.insert('groups', {
        name: 'Second household',
        inviteCode: 'second-code',
        slug: 'second-household',
        isPersonal: false,
      })
      await ctx.db.insert('memberships', {
        groupId: group,
        userId: ids.alice,
        role: 'admin',
      })
      return group
    })

    await t.withIdentity(asAlice).mutation(api.recipes.move, {
      id: ids.sharedWithClub,
      toGroupSlug: 'second-household',
    })

    const moved = await t.run(
      async (ctx) => await ctx.db.get(ids.sharedWithClub),
    )
    expect(moved?.groupId).toBe(secondHousehold)
    expect(moved?.sharedGroupIds).toEqual([ids.cookingClub])

    const club = await t
      .withIdentity(asCarol)
      .query(api.recipes.list, { groupSlug: 'cooking-club' })
    expect(titles(club)).toContain('Pasta for a crowd')
  })

  test('moving it where it already lives changes nothing', async () => {
    const { t, ids } = await seed()

    await t
      .withIdentity(asAlice)
      .mutation(api.recipes.move, { id: ids.roast, toGroupSlug: 'household' })

    const after = await t.run(async (ctx) => await ctx.db.get(ids.roast))
    expect(after?.groupId).toBe(ids.household)
    expect(after?.sharedGroupIds).toEqual([])
  })

  test('a Group the caller is not a Member of is not a destination', async () => {
    const { t, ids } = await seed()

    // Alice may write the roast; she is not in the club.
    await expect(
      t.withIdentity(asAlice).mutation(api.recipes.move, {
        id: ids.roast,
        toGroupSlug: 'cooking-club',
      }),
    ).rejects.toThrow(/not a member/i)

    const after = await t.run(async (ctx) => await ctx.db.get(ids.roast))
    expect(after?.groupId).toBe(ids.household)
  })
})

describe('sharing a recipe with another Group', () => {
  test('adds visibility without changing where it lives', async () => {
    const { t, ids } = await seedWithAliceInBothGroups()

    await t.withIdentity(asAlice).mutation(api.recipes.share, {
      id: ids.roast,
      withGroupSlug: 'cooking-club',
    })

    const club = await t
      .withIdentity(asCarol)
      .query(api.recipes.list, { groupSlug: 'cooking-club' })
    expect(titles(club)).toContain('Sunday roast')

    // The household has not lost it, and it still lives there.
    const household = await t
      .withIdentity(asBob)
      .query(api.recipes.list, { groupSlug: 'household' })
    expect(titles(household)).toEqual(['Pasta for a crowd', 'Sunday roast'])
    const after = await t.run(async (ctx) => await ctx.db.get(ids.roast))
    expect(after?.groupId).toBe(ids.household)
  })

  test('sharing twice does not duplicate it', async () => {
    const { t, ids } = await seedWithAliceInBothGroups()

    for (const _ of [0, 1]) {
      await t.withIdentity(asAlice).mutation(api.recipes.share, {
        id: ids.roast,
        withGroupSlug: 'cooking-club',
      })
    }

    const after = await t.run(async (ctx) => await ctx.db.get(ids.roast))
    expect(after?.sharedGroupIds).toEqual([ids.cookingClub])
    // The club's own sourdough, the pasta the seed already shared in, and the
    // roast — once.
    const club = await t
      .withIdentity(asCarol)
      .query(api.recipes.list, { groupSlug: 'cooking-club' })
    expect(titles(club)).toEqual([
      'Club sourdough',
      'Pasta for a crowd',
      'Sunday roast',
    ])
  })

  test('sharing with the Group it lives in asks for what is already true', async () => {
    const { t, ids } = await seed()

    await t.withIdentity(asAlice).mutation(api.recipes.share, {
      id: ids.roast,
      withGroupSlug: 'household',
    })

    const after = await t.run(async (ctx) => await ctx.db.get(ids.roast))
    expect(after?.sharedGroupIds).toEqual([])
  })

  test('a Group the caller is not a Member of cannot be shared into', async () => {
    const { t, ids } = await seed()

    await expect(
      t.withIdentity(asAlice).mutation(api.recipes.share, {
        id: ids.roast,
        withGroupSlug: 'cooking-club',
      }),
    ).rejects.toThrow(/not a member/i)
  })
})

describe('unsharing a recipe', () => {
  test('removes that visibility and leaves the home Group untouched', async () => {
    const { t, ids } = await seed()

    await t.withIdentity(asAlice).mutation(api.recipes.unshare, {
      id: ids.sharedWithClub,
      withGroupSlug: 'cooking-club',
    })

    const club = await t
      .withIdentity(asCarol)
      .query(api.recipes.list, { groupSlug: 'cooking-club' })
    expect(titles(club)).toEqual(['Club sourdough'])

    const household = await t
      .withIdentity(asBob)
      .query(api.recipes.list, { groupSlug: 'household' })
    expect(titles(household)).toEqual(['Pasta for a crowd', 'Sunday roast'])
    const after = await t.run(
      async (ctx) => await ctx.db.get(ids.sharedWithClub),
    )
    expect(after?.groupId).toBe(ids.household)
    expect(after?.sharedGroupIds).toEqual([])
  })

  /**
   * Alice is not in the club and does not need to be. Taking back a Share puts
   * nothing into anybody's Group, and requiring membership would leave a Share
   * into a Group the sharer has since left impossible to withdraw.
   */
  test('does not require the caller to be in the Group being cut off', async () => {
    const { t, ids } = await seed()

    const aliceIsInTheClub = await t.run(async (ctx) =>
      (await ctx.db.query('memberships').collect()).some(
        (m) => m.userId === ids.alice && m.groupId === ids.cookingClub,
      ),
    )
    expect(aliceIsInTheClub).toBe(false)

    await t.withIdentity(asAlice).mutation(api.recipes.unshare, {
      id: ids.sharedWithClub,
      withGroupSlug: 'cooking-club',
    })

    const after = await t.run(
      async (ctx) => await ctx.db.get(ids.sharedWithClub),
    )
    expect(after?.sharedGroupIds).toEqual([])
  })

  test('unsharing something that was never shared is not an error', async () => {
    const { t, ids } = await seed()

    await t.withIdentity(asAlice).mutation(api.recipes.unshare, {
      id: ids.roast,
      withGroupSlug: 'cooking-club',
    })
    await t.withIdentity(asAlice).mutation(api.recipes.unshare, {
      id: ids.sharedWithClub,
      withGroupSlug: 'cooking-club',
    })
    await t.withIdentity(asAlice).mutation(api.recipes.unshare, {
      id: ids.sharedWithClub,
      withGroupSlug: 'cooking-club',
    })

    const roast = await t.run(async (ctx) => await ctx.db.get(ids.roast))
    expect(roast?.sharedGroupIds).toEqual([])
    const pasta = await t.run(
      async (ctx) => await ctx.db.get(ids.sharedWithClub),
    )
    expect(pasta?.sharedGroupIds).toEqual([])
  })

  test('the Group it lives in is refused, not quietly ignored', async () => {
    const { t, ids } = await seed()

    await expect(
      t.withIdentity(asAlice).mutation(api.recipes.unshare, {
        id: ids.roast,
        withGroupSlug: 'household',
      }),
    ).rejects.toThrow(/cannot be unshared/i)

    const household = await t
      .withIdentity(asBob)
      .query(api.recipes.list, { groupSlug: 'household' })
    expect(titles(household)).toContain('Sunday roast')
  })
})

/**
 * Who may move or share: a Member of the recipe's *home* Group.
 *
 * "Only someone who can already see it" is a necessary condition and not a
 * sufficient one — seeing includes seeing through a Share, and a cooking club
 * that was shown a household's recipe must not be able to take it away. It is
 * the same rule that already governs editing.
 */
describe('a Share is standing to read and nothing else', () => {
  test('a Group it was shared into cannot move, share or unshare it', async () => {
    const { t, ids } = await seed()

    // Carol can see it; that is the whole point of the setup.
    const visible = await t.withIdentity(asCarol).query(api.recipes.get, {
      id: ids.sharedWithClub,
      groupSlug: 'cooking-club',
    })
    expect(visible?.title).toBe('Pasta for a crowd')

    await expect(
      t.withIdentity(asCarol).mutation(api.recipes.move, {
        id: ids.sharedWithClub,
        toGroupSlug: 'cooking-club',
      }),
    ).rejects.toThrow(/recipe not found/i)
    await expect(
      t.withIdentity(asCarol).mutation(api.recipes.share, {
        id: ids.sharedWithClub,
        withGroupSlug: 'cooking-club',
      }),
    ).rejects.toThrow(/recipe not found/i)
    await expect(
      t.withIdentity(asCarol).mutation(api.recipes.unshare, {
        id: ids.sharedWithClub,
        withGroupSlug: 'cooking-club',
      }),
    ).rejects.toThrow(/recipe not found/i)

    const after = await t.run(
      async (ctx) => await ctx.db.get(ids.sharedWithClub),
    )
    expect(after?.groupId).toBe(ids.household)
    expect(after?.sharedGroupIds).toEqual([ids.cookingClub])
  })

  /**
   * Bob is in neither the recipe's Group nor any Group it is shared into. The
   * three verbs must tell him exactly what they tell him about an id that is no
   * longer a recipe at all — otherwise the refusal is a way to find out that a
   * recipe exists somewhere.
   */
  test('someone outside every one of its Groups gets the answer for a recipe that is not there', async () => {
    const { t, ids } = await seed()

    // A real id whose row has gone.
    const deleted = await t.run(async (ctx) => {
      const id = await ctx.db.insert('recipes', {
        groupId: ids.cookingClub,
        sharedGroupIds: [],
        createdByUserId: ids.carol,
        title: 'Briefly existed',
        ingredients: [],
        steps: [],
        tags: [],
      })
      await ctx.db.delete(id)
      return id
    })

    for (const id of [ids.clubOnly, deleted]) {
      await expect(
        t
          .withIdentity(asBob)
          .mutation(api.recipes.move, { id, toGroupSlug: 'household' }),
      ).rejects.toThrow(/recipe not found/i)
      await expect(
        t
          .withIdentity(asBob)
          .mutation(api.recipes.share, { id, withGroupSlug: 'household' }),
      ).rejects.toThrow(/recipe not found/i)
      await expect(
        t
          .withIdentity(asBob)
          .mutation(api.recipes.unshare, { id, withGroupSlug: 'household' }),
      ).rejects.toThrow(/recipe not found/i)
    }

    const survives = await t.run(async (ctx) => await ctx.db.get(ids.clubOnly))
    expect(survives?.groupId).toBe(ids.cookingClub)
  })

  test('a signed-out caller cannot use any of them', async () => {
    const { t, ids } = await seed()

    await expect(
      t.mutation(api.recipes.move, { id: ids.roast, toGroupSlug: 'household' }),
    ).rejects.toThrow(/not authenticated/i)
  })
})

/** A picture in storage, as an upload or a URL import would leave one. */
async function storeImage(t: Harness) {
  return await t.run(async (ctx) => await ctx.storage.store(new Blob(['jpeg'])))
}

async function attachImage(
  t: Harness,
  recipeId: Id<'recipes'>,
  imageId: Id<'_storage'>,
) {
  await t.run(async (ctx) => {
    await ctx.db.patch(recipeId, { imageId })
  })
}

async function imageExists(t: Harness, imageId: Id<'_storage'>) {
  return await t.run(
    async (ctx) => (await ctx.storage.getUrl(imageId)) !== null,
  )
}

/** The fields `recipes.update` insists on, for an edit that is about the picture. */
const roastFields = {
  title: 'Sunday roast',
  ingredients: [],
  steps: [],
  tags: [],
}

/**
 * A recipe's picture is a blob in Convex storage that only its row points at,
 * so the mutation that stops pointing at it is the last chance anything has to
 * delete it (#38).
 */
describe("a recipe's picture does not outlive the row that held it", () => {
  test('replacing it deletes the one that was there', async () => {
    const { t, ids } = await seed()
    const old = await storeImage(t)
    await attachImage(t, ids.roast, old)
    const replacement = await storeImage(t)

    await t.withIdentity(asAlice).mutation(api.recipes.update, {
      id: ids.roast,
      ...roastFields,
      imageId: replacement,
    })

    expect(await imageExists(t, old)).toBe(false)
    expect(await imageExists(t, replacement)).toBe(true)
    const recipe = await t.run(async (ctx) => await ctx.db.get(ids.roast))
    expect(recipe?.imageId).toBe(replacement)
  })

  test('removing it deletes it and leaves the field absent', async () => {
    const { t, ids } = await seed()
    const image = await storeImage(t)
    await attachImage(t, ids.roast, image)

    await t.withIdentity(asAlice).mutation(api.recipes.update, {
      id: ids.roast,
      ...roastFields,
      imageId: null,
    })

    expect(await imageExists(t, image)).toBe(false)
    const recipe = await t.run(async (ctx) => await ctx.db.get(ids.roast))
    expect(recipe?.imageId).toBeUndefined()
  })

  test('an edit that leaves the picture alone keeps it', async () => {
    const { t, ids } = await seed()
    const image = await storeImage(t)
    await attachImage(t, ids.roast, image)

    await t.withIdentity(asAlice).mutation(api.recipes.update, {
      id: ids.roast,
      ...roastFields,
      title: 'Sunday roast, revisited',
    })
    // Passing the same id back is the same non-event as omitting it.
    await t.withIdentity(asAlice).mutation(api.recipes.update, {
      id: ids.roast,
      ...roastFields,
      imageId: image,
    })

    expect(await imageExists(t, image)).toBe(true)
  })

  test('deleting the recipe deletes its picture', async () => {
    const { t, ids } = await seed()
    const image = await storeImage(t)
    await attachImage(t, ids.roast, image)

    await t.withIdentity(asAlice).mutation(api.recipes.remove, { id: ids.roast })

    expect(await imageExists(t, image)).toBe(false)
  })

  /**
   * Deliberate, and worth stating as a consequence rather than discovering as a
   * surprise: a Share makes content visible in a further Group without giving
   * that Group a claim on it, and writing follows the home Group (ADR-0007). So
   * the club loses the picture along with the recipe, because it never had
   * anything of its own to keep.
   */
  test('deleting a recipe the club was shared takes the picture from the club too', async () => {
    const { t, ids } = await seed()
    const image = await storeImage(t)
    await attachImage(t, ids.sharedWithClub, image)

    const clubBefore = await t
      .withIdentity(asCarol)
      .query(api.recipes.list, { groupSlug: 'cooking-club' })
    expect(titles(clubBefore)).toContain('Pasta for a crowd')

    await t
      .withIdentity(asAlice)
      .mutation(api.recipes.remove, { id: ids.sharedWithClub })

    expect(await imageExists(t, image)).toBe(false)
    const clubAfter = await t
      .withIdentity(asCarol)
      .query(api.recipes.list, { groupSlug: 'cooking-club' })
    expect(titles(clubAfter)).toEqual(['Club sourdough'])
  })

  test('a recipe with no picture is edited and deleted without incident', async () => {
    const { t, ids } = await seed()

    await t.withIdentity(asAlice).mutation(api.recipes.update, {
      id: ids.roast,
      ...roastFields,
      imageId: null,
    })
    await t.withIdentity(asAlice).mutation(api.recipes.remove, { id: ids.roast })

    const survives = await t.run(async (ctx) => await ctx.db.get(ids.roast))
    expect(survives).toBeNull()
  })

  // The delete sits behind the access check, so the refusal path never reaches
  // it — a caller who may not write the row cannot take its picture either.
  test('a refused edit deletes nothing', async () => {
    const { t, ids } = await seed()
    const image = await storeImage(t)
    await attachImage(t, ids.roast, image)

    await expect(
      t.withIdentity(asCarol).mutation(api.recipes.update, {
        id: ids.roast,
        ...roastFields,
        imageId: null,
      }),
    ).rejects.toThrow(/recipe not found/i)

    expect(await imageExists(t, image)).toBe(true)
  })

  test('a refused delete deletes nothing', async () => {
    const { t, ids } = await seed()
    const image = await storeImage(t)
    await attachImage(t, ids.roast, image)

    // `remove` refuses by returning, so the picture surviving is the whole of
    // what there is to assert.
    await t.withIdentity(asCarol).mutation(api.recipes.remove, { id: ids.roast })

    expect(await imageExists(t, image)).toBe(true)
    const survives = await t.run(async (ctx) => await ctx.db.get(ids.roast))
    expect(survives?.title).toBe('Sunday roast')
  })

  test('a picture already gone stops neither the edit nor the delete', async () => {
    const { t, ids } = await seed()
    const image = await storeImage(t)
    await attachImage(t, ids.roast, image)
    await t.run(async (ctx) => {
      await ctx.storage.delete(image)
    })

    await t.withIdentity(asAlice).mutation(api.recipes.update, {
      id: ids.roast,
      ...roastFields,
      imageId: null,
    })
    await t.withIdentity(asAlice).mutation(api.recipes.remove, { id: ids.roast })

    const survives = await t.run(async (ctx) => await ctx.db.get(ids.roast))
    expect(survives).toBeNull()
  })
})

/**
 * The delete rule rests on no two rows ever holding one `_storage` id — and
 * nothing enforces that at the door. `imageId` is client-supplied on create and
 * update, and every read of a recipe hands the id back, so a Member of a Group
 * a recipe was merely *shared into* can put that id on a recipe of their own.
 * They still cannot write the original row; without a guard, deleting their
 * copy would take the original's picture with it (PR #58 review).
 */
describe('a picture two rows point at survives the first of them going', () => {
  test('deleting a recipe that borrowed another Group’s image leaves it alone', async () => {
    const { t, ids } = await seed()
    const image = await storeImage(t)
    await attachImage(t, ids.sharedWithClub, image)

    // Carol reads the shared recipe — the id comes back with it — and puts that
    // id on a recipe of her own, in the one Group she can write.
    const seen = await t
      .withIdentity(asCarol)
      .query(api.recipes.get, { id: ids.sharedWithClub, groupSlug: 'cooking-club' })
    const borrowed = await t.withIdentity(asCarol).mutation(api.recipes.create, {
      groupSlug: 'cooking-club',
      title: 'Not mine',
      ingredients: [],
      steps: [],
      tags: [],
      imageId: seen?.imageId,
    })

    await t.withIdentity(asCarol).mutation(api.recipes.remove, { id: borrowed })

    expect(await imageExists(t, image)).toBe(true)
    const original = await t.run(async (ctx) => await ctx.db.get(ids.sharedWithClub))
    expect(original?.imageId).toBe(image)
  })

  test('replacing the borrowed image leaves the original alone too', async () => {
    const { t, ids } = await seed()
    const image = await storeImage(t)
    await attachImage(t, ids.sharedWithClub, image)

    const borrowed = await t.withIdentity(asCarol).mutation(api.recipes.create, {
      groupSlug: 'cooking-club',
      title: 'Not mine',
      ingredients: [],
      steps: [],
      tags: [],
      imageId: image,
    })
    await t.withIdentity(asCarol).mutation(api.recipes.update, {
      id: borrowed,
      title: 'Not mine',
      ingredients: [],
      steps: [],
      tags: [],
      imageId: null,
    })

    expect(await imageExists(t, image)).toBe(true)
  })

  // The last row to let go of a blob is still the one that deletes it.
  test('once the borrowing copy is gone, the original still deletes its own picture', async () => {
    const { t, ids } = await seed()
    const image = await storeImage(t)
    await attachImage(t, ids.sharedWithClub, image)
    const borrowed = await t.withIdentity(asCarol).mutation(api.recipes.create, {
      groupSlug: 'cooking-club',
      title: 'Not mine',
      ingredients: [],
      steps: [],
      tags: [],
      imageId: image,
    })

    await t.withIdentity(asCarol).mutation(api.recipes.remove, { id: borrowed })
    await t
      .withIdentity(asAlice)
      .mutation(api.recipes.remove, { id: ids.sharedWithClub })

    expect(await imageExists(t, image)).toBe(false)
  })
})
