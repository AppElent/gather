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
