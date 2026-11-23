import { describe, expect, test } from 'vitest'
import { seedGroup, seedMember, testConvex } from '../test/convexHarness'
import { api } from './_generated/api'

const alice = {
  subject: 'search_alice',
  name: 'Alice',
  email: 'search@example.com',
}

describe('Group search', () => {
  test('returns matching records from the addressed Group in name-first order', async () => {
    const t = testConvex()
    await t.run(async (ctx) => {
      const aliceId = await ctx.db.insert('users', {
        clerkId: alice.subject,
        name: alice.name,
        email: alice.email,
      })
      const groupId = await seedGroup(ctx, {
        name: 'Home',
        slug: 'search-home',
        inviteCode: 'search-home',
      })
      const otherGroupId = await seedGroup(ctx, {
        name: 'Elsewhere',
        slug: 'search-elsewhere',
        inviteCode: 'search-elsewhere',
      })
      await seedMember(ctx, groupId, aliceId, 'admin')
      await seedMember(ctx, otherGroupId, aliceId, 'admin')
      await ctx.db.insert('recipes', {
        groupId,
        sharedGroupIds: [],
        createdByUserId: aliceId,
        title: 'Comté tart',
        ingredients: ['butter'],
        steps: [],
        tags: ['dinner'],
      })
      await ctx.db.insert('notes', {
        groupId,
        title: 'Saturday menu',
        body: 'Serve Comté after dinner.',
        createdBy: aliceId,
        updatedAt: 1,
      })
      await ctx.db.insert('notes', {
        groupId: otherGroupId,
        title: 'Comté elsewhere',
        body: '',
        createdBy: aliceId,
        updatedAt: 1,
      })
    })

    const results = await t
      .withIdentity(alice)
      .query(api.search.group, { groupSlug: 'search-home', query: 'comté' })

    expect(results.map((result) => result.title)).toEqual([
      'Comté tart',
      'Saturday menu',
    ])
    expect(results.map((result) => result.type)).toEqual(['recipe', 'note'])
  })
})

describe('Group search filter fields', () => {
  test("says whether a task is done and who added each record", async () => {
    const t = testConvex()
    const aliceId = await t.run(async (ctx) => {
      const aliceId = await ctx.db.insert('users', {
        clerkId: alice.subject,
        name: alice.name,
        email: alice.email,
      })
      const groupId = await seedGroup(ctx, {
        name: 'Home',
        slug: 'search-filters',
        inviteCode: 'search-filters',
      })
      await seedMember(ctx, groupId, aliceId, 'admin')
      const listId = await ctx.db.insert('taskLists', {
        groupId,
        name: 'Chores',
        provider: 'local',
        order: 0,
      })
      await ctx.db.insert('tasks', {
        listId,
        title: 'Buy milk',
        done: true,
        order: 0,
        createdBy: aliceId,
      })
      await ctx.db.insert('notes', {
        groupId,
        title: 'Milk brands',
        body: '',
        createdBy: aliceId,
        updatedAt: 1,
      })
      return aliceId
    })

    const results = await t.withIdentity(alice).query(api.search.group, {
      groupSlug: 'search-filters',
      query: 'milk',
      accepts: ['task', 'note'],
    })

    expect(results).toMatchObject([
      { title: 'Milk brands', type: 'note', createdBy: aliceId },
      { title: 'Buy milk', type: 'task', done: true, createdBy: aliceId },
    ])
    expect(results[0]).not.toHaveProperty('done')
  })
})

describe('Group search for loyalty cards', () => {
  const bob = {
    subject: 'search_bob',
    name: 'Bob',
    email: 'search-bob@example.com',
  }

  async function seedCards() {
    const t = testConvex()
    await t.run(async (ctx) => {
      const bobId = await ctx.db.insert('users', {
        clerkId: bob.subject,
        name: bob.name,
        email: bob.email,
      })
      const groupId = await seedGroup(ctx, {
        name: 'Cards',
        slug: 'search-cards',
        inviteCode: 'search-cards',
      })
      const otherGroupId = await seedGroup(ctx, {
        name: 'Other cards',
        slug: 'search-other-cards',
        inviteCode: 'search-other-cards',
      })
      await seedMember(ctx, groupId, bobId, 'admin')
      await seedMember(ctx, otherGroupId, bobId, 'admin')
      const card = {
        cardNumber: '2620000000008',
        barcodeFormat: 'EAN_13' as const,
        createdByUserId: bobId,
      }
      await ctx.db.insert('loyaltyCards', {
        ...card,
        groupId,
        storeName: 'Albert Heijn',
        holder: 'Sam',
      })
      await ctx.db.insert('loyaltyCards', {
        ...card,
        groupId,
        storeName: 'Kruidvat',
        holder: 'Samira',
      })
      await ctx.db.insert('loyaltyCards', {
        ...card,
        groupId: otherGroupId,
        storeName: 'Albert Heijn elsewhere',
      })
    })
    return t.withIdentity(bob)
  }

  test('finds a card by its store name and by its holder, in this Group only', async () => {
    const asBob = await seedCards()
    const accepts = ['loyaltyCard' as const]

    const byStore = await asBob.query(api.search.group, {
      groupSlug: 'search-cards',
      query: 'albert',
      accepts,
    })
    expect(byStore).toMatchObject([
      { type: 'loyaltyCard', title: 'Albert Heijn', excerpt: 'Sam' },
    ])

    const byHolder = await asBob.query(api.search.group, {
      groupSlug: 'search-cards',
      query: 'sam',
      accepts,
    })
    expect(byHolder.map((result) => result.title)).toEqual([
      'Kruidvat',
      'Albert Heijn',
    ])
  })

  test('a caller that does not ask for loyalty cards gets none', async () => {
    const asBob = await seedCards()
    const results = await asBob.query(api.search.group, {
      groupSlug: 'search-cards',
      query: 'albert',
    })
    expect(results).toEqual([])
  })
})

describe('Group search narrowed to one Module (APP-613)', () => {
  const carol = {
    subject: 'search_carol',
    name: 'Carol',
    email: 'search-carol@example.com',
  }

  test('finds a recipe Shared into the Group, and not one whose share was withdrawn', async () => {
    const t = testConvex()
    await t.run(async (ctx) => {
      const carolId = await ctx.db.insert('users', {
        clerkId: carol.subject,
        name: carol.name,
        email: carol.email,
      })
      const home = await seedGroup(ctx, {
        name: 'Home',
        slug: 'search-shared-home',
        inviteCode: 'search-shared-home',
      })
      const club = await seedGroup(ctx, {
        name: 'Club',
        slug: 'search-shared-club',
        inviteCode: 'search-shared-club',
      })
      await seedMember(ctx, home, carolId, 'admin')
      const recipe = {
        createdByUserId: carolId,
        ingredients: [],
        steps: [],
        tags: [],
      }
      const shared = await ctx.db.insert('recipes', {
        ...recipe,
        groupId: club,
        sharedGroupIds: [home],
        title: 'Club lasagne',
      })
      // A share row that lags a withdrawn share names a recipe Home no
      // longer sees.
      const withdrawn = await ctx.db.insert('recipes', {
        ...recipe,
        groupId: club,
        sharedGroupIds: [],
        title: 'Club lasagne, withdrawn',
      })
      await ctx.db.insert('recipeShares', { recipeId: shared, groupId: home })
      await ctx.db.insert('recipeShares', { recipeId: withdrawn, groupId: home })
    })

    const results = await t.withIdentity(carol).query(api.search.group, {
      groupSlug: 'search-shared-home',
      query: 'lasagne',
      accepts: ['recipe'],
    })
    expect(results.map((result) => result.title)).toEqual(['Club lasagne'])
  })

  test('reads only the asked Kind, so other tasting Modules cannot crowd it out', async () => {
    const t = testConvex()
    await t.run(async (ctx) => {
      const carolId = await ctx.db.insert('users', {
        clerkId: carol.subject,
        name: carol.name,
        email: carol.email,
      })
      const groupId = await seedGroup(ctx, {
        name: 'Tastings',
        slug: 'search-kinds',
        inviteCode: 'search-kinds',
      })
      await seedMember(ctx, groupId, carolId, 'admin')
      for (let index = 0; index < 40; index += 1)
        await ctx.db.insert('tastingSubjects', {
          groupId,
          kind: 'beer',
          name: `Rouge beer ${index}`,
          attributes: {},
          createdByUserId: carolId,
        })
      await ctx.db.insert('tastingSubjects', {
        groupId,
        kind: 'wine',
        name: 'Rouge wine',
        attributes: {},
        createdByUserId: carolId,
      })
    })

    const asCarol = t.withIdentity(carol)
    const mixed = await asCarol.query(api.search.group, {
      groupSlug: 'search-kinds',
      query: 'rouge',
      accepts: ['tasting'],
    })
    expect(mixed).toHaveLength(30)

    const wines = await asCarol.query(api.search.group, {
      groupSlug: 'search-kinds',
      query: 'rouge',
      accepts: ['tasting'],
      kind: 'wine',
    })
    expect(wines).toMatchObject([{ title: 'Rouge wine', kind: 'wine' }])
  })

  test('reads newest first, so a recent match past the budget is found', async () => {
    const t = testConvex()
    await t.run(async (ctx) => {
      const carolId = await ctx.db.insert('users', {
        clerkId: carol.subject,
        name: carol.name,
        email: carol.email,
      })
      const groupId = await seedGroup(ctx, {
        name: 'Notes',
        slug: 'search-many-notes',
        inviteCode: 'search-many-notes',
      })
      await seedMember(ctx, groupId, carolId, 'admin')
      for (let index = 0; index < 220; index += 1)
        await ctx.db.insert('notes', {
          groupId,
          title: `Note ${index}`,
          body: '',
          createdBy: carolId,
          updatedAt: 1,
        })
      await ctx.db.insert('notes', {
        groupId,
        title: 'Boiler manual',
        body: '',
        createdBy: carolId,
        updatedAt: 1,
      })
    })

    const results = await t.withIdentity(carol).query(api.search.group, {
      groupSlug: 'search-many-notes',
      query: 'boiler',
      accepts: ['note'],
    })
    expect(results.map((result) => result.title)).toEqual(['Boiler manual'])
  })
})

describe('Group search recipe budget', () => {
  const dan = {
    subject: 'search_dan',
    name: 'Dan',
    email: 'search-dan@example.com',
  }

  test('a Group with no shares keeps the whole recipe budget for its own', async () => {
    const t = testConvex()
    await t.run(async (ctx) => {
      const danId = await ctx.db.insert('users', {
        clerkId: dan.subject,
        name: dan.name,
        email: dan.email,
      })
      const groupId = await seedGroup(ctx, {
        name: 'Kitchen',
        slug: 'search-recipe-budget',
        inviteCode: 'search-recipe-budget',
      })
      await seedMember(ctx, groupId, danId, 'admin')
      const recipe = {
        groupId,
        sharedGroupIds: [],
        createdByUserId: danId,
        ingredients: [],
        steps: [],
        tags: [],
      }
      await ctx.db.insert('recipes', { ...recipe, title: 'Oldest pie' })
      for (let index = 0; index < 199; index += 1)
        await ctx.db.insert('recipes', { ...recipe, title: `Recipe ${index}` })
    })

    const results = await t.withIdentity(dan).query(api.search.group, {
      groupSlug: 'search-recipe-budget',
      query: 'oldest',
      accepts: ['recipe'],
    })
    expect(results.map((result) => result.title)).toEqual(['Oldest pie'])
  })
})
