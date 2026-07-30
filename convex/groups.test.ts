import { describe, expect, test } from 'vitest'
import { testConvex } from '../test/convexHarness'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { requireGroupBySlug } from './lib/groupAccess'
import { RESERVED_SLUGS } from './lib/slugs'

/**
 * What a person can see and do with Groups, asserted through the real queries
 * and mutations. The rules under test are #17's acceptance criteria: everyone
 * has exactly one Personal group, every Group has a slug no other Group holds,
 * and a Personal group cannot be left or deleted.
 */

type Harness = ReturnType<typeof testConvex>

const asAlice = { subject: 'clerk_alice', name: 'Alice', email: 'a@example.com' }
const asBob = { subject: 'clerk_bob', name: 'Bob', email: 'b@example.com' }

/** Sign a person up exactly as the app does on first mount. */
async function signUp(t: Harness, identity: typeof asAlice) {
  await t.withIdentity(identity).mutation(api.users.ensureUser, {})
}

async function allGroups(t: Harness) {
  return await t.run(async (ctx) => await ctx.db.query('groups').collect())
}

async function groupsOf(t: Harness, identity: typeof asAlice) {
  return await t.withIdentity(identity).query(api.groups.myGroups, {})
}

async function personalGroupOf(t: Harness, identity: typeof asAlice) {
  const personal = (await groupsOf(t, identity)).filter((g) => g.isPersonal)
  expect(personal).toHaveLength(1)
  return personal[0]
}

describe('the Personal group', () => {
  test('exists for a person as soon as they sign up', async () => {
    const t = testConvex()
    await signUp(t, asAlice)

    const personal = await personalGroupOf(t, asAlice)
    expect(personal.name).toBe("Alice's things")
    expect(personal.slug).toBe('me-alice')
  })

  test('is not created a second time when signing in again', async () => {
    const t = testConvex()
    await signUp(t, asAlice)
    await signUp(t, asAlice)

    expect(await groupsOf(t, asAlice)).toHaveLength(1)
  })

  test('is one per person, and each person gets their own', async () => {
    const t = testConvex()
    await signUp(t, asAlice)
    await signUp(t, asBob)

    const alice = await personalGroupOf(t, asAlice)
    const bob = await personalGroupOf(t, asBob)
    expect(alice._id).not.toBe(bob._id)
    expect(bob.slug).toBe('me-bob')
  })

  test('is what defaultGroupId points at', async () => {
    const t = testConvex()
    await signUp(t, asAlice)

    const personal = await personalGroupOf(t, asAlice)
    const user = await t.withIdentity(asAlice).query(api.users.me, {})
    expect(user?.defaultGroupId).toBe(personal._id)
  })

  test('cannot be left', async () => {
    const t = testConvex()
    await signUp(t, asAlice)
    const personal = await personalGroupOf(t, asAlice)

    await expect(
      t
        .withIdentity(asAlice)
        .mutation(api.groups.leaveGroup, { groupId: personal._id }),
    ).rejects.toThrow(/personal group/i)
    expect(await groupsOf(t, asAlice)).toHaveLength(1)
  })

  test('cannot be deleted', async () => {
    const t = testConvex()
    await signUp(t, asAlice)
    const personal = await personalGroupOf(t, asAlice)

    await expect(
      t
        .withIdentity(asAlice)
        .mutation(api.groups.deleteGroup, { groupId: personal._id }),
    ).rejects.toThrow(/personal group/i)
    expect(await groupsOf(t, asAlice)).toHaveLength(1)
  })

  test('cannot be renamed', async () => {
    const t = testConvex()
    await signUp(t, asAlice)
    const personal = await personalGroupOf(t, asAlice)

    await expect(
      t.withIdentity(asAlice).mutation(api.groups.renameGroup, {
        groupId: personal._id,
        name: 'Something else',
      }),
    ).rejects.toThrow(/personal group/i)
  })
})

describe('slugs', () => {
  test('every Group has one, and no two Groups share it', async () => {
    const t = testConvex()
    await signUp(t, asAlice)
    await signUp(t, asBob)
    await t
      .withIdentity(asAlice)
      .mutation(api.groups.createGroup, { name: 'Jansen Household' })
    await t
      .withIdentity(asBob)
      .mutation(api.groups.createGroup, { name: 'Jansen Household' })
    await t
      .withIdentity(asBob)
      .mutation(api.groups.createGroup, { name: 'Wine club' })

    const slugs = (await allGroups(t)).map((g) => g.slug)
    expect(slugs).toHaveLength(5)
    expect(slugs.every((s) => typeof s === 'string' && s.length > 0)).toBe(true)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  test('a colliding name still creates a Group, with a distinct slug', async () => {
    const t = testConvex()
    await signUp(t, asAlice)

    const first: Id<'groups'> = await t
      .withIdentity(asAlice)
      .mutation(api.groups.createGroup, { name: 'Wine club' })
    const second: Id<'groups'> = await t
      .withIdentity(asAlice)
      .mutation(api.groups.createGroup, { name: 'Wine club' })

    const bySlug = new Map(
      (await groupsOf(t, asAlice)).map((g) => [g._id, g.slug]),
    )
    expect(bySlug.get(first)).toBe('wine-club')
    expect(bySlug.get(second)).toBe('wine-club-2')
  })

  test('never equals a reserved route segment', async () => {
    const t = testConvex()
    await signUp(t, asAlice)
    for (const reserved of RESERVED_SLUGS) {
      await t
        .withIdentity(asAlice)
        .mutation(api.groups.createGroup, { name: reserved })
    }

    for (const group of await allGroups(t)) {
      expect(RESERVED_SLUGS.has(group.slug ?? '')).toBe(false)
    }
  })

  test('keeps a shared Group out of the Personal namespace', async () => {
    const t = testConvex()
    await signUp(t, asAlice)
    await t
      .withIdentity(asAlice)
      .mutation(api.groups.createGroup, { name: 'Me and Bob' })

    const shared = (await groupsOf(t, asAlice)).filter((g) => !g.isPersonal)
    expect(shared).toHaveLength(1)
    expect(shared[0].slug).toBe('g-me-and-bob')
  })

  test('a household named after someone cannot take their Personal slug', async () => {
    const t = testConvex()
    await signUp(t, asBob)
    await t
      .withIdentity(asBob)
      .mutation(api.groups.createGroup, { name: 'Alice' })

    // Alice signs up second, into a world where "Alice" is already a household.
    await signUp(t, asAlice)

    const household = (await groupsOf(t, asBob)).find((g) => !g.isPersonal)
    expect(household?.slug).toBe('alice')
    expect((await personalGroupOf(t, asAlice)).slug).toBe('me-alice')
  })
})

/** Alice admins a household Bob has joined by invite. */
async function household(t: Harness) {
  await signUp(t, asAlice)
  await signUp(t, asBob)
  const groupId: Id<'groups'> = await t
    .withIdentity(asAlice)
    .mutation(api.groups.createGroup, { name: 'Jansen Household' })
  const group = await t.run(async (ctx) => await ctx.db.get(groupId))
  if (!group) throw new Error('group was not created')
  await t
    .withIdentity(asBob)
    .mutation(api.groups.joinByInvite, { inviteCode: group.inviteCode })
  return groupId
}

describe('an ordinary Group', () => {

  test('can be renamed by an admin, and the slug follows', async () => {
    const t = testConvex()
    const groupId = await household(t)

    await t
      .withIdentity(asAlice)
      .mutation(api.groups.renameGroup, { groupId, name: 'Wine club' })

    const renamed = (await groupsOf(t, asAlice)).find((g) => g._id === groupId)
    expect(renamed?.name).toBe('Wine club')
    expect(renamed?.slug).toBe('wine-club')
  })

  test('cannot be renamed by a plain member', async () => {
    const t = testConvex()
    const groupId = await household(t)

    await expect(
      t
        .withIdentity(asBob)
        .mutation(api.groups.renameGroup, { groupId, name: 'Bob club' }),
    ).rejects.toThrow(/admin/i)

    const unchanged = (await groupsOf(t, asBob)).find((g) => g._id === groupId)
    expect(unchanged?.name).toBe('Jansen Household')
  })

  test('renaming back to the same name keeps the slug it already had', async () => {
    const t = testConvex()
    const groupId = await household(t)

    await t.withIdentity(asAlice).mutation(api.groups.renameGroup, {
      groupId,
      name: 'Jansen household',
    })

    const renamed = (await groupsOf(t, asAlice)).find((g) => g._id === groupId)
    expect(renamed?.slug).toBe('jansen-household')
  })

  test('can be left, and then its content is no longer yours to see', async () => {
    const t = testConvex()
    const groupId = await household(t)

    await t.withIdentity(asBob).mutation(api.groups.leaveGroup, { groupId })

    expect((await groupsOf(t, asBob)).map((g) => g._id)).not.toContain(groupId)
    // Leaving is one person's decision: Alice still has the Group.
    expect((await groupsOf(t, asAlice)).map((g) => g._id)).toContain(groupId)
  })

  test('cannot be left by someone who is not in it', async () => {
    const t = testConvex()
    await signUp(t, asAlice)
    await signUp(t, asBob)
    const groupId: Id<'groups'> = await t
      .withIdentity(asAlice)
      .mutation(api.groups.createGroup, { name: 'Jansen Household' })

    await expect(
      t.withIdentity(asBob).mutation(api.groups.leaveGroup, { groupId }),
    ).rejects.toThrow(/not a member/i)
  })

  test('cannot be deleted while it still has other members', async () => {
    const t = testConvex()
    const groupId = await household(t)

    await expect(
      t.withIdentity(asAlice).mutation(api.groups.deleteGroup, { groupId }),
    ).rejects.toThrow(/other members/i)
  })

  test('can be deleted by its last admin', async () => {
    const t = testConvex()
    const groupId = await household(t)
    await t.withIdentity(asBob).mutation(api.groups.leaveGroup, { groupId })

    await t.withIdentity(asAlice).mutation(api.groups.deleteGroup, { groupId })

    expect((await groupsOf(t, asAlice)).map((g) => g._id)).not.toContain(groupId)
  })

  test('cannot be deleted by a plain member', async () => {
    const t = testConvex()
    const groupId = await household(t)

    await expect(
      t.withIdentity(asBob).mutation(api.groups.deleteGroup, { groupId }),
    ).rejects.toThrow(/admin/i)
  })
})

/**
 * Resolving a Group from the slug in the URL (ADR-0002). This is the check every
 * Group-scoped route and function goes through, so what matters is not only that
 * the right people get in, but that the three ways of being kept out stay told
 * apart: a Group that does not exist, one that is not yours, and no session.
 */
describe('resolving a Group by slug', () => {
  /** Alice's household, which Bob is deliberately not in. */
  async function aliceOnlyHousehold(t: Harness) {
    await signUp(t, asAlice)
    await signUp(t, asBob)
    await t
      .withIdentity(asAlice)
      .mutation(api.groups.createGroup, { name: 'Jansen Household' })
    return 'jansen-household'
  }

  test('gives a member their Group and their role in it', async () => {
    const t = testConvex()
    const groupId = await household(t)

    const asAdmin = await t
      .withIdentity(asAlice)
      .query(api.groups.bySlug, { slug: 'jansen-household' })
    const asPlainMember = await t
      .withIdentity(asBob)
      .query(api.groups.bySlug, { slug: 'jansen-household' })

    expect(asAdmin).toMatchObject({
      ok: true,
      group: { _id: groupId, name: 'Jansen Household', isPersonal: false },
      role: 'admin',
    })
    expect(asPlainMember).toMatchObject({ ok: true, role: 'member' })
  })

  test('resolves a Personal group like any other', async () => {
    const t = testConvex()
    await signUp(t, asAlice)

    const result = await t
      .withIdentity(asAlice)
      .query(api.groups.bySlug, { slug: 'me-alice' })

    expect(result).toMatchObject({
      ok: true,
      group: { slug: 'me-alice', isPersonal: true },
      role: 'admin',
    })
  })

  test('refuses a Group you are not in', async () => {
    const t = testConvex()
    const slug = await aliceOnlyHousehold(t)

    expect(
      await t.withIdentity(asBob).query(api.groups.bySlug, { slug }),
    ).toEqual({ ok: false, reason: 'not-a-member' })
  })

  test('says an unknown slug is unknown, to member and stranger alike', async () => {
    const t = testConvex()
    await aliceOnlyHousehold(t)

    for (const identity of [asAlice, asBob]) {
      expect(
        await t
          .withIdentity(identity)
          .query(api.groups.bySlug, { slug: 'no-such-household' }),
      ).toEqual({ ok: false, reason: 'unknown-slug' })
    }
  })

  test('tells a refusal apart from a slug that does not exist', async () => {
    const t = testConvex()
    const slug = await aliceOnlyHousehold(t)
    const bob = t.withIdentity(asBob)

    const refused = await bob.query(api.groups.bySlug, { slug })
    const unknown = await bob.query(api.groups.bySlug, { slug: 'nonsense' })

    expect(refused).not.toEqual(unknown)
    expect(refused.ok).toBe(false)
    expect(unknown.ok).toBe(false)
  })

  test('refuses a signed-out caller', async () => {
    const t = testConvex()
    const slug = await aliceOnlyHousehold(t)

    expect(await t.query(api.groups.bySlug, { slug })).toEqual({
      ok: false,
      reason: 'not-signed-in',
    })
  })

  test('never hands back a Group you do belong to instead', async () => {
    const t = testConvex()
    const slug = await aliceOnlyHousehold(t)

    // Bob has a Personal group of his own; asking for Alice's must not quietly
    // fall back to it, or the URL stops meaning what it says.
    const result = await t.withIdentity(asBob).query(api.groups.bySlug, { slug })

    expect(result.ok).toBe(false)
    expect(JSON.stringify(result)).not.toContain('me-bob')
  })

  test('the throwing form refuses each case with its own message', async () => {
    const t = testConvex()
    const slug = await aliceOnlyHousehold(t)
    const bob = t.withIdentity(asBob)

    const resolved = await bob.query(async (ctx) =>
      requireGroupBySlug(ctx, 'me-bob'),
    )
    expect(resolved.group.slug).toBe('me-bob')
    expect(resolved.role).toBe('admin')

    const refusal = await bob
      .query(async (ctx) => requireGroupBySlug(ctx, slug))
      .catch((err: Error) => err.message)
    const unknown = await bob
      .query(async (ctx) => requireGroupBySlug(ctx, 'nonsense'))
      .catch((err: Error) => err.message)
    const signedOut = await t
      .query(async (ctx) => requireGroupBySlug(ctx, slug))
      .catch((err: Error) => err.message)

    expect(new Set([refusal, unknown, signedOut]).size).toBe(3)
  })
})
