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

describe("a Group's collection is the Group's, not the caller's", () => {
  /**
   * Alice is in the household *and* the cooking club; Bob is only in the
   * household. Asking for the household by slug must give them the same answer
   * — if the caller's other memberships leak in, the URL has stopped deciding
   * what is on the page and ADR-0002 is not being honoured.
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
