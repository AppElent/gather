import { describe, expect, test } from 'vitest'
import { testConvex } from '../test/convexHarness'
import { api } from './_generated/api'

/**
 * A child's log, read and written by the household that shares it.
 *
 * `babyEvents` carry no `groupId` — they hang off the child — so the Group is
 * checked once, on the baby, and the whole log follows from that. These tests
 * state the three things that has to mean:
 *
 * - both parents in a Group read the same child and log entries for it, and
 *   every entry records who logged it;
 * - someone in another Group reaches none of it, by any of the five entry
 *   points;
 * - being in the child's Group is not enough if you ask under a *different*
 *   Group's slug — the address has to be telling the truth.
 */

const alice = { subject: 'clerk_alice', name: 'Alice', email: 'a@example.com' }
const bob = { subject: 'clerk_bob', name: 'Bob', email: 'b@example.com' }
const carla = { subject: 'clerk_carla', name: 'Carla', email: 'c@example.com' }

const JANSEN = 'jansen-household'
const DE_VRIES = 'de-vries-household'

/**
 * One household with two parents in it, one child, and a second household with
 * a stranger — plus a Personal group for Alice, which is an ordinary Group with
 * one Member and is what a "different Group's slug" means for someone who *is*
 * in the child's household.
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
      slug: 'me-alice',
      isPersonal: true,
      inviteCode: 'me-alice-code',
    })

    for (const [groupId, userId, role] of [
      [jansen, aliceId, 'admin'],
      [jansen, bobId, 'member'],
      [devries, carlaId, 'admin'],
      [aliceAlone, aliceId, 'admin'],
    ] as const) {
      await ctx.db.insert('memberships', { groupId, userId, role })
    }

    const noor = await ctx.db.insert('babies', {
      groupId: jansen,
      name: 'Noor',
      birthDate: '2026-01-05',
      order: 0,
    })

    return { aliceId, bobId, jansen, noor }
  })

  return { t, ...ids }
}

const feed = (timestamp: number) => ({
  type: 'feeding' as const,
  timestamp,
  data: { method: 'bottle' as const, amountMl: 90 },
})

describe('both parents keep one log for one child', () => {
  test('each logs an entry and each entry records who logged it', async () => {
    const { t, noor, aliceId, bobId } = await seed()

    await t.withIdentity(alice).mutation(api.babyEvents.add, {
      babyId: noor,
      groupSlug: JANSEN,
      ...feed(1_760_000_000_000),
    })
    await t.withIdentity(bob).mutation(api.babyEvents.add, {
      babyId: noor,
      groupSlug: JANSEN,
      ...feed(1_760_003_600_000),
    })

    // Either parent sees both entries — the log belongs to the Group, not to
    // whoever typed each one in.
    for (const identity of [alice, bob]) {
      const events = await t
        .withIdentity(identity)
        .query(api.babyEvents.listByBaby, { babyId: noor, groupSlug: JANSEN })
      expect(events.map((e) => e.loggedBy)).toEqual([bobId, aliceId])
    }
  })

  test('one parent may edit and delete what the other logged', async () => {
    const { t, noor, aliceId } = await seed()
    const eventId = await t.withIdentity(alice).mutation(api.babyEvents.add, {
      babyId: noor,
      groupSlug: JANSEN,
      ...feed(1_760_000_000_000),
    })

    await t.withIdentity(bob).mutation(api.babyEvents.update, {
      eventId,
      groupSlug: JANSEN,
      timestamp: 1_760_000_060_000,
      data: { method: 'bottle', amountMl: 120 },
    })

    const [edited] = await t
      .withIdentity(alice)
      .query(api.babyEvents.listByBaby, { babyId: noor, groupSlug: JANSEN })
    expect(edited.data).toMatchObject({ amountMl: 120 })
    // Attribution records *who* first logged it and is not rewritten by an
    // edit; it grants nothing either way (ADR-0003).
    expect(edited.loggedBy).toBe(aliceId)

    await t
      .withIdentity(bob)
      .mutation(api.babyEvents.remove, { eventId, groupSlug: JANSEN })
    const after = await t
      .withIdentity(alice)
      .query(api.babyEvents.listByBaby, { babyId: noor, groupSlug: JANSEN })
    expect(after).toEqual([])
  })
})

describe('someone in another Group reaches none of it', () => {
  test('every entry point refuses', async () => {
    const { t, noor } = await seed()
    const eventId = await t.withIdentity(alice).mutation(api.babyEvents.add, {
      babyId: noor,
      groupSlug: JANSEN,
      ...feed(1_760_000_000_000),
    })
    const outsider = t.withIdentity(carla)

    // The Group in the address is not hers, so all five say so.
    await expect(
      outsider.query(api.babies.list, { groupSlug: JANSEN }),
    ).rejects.toThrow(/Not a member/)
    await expect(
      outsider.query(api.babies.get, { id: noor, groupSlug: JANSEN }),
    ).rejects.toThrow(/Not a member/)
    await expect(
      outsider.query(api.babyEvents.listByBaby, {
        babyId: noor,
        groupSlug: JANSEN,
      }),
    ).rejects.toThrow(/Not a member/)
    await expect(
      outsider.mutation(api.babyEvents.add, {
        babyId: noor,
        groupSlug: JANSEN,
        ...feed(1_760_007_200_000),
      }),
    ).rejects.toThrow(/Not a member/)
    await expect(
      outsider.mutation(api.babyEvents.update, {
        eventId,
        groupSlug: JANSEN,
        timestamp: 1,
        data: { method: 'bottle', amountMl: 1 },
      }),
    ).rejects.toThrow(/Not a member/)
    await expect(
      outsider.mutation(api.babyEvents.remove, { eventId, groupSlug: JANSEN }),
    ).rejects.toThrow(/Not a member/)
  })

  test('naming her own Group instead does not reach the child either', async () => {
    const { t, noor } = await seed()

    await expect(
      t.withIdentity(carla).query(api.babyEvents.listByBaby, {
        babyId: noor,
        groupSlug: DE_VRIES,
      }),
    ).rejects.toThrow(/Baby not found/)
  })

  test('a signed-out caller reaches nothing', async () => {
    const { t, noor } = await seed()

    await expect(
      t.query(api.babyEvents.listByBaby, { babyId: noor, groupSlug: JANSEN }),
    ).rejects.toThrow(/Not authenticated/)
  })
})

/**
 * The rule the old caller-wide check could not express: Alice really is in the
 * child's household, and really is a Member of the Group she named — and it is
 * still a refusal, because the child does not live in the Group she named.
 */
describe('a Member of the child Group asking under a different slug', () => {
  test('is refused for reads and for writes alike', async () => {
    const { t, noor } = await seed()
    const eventId = await t.withIdentity(alice).mutation(api.babyEvents.add, {
      babyId: noor,
      groupSlug: JANSEN,
      ...feed(1_760_000_000_000),
    })
    const misaddressed = t.withIdentity(alice)

    expect(
      await misaddressed.query(api.babies.get, {
        id: noor,
        groupSlug: 'me-alice',
      }),
    ).toBeNull()
    await expect(
      misaddressed.query(api.babyEvents.listByBaby, {
        babyId: noor,
        groupSlug: 'me-alice',
      }),
    ).rejects.toThrow(/Baby not found/)
    await expect(
      misaddressed.mutation(api.babyEvents.add, {
        babyId: noor,
        groupSlug: 'me-alice',
        ...feed(1_760_007_200_000),
      }),
    ).rejects.toThrow(/Baby not found/)
    await expect(
      misaddressed.mutation(api.babyEvents.update, {
        eventId,
        groupSlug: 'me-alice',
        timestamp: 1,
        data: { method: 'bottle', amountMl: 1 },
      }),
    ).rejects.toThrow(/Baby not found/)
    await expect(
      misaddressed.mutation(api.babyEvents.remove, {
        eventId,
        groupSlug: 'me-alice',
      }),
    ).rejects.toThrow(/Baby not found/)

    // And the log is still there, untouched by any of that.
    const events = await misaddressed.query(api.babyEvents.listByBaby, {
      babyId: noor,
      groupSlug: JANSEN,
    })
    expect(events).toHaveLength(1)
  })
})
