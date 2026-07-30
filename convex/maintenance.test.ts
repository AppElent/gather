import { convexTest } from 'convex-test'
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { describe, expect, test } from 'vitest'
import { modules } from '../test/convexHarness'
import { api, internal } from './_generated/api'
import schema from './schema'

/**
 * The backfill behind #17, tested against the data it actually has to repair.
 *
 * A migration is the one thing that cannot be tested on the current schema:
 * `groups` rows with no slug, no `isPersonal` and a stray `type`, and
 * memberships still called `owner`, are precisely what the schema stopped
 * allowing once the backfill had removed them. So this file builds its backend
 * on the *pre-migration* schema — the same tables, with those three fields as
 * they were — and runs the real internal mutation against it.
 *
 * Every other table is taken from the app's own schema, so this cannot drift
 * into testing a fictional database.
 */
const legacySchema = defineSchema({
  ...schema.tables,
  groups: defineTable({
    name: v.string(),
    inviteCode: v.string(),
    slug: v.optional(v.string()),
    isPersonal: v.optional(v.boolean()),
    type: v.optional(v.string()),
  })
    .index('by_inviteCode', ['inviteCode'])
    .index('by_slug', ['slug']),
  memberships: defineTable({
    groupId: v.id('groups'),
    userId: v.id('users'),
    role: v.union(v.literal('admin'), v.literal('member'), v.literal('owner')),
  })
    .index('by_user', ['userId'])
    .index('by_group', ['groupId']),
})

function legacyConvex() {
  return convexTest(legacySchema, modules)
}

type Harness = ReturnType<typeof legacyConvex>

const asAlice = { subject: 'clerk_alice', name: 'Alice', email: 'a@example.com' }
const asBob = { subject: 'clerk_bob', name: 'Bob', email: 'b@example.com' }

const backfill = internal.maintenance.backfillGroupSlugsAndPersonalGroups

/**
 * Rows exactly as they looked before this change: a `Home` group with no slug,
 * no `isPersonal` and a `type`, `owner` memberships, and Alice's
 * `defaultGroupId` pointing at her `Home` group. Bob is in the household only,
 * so he has no Personal group at all.
 */
async function seedLegacy(t: Harness) {
  return await t.run(async (ctx) => {
    const alice = await ctx.db.insert('users', {
      clerkId: asAlice.subject,
      name: 'Alice',
      email: asAlice.email,
    })
    const bob = await ctx.db.insert('users', {
      clerkId: asBob.subject,
      name: 'Bob',
      email: asBob.email,
    })
    const home = await ctx.db.insert('groups', {
      name: 'Home',
      inviteCode: 'home-code',
      type: 'home',
    })
    const household = await ctx.db.insert('groups', {
      name: 'Jansen Household',
      inviteCode: 'household-code',
    })
    await ctx.db.insert('memberships', {
      groupId: home,
      userId: alice,
      role: 'owner',
    })
    await ctx.db.insert('memberships', {
      groupId: household,
      userId: alice,
      role: 'owner',
    })
    await ctx.db.insert('memberships', {
      groupId: household,
      userId: bob,
      role: 'member',
    })
    await ctx.db.patch(alice, { defaultGroupId: home })
    return { alice, bob, home, household }
  })
}

/** The whole visible state the backfill touches. */
async function rows(t: Harness) {
  return await t.run(async (ctx) => ({
    groups: (await ctx.db.query('groups').collect()).map((g) => ({
      name: g.name,
      // `t.run` returns through Convex's serialiser, which has no `undefined`.
      slug: g.slug ?? null,
      isPersonal: g.isPersonal ?? null,
      hasTypeField: 'type' in g,
    })),
    memberships: (await ctx.db.query('memberships').collect()).map(
      (m) => m.role,
    ),
    defaults: (await ctx.db.query('users').collect()).map(
      (u) => u.defaultGroupId ?? null,
    ),
  }))
}

/** The Personal group a person can see, through the real query. */
async function personalGroupOf(t: Harness, identity: typeof asAlice) {
  const groups = await t.withIdentity(identity).query(api.groups.myGroups, {})
  const personal = groups.filter((g) => g.isPersonal)
  expect(personal).toHaveLength(1)
  return personal[0]
}

describe('backfillGroupSlugsAndPersonalGroups', () => {
  test('changes nothing until asked to apply', async () => {
    const t = legacyConvex()
    await seedLegacy(t)
    const before = await rows(t)

    const summary = await t.mutation(backfill, {})

    expect(summary.apply).toBe(false)
    expect(summary).toMatchObject({
      slugsAssigned: 2,
      groupsMarkedPersonal: 1,
      groupsMarkedShared: 1,
      rolesMigrated: 2,
      droppedTypeFields: 1,
      personalGroupsCreated: 1,
    })
    expect(await rows(t)).toEqual(before)
  })

  test('gives every Group a slug and marks the Personal ones', async () => {
    const t = legacyConvex()
    await seedLegacy(t)

    await t.mutation(backfill, { apply: true })

    const after = await rows(t)
    expect(after.groups).toEqual(
      expect.arrayContaining([
        // A Personal group's slug reads from the person, not from "Home".
        { name: 'Home', slug: 'me-alice', isPersonal: true, hasTypeField: false },
        {
          name: 'Jansen Household',
          slug: 'jansen-household',
          isPersonal: false,
          hasTypeField: false,
        },
      ]),
    )
  })

  test('renames the owner role to admin', async () => {
    const t = legacyConvex()
    await seedLegacy(t)

    await t.mutation(backfill, { apply: true })

    const { memberships } = await rows(t)
    expect(memberships).not.toContain('owner')
    // Alice's two `owner` rows, Bob's `member` row, and the admin membership
    // of the Personal group Bob was given.
    expect(memberships.sort()).toEqual(['admin', 'admin', 'admin', 'member'])
  })

  test('drops the type field the tightened schema would reject', async () => {
    const t = legacyConvex()
    await seedLegacy(t)

    await t.mutation(backfill, { apply: true })

    const { groups } = await rows(t)
    expect(groups.some((g) => g.hasTypeField)).toBe(false)
  })

  test('gives a person with no Personal group one, as their default', async () => {
    const t = legacyConvex()
    await seedLegacy(t)

    await t.mutation(backfill, { apply: true })

    const personal = await personalGroupOf(t, asBob)
    expect(personal.name).toBe("Bob's things")
    expect(personal.slug).toBe('me-bob')
    const bob = await t.withIdentity(asBob).query(api.users.me, {})
    expect(bob?.defaultGroupId).toBe(personal._id)
  })

  test('leaves everything alone the second time it is applied', async () => {
    const t = legacyConvex()
    await seedLegacy(t)
    await t.mutation(backfill, { apply: true })
    const afterFirst = await rows(t)

    const summary = await t.mutation(backfill, { apply: true })

    expect(summary).toEqual({
      apply: true,
      rolesMigrated: 0,
      groupsMarkedPersonal: 0,
      groupsMarkedShared: 0,
      slugsAssigned: 0,
      droppedTypeFields: 0,
      personalGroupsCreated: 0,
      defaultGroupsRepointed: 0,
    })
    expect(await rows(t)).toEqual(afterFirst)
  })

  test('does not hand two Groups the same slug', async () => {
    const t = legacyConvex()
    await t.run(async (ctx) => {
      for (const inviteCode of ['a', 'b', 'c']) {
        await ctx.db.insert('groups', { name: 'Wine club', inviteCode })
      }
    })

    await t.mutation(backfill, { apply: true })

    const slugs = await t.run(
      async (ctx) =>
        (await ctx.db.query('groups').collect()).map((g) => g.slug ?? ''),
    )
    expect(slugs.sort()).toEqual(['wine-club', 'wine-club-2', 'wine-club-3'])
  })

  test('two people with the same name get distinct Personal slugs', async () => {
    const t = legacyConvex()
    await t.run(async (ctx) => {
      for (const clerkId of [asAlice.subject, asBob.subject]) {
        await ctx.db.insert('users', {
          clerkId,
          name: 'Alice',
          email: `${clerkId}@example.com`,
        })
      }
    })

    await t.mutation(backfill, { apply: true })

    const slugs = [
      (await personalGroupOf(t, asAlice)).slug,
      (await personalGroupOf(t, asBob)).slug,
    ]
    expect(slugs.sort()).toEqual(['me-alice', 'me-alice-2'])
  })
})
