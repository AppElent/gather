import { describe, expect, test } from 'vitest'
import { testConvex } from '../test/convexHarness'
import { api } from './_generated/api'

/**
 * Who can read which household's baby log, asserted through the real queries.
 *
 * The baby log is Group-scoped content, so `/g/<slug>/baby` has two things to
 * get right and they are genuinely different: the caller must be a Member of
 * the Group in the URL, *and* the child in the URL must live in that Group. The
 * second is the one a route gate alone cannot give you — a person in two Groups
 * passes the gate for both, and without this check `/g/a/baby/<child-of-b>`
 * would happily render b's child under a's address.
 */

const alice = { subject: 'clerk_alice', name: 'Alice', email: 'a@example.com' }
const bob = { subject: 'clerk_bob', name: 'Bob', email: 'b@example.com' }

/**
 * Two households. Alice is in both, Bob only in the second — so "not a member"
 * and "member, wrong Group" can be told apart.
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

    await ctx.db.insert('memberships', {
      groupId: jansen,
      userId: aliceId,
      role: 'admin',
    })
    await ctx.db.insert('memberships', {
      groupId: devries,
      userId: aliceId,
      role: 'member',
    })
    await ctx.db.insert('memberships', {
      groupId: devries,
      userId: bobId,
      role: 'admin',
    })

    const noor = await ctx.db.insert('babies', {
      groupId: jansen,
      name: 'Noor',
      birthDate: '2026-01-05',
      order: 0,
    })
    const sam = await ctx.db.insert('babies', {
      groupId: devries,
      name: 'Sam',
      birthDate: '2025-11-20',
      order: 0,
    })

    return { jansen, devries, noor, sam }
  })

  return { t, ...ids }
}

describe('reading a household log through its Group', () => {
  test('a Member sees the children of the Group they asked for', async () => {
    const { t } = await seed()

    const jansen = await t
      .withIdentity(alice)
      .query(api.babies.list, { groupSlug: 'jansen-household' })
    const devries = await t
      .withIdentity(alice)
      .query(api.babies.list, { groupSlug: 'de-vries-household' })

    expect(jansen.map((b) => b.name)).toEqual(['Noor'])
    expect(devries.map((b) => b.name)).toEqual(['Sam'])
  })

  test('someone outside the Group is refused, not given an empty log', async () => {
    const { t } = await seed()

    await expect(
      t
        .withIdentity(bob)
        .query(api.babies.list, { groupSlug: 'jansen-household' }),
    ).rejects.toThrow(/Not a member/)
  })

  test('a slug nobody owns is refused as unknown, not as forbidden', async () => {
    const { t } = await seed()

    await expect(
      t.withIdentity(alice).query(api.babies.list, { groupSlug: 'no-such' }),
    ).rejects.toThrow(/No group has that slug/)
  })

  test('a signed-out caller gets nothing at all', async () => {
    const { t } = await seed()

    await expect(
      t.query(api.babies.list, { groupSlug: 'jansen-household' }),
    ).rejects.toThrow(/Not authenticated/)
  })
})

describe('a deep link to one child', () => {
  test('resolves when the child really is in that Group', async () => {
    const { t, noor } = await seed()

    const baby = await t
      .withIdentity(alice)
      .query(api.babies.get, { id: noor, groupSlug: 'jansen-household' })

    expect(baby?.name).toBe('Noor')
  })

  // Alice is a Member of both households, so the gate lets her onto either
  // address. That is exactly why the child has to be checked against the Group
  // as well: passing the gate is not the same as the URL telling the truth.
  test('does not resolve a child from a different Group of your own', async () => {
    const { t, sam } = await seed()

    const baby = await t
      .withIdentity(alice)
      .query(api.babies.get, { id: sam, groupSlug: 'jansen-household' })

    expect(baby).toBeNull()
  })

  test('is refused outright for a Group you are not in', async () => {
    const { t, noor } = await seed()

    await expect(
      t
        .withIdentity(bob)
        .query(api.babies.get, { id: noor, groupSlug: 'jansen-household' }),
    ).rejects.toThrow(/Not a member/)
  })
})

describe('adding a child from inside a Group', () => {
  test('puts them in the Group the URL named', async () => {
    const { t } = await seed()

    await t.withIdentity(alice).mutation(api.babies.create, {
      name: 'Pim',
      birthDate: '2026-06-01',
      groupSlug: 'de-vries-household',
    })

    const devries = await t
      .withIdentity(alice)
      .query(api.babies.list, { groupSlug: 'de-vries-household' })
    const jansen = await t
      .withIdentity(alice)
      .query(api.babies.list, { groupSlug: 'jansen-household' })

    expect(devries.map((b) => b.name)).toEqual(['Sam', 'Pim'])
    expect(jansen.map((b) => b.name)).toEqual(['Noor'])
  })

  test('is refused for a Group you are not a Member of', async () => {
    const { t } = await seed()

    await expect(
      t.withIdentity(bob).mutation(api.babies.create, {
        name: 'Pim',
        birthDate: '2026-06-01',
        groupSlug: 'jansen-household',
      }),
    ).rejects.toThrow(/Not a member/)
  })
})

/**
 * Editing a child is authorised the same way reading one is: from the Group in
 * the address. Alice is in both households, so "she can see this child from
 * somewhere" and "this child is in the Group she named" come apart here.
 */
describe('editing a child under the wrong Group', () => {
  test('is refused even when the caller can see that child elsewhere', async () => {
    const { t, sam } = await seed()

    await expect(
      t.withIdentity(alice).mutation(api.babies.update, {
        id: sam,
        groupSlug: 'jansen-household',
        name: 'Renamed',
        birthDate: '2025-11-20',
      }),
    ).rejects.toThrow(/Baby not found/)

    const unchanged = await t
      .withIdentity(alice)
      .query(api.babies.get, { id: sam, groupSlug: 'de-vries-household' })
    expect(unchanged?.name).toBe('Sam')
  })

  test('deleting is refused the same way', async () => {
    const { t, sam } = await seed()

    await expect(
      t
        .withIdentity(alice)
        .mutation(api.babies.remove, { id: sam, groupSlug: 'jansen-household' }),
    ).rejects.toThrow(/Baby not found/)

    const still = await t
      .withIdentity(alice)
      .query(api.babies.get, { id: sam, groupSlug: 'de-vries-household' })
    expect(still?.name).toBe('Sam')
  })

  test("a child's checklist cannot be created from another Group's address", async () => {
    const { t, sam } = await seed()

    await expect(
      t.withIdentity(alice).mutation(api.babies.ensureTodoList, {
        id: sam,
        groupSlug: 'jansen-household',
      }),
    ).rejects.toThrow(/Baby not found/)
  })
})
