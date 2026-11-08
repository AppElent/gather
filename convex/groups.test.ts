import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { alice as asAlice, bob as asBob, carol as asCarol, testConvex } from '../test/convexHarness'
import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { requireGroupBySlug } from './lib/groupAccess'
import { RESERVED_SLUGS } from './lib/slugs'

/**
 * What a person can see and do with Groups, asserted through the real queries
 * and mutations: every Group has a slug no other Group holds, and a Group can't
 * be left without an admin.
 */

type Harness = ReturnType<typeof testConvex>


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

describe('a new user', () => {
  test('has no Group until they create or join one', async () => {
    const t = testConvex()
    await signUp(t, asAlice)
    await signUp(t, asAlice)

    expect(await groupsOf(t, asAlice)).toEqual([])
  })
})

describe('Group appearance', () => {
  test('an admin can save an icon', async () => {
    const t = testConvex()
    await signUp(t, asAlice)
    const groupId = await t
      .withIdentity(asAlice)
      .mutation(api.groups.createGroup, { name: 'Jansen Household' })

    await t
      .withIdentity(asAlice)
      .mutation(api.groups.updateAppearance, { groupId, icon: 'House' })

    expect(await groupsOf(t, asAlice)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ _id: groupId, icon: 'House' }),
      ]),
    )
  })

  test('a member cannot change the Group appearance', async () => {
    const t = testConvex()
    await signUp(t, asAlice)
    await signUp(t, asBob)
    const groupId = await t
      .withIdentity(asAlice)
      .mutation(api.groups.createGroup, { name: 'Jansen Household' })
    const group = await t.run(async (ctx) => await ctx.db.get(groupId))
    if (!group) throw new Error('group was not created')
    await t
      .withIdentity(asBob)
      .mutation(api.groups.joinByInvite, { inviteCode: group.inviteCode })

    await expect(
      t
        .withIdentity(asBob)
        .mutation(api.groups.updateAppearance, { groupId, icon: 'Heart' }),
    ).rejects.toThrow(/admin/i)
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
    expect(slugs).toHaveLength(3)
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

  test('escapes a name out of the `me-` prefix', async () => {
    const t = testConvex()
    await signUp(t, asAlice)
    await t
      .withIdentity(asAlice)
      .mutation(api.groups.createGroup, { name: 'Me and Bob' })

    expect((await groupsOf(t, asAlice))[0].slug).toBe('g-me-and-bob')
  })

  test('does not reserve a name for a later account', async () => {
    const t = testConvex()
    await signUp(t, asBob)
    await t
      .withIdentity(asBob)
      .mutation(api.groups.createGroup, { name: 'Alice' })

    await signUp(t, asAlice)

    const household = (await groupsOf(t, asBob))[0]
    expect(household?.slug).toBe('alice')
    expect(await groupsOf(t, asAlice)).toEqual([])
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

  /**
   * The renamer cannot work the new slug out for itself — `allocateGroupSlug`
   * resolves collisions — so it has to be told.
   */
  test('hands back the slug it moved to, so the renamer can follow', async () => {
    const t = testConvex()
    const groupId = await household(t)

    const slug = await t
      .withIdentity(asAlice)
      .mutation(api.groups.renameGroup, { groupId, name: 'Wine club' })

    expect(slug).toBe('wine-club')
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

  /**
   * The code is a capability: whoever holds it can join. It is deliberately
   * absent from `bySlug` and `members`, so the settings page asks for it by
   * name — and that request is authorised like every other Group-scoped read,
   * from the slug the caller named.
   */
  test('hands its invite code to any member who asks for it', async () => {
    const t = testConvex()
    const groupId = await household(t)
    const group = await t.run(async (ctx) => await ctx.db.get(groupId))

    const asked = await t
      .withIdentity(asBob)
      .query(api.groups.inviteCode, { slug: group?.slug ?? '' })

    expect(asked).toBe(group?.inviteCode)
  })

  test('does not hand its invite code to somebody outside it', async () => {
    const t = testConvex()
    const groupId = await household(t)
    const group = await t.run(async (ctx) => await ctx.db.get(groupId))
    await signUp(t, asCarol)

    await expect(
      t
        .withIdentity(asCarol)
        .query(api.groups.inviteCode, { slug: group?.slug ?? '' }),
    ).rejects.toThrow()
  })

  test('can be left, and then its content is no longer yours to see', async () => {
    const t = testConvex()
    const groupId = await household(t)

    await t.withIdentity(asBob).mutation(api.groups.leaveGroup, { groupId })

    expect((await groupsOf(t, asBob)).map((g) => g._id)).not.toContain(groupId)
    // Leaving is one person's decision: Alice still has the Group.
    expect((await groupsOf(t, asAlice)).map((g) => g._id)).toContain(groupId)
  })

  test('takes the leaver out of the costs they were part of', async () => {
    const t = testConvex()
    const groupId = await household(t)
    const { alice, bob } = await t.run(async (ctx) => {
      const users = await ctx.db.query('users').collect()
      const idOf = (subject: string) =>
        users.find((u) => u.clerkId === subject)?._id as Id<'users'>
      return { alice: idOf(asAlice.subject), bob: idOf(asBob.subject) }
    })
    const { costId, scenarioId } = await t.run(async (ctx) => ({
      costId: await ctx.db.insert('recurringCosts', {
        groupId,
        createdByUserId: alice,
        order: 0,
        name: 'Energy',
        amountCents: 4500,
        frequency: 'monthly',
        category: 'utilities',
        split: [
          { userId: alice, percent: 50 },
          { userId: bob, percent: 50 },
        ],
      }),
      scenarioId: await ctx.db.insert('splitScenarios', {
        groupId,
        createdByUserId: alice,
        createdAt: 0,
        name: 'Holiday',
        payments: [{ party: { userId: bob, name: 'Bob' }, amountCents: 100 }],
        participants: [
          { userId: alice, name: 'Alice' },
          { userId: bob, name: 'Bob' },
        ],
        mode: 'equal',
        owed: [],
        transfers: [],
        totalCents: 100,
      }),
    }))

    await t.withIdentity(asBob).mutation(api.groups.leaveGroup, { groupId })

    const { cost, scenario } = await t.run(async (ctx) => ({
      cost: await ctx.db.get(costId),
      scenario: await ctx.db.get(scenarioId),
    }))
    expect(cost?.split).toBeUndefined()
    expect(scenario?.payments[0]?.party).toEqual({ name: 'Bob' })
    expect(scenario?.participants).toEqual([
      { userId: alice, name: 'Alice' },
      { name: 'Bob' },
    ])
  })

  /**
   * A Group whose last admin walks out cannot be renamed, deleted or handed on
   * by anyone left standing in it, and nothing short of database repair puts
   * that right. The leave button on the settings page made that reachable, so
   * the door is held instead.
   */
  test('cannot be left by its only admin while anyone else is still in it', async () => {
    const t = testConvex()
    const groupId = await household(t)

    await expect(
      t.withIdentity(asAlice).mutation(api.groups.leaveGroup, { groupId }),
    ).rejects.toThrow(/only admin/i)

    expect((await groupsOf(t, asAlice)).map((g) => g._id)).toContain(groupId)
  })

  test('can be left by its last admin once nobody else is in it', async () => {
    const t = testConvex()
    const groupId = await household(t)

    await t.withIdentity(asBob).mutation(api.groups.leaveGroup, { groupId })
    await t.withIdentity(asAlice).mutation(api.groups.leaveGroup, { groupId })

    expect((await groupsOf(t, asAlice)).map((g) => g._id)).not.toContain(
      groupId,
    )
  })

  test('can be left by its only admin once somebody else is one too', async () => {
    const t = testConvex()
    const groupId = await household(t)
    const bob = await t.withIdentity(asBob).query(api.users.me, {})

    await t.withIdentity(asAlice).mutation(api.groups.setMemberRole, {
      groupId,
      userId: bob?._id ?? ('' as never),
      role: 'admin',
    })
    await t.withIdentity(asAlice).mutation(api.groups.leaveGroup, { groupId })

    expect((await groupsOf(t, asAlice)).map((g) => g._id)).not.toContain(
      groupId,
    )
    expect((await groupsOf(t, asBob)).map((g) => g._id)).toContain(groupId)
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

  test('hands the admin role over, and takes it back', async () => {
    const t = testConvex()
    const groupId = await household(t)
    const bob = await t.withIdentity(asBob).query(api.users.me, {})
    const bobId = bob?._id ?? ('' as never)

    await t.withIdentity(asAlice).mutation(api.groups.setMemberRole, {
      groupId,
      userId: bobId,
      role: 'admin',
    })
    // Bob can now do an admin's work, which is the whole point of the handover.
    await t
      .withIdentity(asBob)
      .mutation(api.groups.renameGroup, { groupId, name: 'Bob club' })

    await t.withIdentity(asBob).mutation(api.groups.setMemberRole, {
      groupId,
      userId: bobId,
      role: 'member',
    })
    await expect(
      t
        .withIdentity(asBob)
        .mutation(api.groups.renameGroup, { groupId, name: 'Again' }),
    ).rejects.toThrow(/admin/i)
  })

  test('will not let its last admin demote themselves either', async () => {
    const t = testConvex()
    const groupId = await household(t)
    const alice = await t.withIdentity(asAlice).query(api.users.me, {})

    await expect(
      t.withIdentity(asAlice).mutation(api.groups.setMemberRole, {
        groupId,
        userId: alice?._id ?? ('' as never),
        role: 'member',
      }),
    ).rejects.toThrow(/somebody else an admin/i)
  })

  test('does not let a plain member appoint themselves', async () => {
    const t = testConvex()
    const groupId = await household(t)
    const bob = await t.withIdentity(asBob).query(api.users.me, {})

    await expect(
      t.withIdentity(asBob).mutation(api.groups.setMemberRole, {
        groupId,
        userId: bob?._id ?? ('' as never),
        role: 'admin',
      }),
    ).rejects.toThrow(/only an admin/i)
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

    expect((await groupsOf(t, asAlice)).map((g) => g._id)).not.toContain(
      groupId,
    )
  })

  describe('with stored files', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    test('releases its own image when it is deleted', async () => {
      const t = testConvex()
      const groupId = await household(t)
      await t.withIdentity(asBob).mutation(api.groups.leaveGroup, { groupId })
      const imageId = await t.run(async (ctx) => {
        const stored = await ctx.storage.store(new Blob(['jpeg']))
        await ctx.db.patch(groupId, { imageId: stored })
        return stored
      })

      await t
        .withIdentity(asAlice)
        .mutation(api.groups.deleteGroup, { groupId })
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      const stored = await t.run(
        async (ctx) => await ctx.storage.getUrl(imageId),
      )
      expect(stored).toBeNull()
    })
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
 * Resolving a Group from the slug the caller names. This is the check every
 * Group-scoped function goes through, so what matters is not only that
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
      .query(internal.groups.bySlug, { slug: 'jansen-household' })
    const asPlainMember = await t
      .withIdentity(asBob)
      .query(internal.groups.bySlug, { slug: 'jansen-household' })

    expect(asAdmin).toMatchObject({
      ok: true,
      group: { _id: groupId, name: 'Jansen Household' },
      role: 'admin',
    })
    expect(asPlainMember).toMatchObject({ ok: true, role: 'member' })
  })

  test('resolves a single-member Group like any other', async () => {
    const t = testConvex()
    await signUp(t, asAlice)
    await t
      .withIdentity(asAlice)
      .mutation(api.groups.createGroup, { name: 'Alice' })

    const result = await t
      .withIdentity(asAlice)
      .query(internal.groups.bySlug, { slug: 'alice' })

    expect(result).toMatchObject({
      ok: true,
      group: { slug: 'alice' },
      role: 'admin',
    })
  })

  test('refuses a Group you are not in', async () => {
    const t = testConvex()
    const slug = await aliceOnlyHousehold(t)

    expect(
      await t.withIdentity(asBob).query(internal.groups.bySlug, { slug }),
    ).toEqual({ ok: false, reason: 'not-a-member' })
  })

  test('says an unknown slug is unknown, to member and stranger alike', async () => {
    const t = testConvex()
    await aliceOnlyHousehold(t)

    for (const identity of [asAlice, asBob]) {
      expect(
        await t
          .withIdentity(identity)
          .query(internal.groups.bySlug, { slug: 'no-such-household' }),
      ).toEqual({ ok: false, reason: 'unknown-slug' })
    }
  })

  test('tells a refusal apart from a slug that does not exist', async () => {
    const t = testConvex()
    const slug = await aliceOnlyHousehold(t)
    const bob = t.withIdentity(asBob)

    const refused = await bob.query(internal.groups.bySlug, { slug })
    const unknown = await bob.query(internal.groups.bySlug, { slug: 'nonsense' })

    expect(refused).not.toEqual(unknown)
    expect(refused.ok).toBe(false)
    expect(unknown.ok).toBe(false)
  })

  test('refuses a signed-out caller', async () => {
    const t = testConvex()
    const slug = await aliceOnlyHousehold(t)

    expect(await t.query(internal.groups.bySlug, { slug })).toEqual({
      ok: false,
      reason: 'not-signed-in',
    })
  })

  test('never hands back a Group you do belong to instead', async () => {
    const t = testConvex()
    const slug = await aliceOnlyHousehold(t)

    // Asking for Alice's must not quietly fall back to another Group.
    const result = await t
      .withIdentity(asBob)
      .query(internal.groups.bySlug, { slug })

    expect(result.ok).toBe(false)
    expect(JSON.stringify(result)).not.toContain('jansen-household')
  })

  test('the throwing form refuses each case with its own message', async () => {
    const t = testConvex()
    const slug = await aliceOnlyHousehold(t)
    const bob = t.withIdentity(asBob)
    await signUp(t, asBob)
    await bob.mutation(api.groups.createGroup, { name: 'Bob' })

    const resolved = await bob.query(async (ctx) =>
      requireGroupBySlug(ctx, 'bob'),
    )
    expect(resolved.group.slug).toBe('bob')
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
