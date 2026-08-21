import { describe, expect, test } from 'vitest'
import { testConvex } from '../test/convexHarness'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { MAX_PINNED_MODULES } from './users'

/**
 * Pins, asserted through the real mutation and the real query.
 *
 * Two rules matter, and a household would notice either being broken. A Pin is
 * one person's — a housemate reordering theirs must not move yours. And since
 * ADR-0005 a Pin is one person's *in one Group*: a wine club and a household
 * are different rooms, and what you want to reach first differs between them.
 *
 * The order is part of the answer, not an implementation detail — it is what
 * the navigation renders.
 */

type Harness = ReturnType<typeof testConvex>

const asAlice = {
  subject: 'clerk_alice',
  name: 'Alice',
  email: 'a@example.com',
}
const asBob = { subject: 'clerk_bob', name: 'Bob', email: 'b@example.com' }

async function signUp(t: Harness, identity: typeof asAlice) {
  await t.withIdentity(identity).mutation(api.users.ensureUser, {})
}

/** The slug of the Personal group `ensureUser` guarantees everybody has. */
async function personalSlug(t: Harness, identity: typeof asAlice) {
  const groups = await t.withIdentity(identity).query(api.groups.myGroups, {})
  const personal = groups.find((g) => g.isPersonal)
  if (!personal) throw new Error('no personal group')
  return personal.slug
}

/**
 * Alice admins a household Bob has joined by invite. Returns its slug.
 * Signs both up itself — `ensureUser` is idempotent, so callers that already
 * did are unaffected.
 */
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
  return group.slug
}

async function setPins(
  t: Harness,
  identity: typeof asAlice,
  groupSlug: string,
  moduleIds: string[],
) {
  await t
    .withIdentity(identity)
    .mutation(api.users.setPins, { groupSlug, moduleIds })
}

async function pinsOf(t: Harness, identity: typeof asAlice, groupSlug: string) {
  return await t.withIdentity(identity).query(api.users.myPins, { groupSlug })
}

describe('my Pins in one Group', () => {
  test('are absent until I choose, so a default can be applied in code', async () => {
    const t = testConvex()
    await signUp(t, asAlice)

    expect(await pinsOf(t, asAlice, await personalSlug(t, asAlice))).toBeNull()
  })

  test('read back in the order I set them', async () => {
    const t = testConvex()
    await signUp(t, asAlice)
    const slug = await personalSlug(t, asAlice)

    await setPins(t, asAlice, slug, ['tasks', 'recipes', 'nutrition'])
    expect(await pinsOf(t, asAlice, slug)).toEqual([
      'tasks',
      'recipes',
      'nutrition',
    ])

    await setPins(t, asAlice, slug, ['nutrition', 'tasks'])
    expect(await pinsOf(t, asAlice, slug)).toEqual(['nutrition', 'tasks'])
  })

  test('can be emptied, which is not the same as never having chosen', async () => {
    const t = testConvex()
    await signUp(t, asAlice)
    const slug = await personalSlug(t, asAlice)

    await setPins(t, asAlice, slug, [])
    expect(await pinsOf(t, asAlice, slug)).toEqual([])
  })

  test('are invisible to every other member of it', async () => {
    const t = testConvex()
    await signUp(t, asAlice)
    await signUp(t, asBob)
    const slug = await household(t)

    await setPins(t, asAlice, slug, ['recipes', 'tasks'])
    await setPins(t, asBob, slug, ['baby-log'])

    expect(await pinsOf(t, asAlice, slug)).toEqual(['recipes', 'tasks'])
    expect(await pinsOf(t, asBob, slug)).toEqual(['baby-log'])
  })

  test('keep the first of a repeated id and no more', async () => {
    const t = testConvex()
    await signUp(t, asAlice)
    const slug = await personalSlug(t, asAlice)

    await setPins(t, asAlice, slug, ['recipes', 'tasks', 'recipes'])
    expect(await pinsOf(t, asAlice, slug)).toEqual(['recipes', 'tasks'])
  })

  test('stop at the cap rather than growing without bound', async () => {
    const t = testConvex()
    await signUp(t, asAlice)
    const slug = await personalSlug(t, asAlice)

    const many = Array.from(
      { length: MAX_PINNED_MODULES + 5 },
      (_, i) => `module-${i}`,
    )
    await setPins(t, asAlice, slug, many)

    expect(await pinsOf(t, asAlice, slug)).toEqual(
      many.slice(0, MAX_PINNED_MODULES),
    )
  })
})

describe('my Pins across Groups', () => {
  test('a wine club and a household keep their own', async () => {
    const t = testConvex()
    await signUp(t, asAlice)
    const home = await household(t)
    const mine = await personalSlug(t, asAlice)

    await setPins(t, asAlice, home, ['recipes', 'tasks'])
    await setPins(t, asAlice, mine, ['nutrition'])

    expect(await pinsOf(t, asAlice, home)).toEqual(['recipes', 'tasks'])
    expect(await pinsOf(t, asAlice, mine)).toEqual(['nutrition'])
  })

  /**
   * The expand half of expand–contract. Pins written before ADR-0005 sit on the
   * user row, and nothing backfilled them onto memberships — so a Group nobody
   * has chosen pins in since must still open with the pins they are used to,
   * rather than with a default that would read as having lost them.
   */
  test('a Group I have not chosen in opens with the ones I had before', async () => {
    const t = testConvex()
    await signUp(t, asAlice)
    const slug = await personalSlug(t, asAlice)

    await t.run(async (ctx) => {
      const user = await ctx.db
        .query('users')
        .withIndex('by_clerkId', (q) => q.eq('clerkId', asAlice.subject))
        .unique()
      if (!user) throw new Error('no user')
      await ctx.db.patch(user._id, { pinnedModuleIds: ['baby-log', 'foods'] })
    })

    expect(await pinsOf(t, asAlice, slug)).toEqual(['baby-log', 'foods'])
  })

  test('and stops falling back the moment I choose there', async () => {
    const t = testConvex()
    await signUp(t, asAlice)
    const mine = await personalSlug(t, asAlice)
    const home = await household(t)

    await t.run(async (ctx) => {
      const user = await ctx.db
        .query('users')
        .withIndex('by_clerkId', (q) => q.eq('clerkId', asAlice.subject))
        .unique()
      if (!user) throw new Error('no user')
      await ctx.db.patch(user._id, { pinnedModuleIds: ['baby-log'] })
    })

    await setPins(t, asAlice, home, ['recipes'])

    expect(await pinsOf(t, asAlice, home)).toEqual(['recipes'])
    // The Group still untouched keeps reading the old list.
    expect(await pinsOf(t, asAlice, mine)).toEqual(['baby-log'])
  })

  /**
   * Pins live on the membership, so they have the lifetime they should: they
   * describe a place, and they stop existing when your access to it does.
   */
  test('leaving a Group takes my pins for it with me', async () => {
    const t = testConvex()
    await signUp(t, asAlice)
    await signUp(t, asBob)
    const slug = await household(t)
    await setPins(t, asBob, slug, ['recipes'])

    const groupId = await t.run(async (ctx) => {
      const group = await ctx.db
        .query('groups')
        .withIndex('by_slug', (q) => q.eq('slug', slug))
        .unique()
      if (!group) throw new Error('no group')
      return group._id
    })
    await t.withIdentity(asBob).mutation(api.groups.leaveGroup, { groupId })

    await expect(pinsOf(t, asBob, slug)).rejects.toThrow()
    // Rejoining is a fresh membership, and a fresh choice to make.
    await t.withIdentity(asBob).mutation(api.groups.joinByInvite, {
      inviteCode: await t.run(async (ctx) => {
        const g = await ctx.db.get(groupId)
        return g?.inviteCode ?? ''
      }),
    })
    expect(await pinsOf(t, asBob, slug)).toBeNull()
  })
})

describe('Pins I have no business setting', () => {
  test('cannot be set by someone who is not signed in', async () => {
    const t = testConvex()
    await signUp(t, asAlice)
    const slug = await personalSlug(t, asAlice)

    await expect(
      t.mutation(api.users.setPins, {
        groupSlug: slug,
        moduleIds: ['recipes'],
      }),
    ).rejects.toThrow()
  })

  test('cannot be set in a Group I am not in', async () => {
    const t = testConvex()
    await signUp(t, asAlice)
    await signUp(t, asBob)
    const mine = await personalSlug(t, asAlice)

    await expect(setPins(t, asBob, mine, ['recipes'])).rejects.toThrow()
  })

  test('cannot be read from a Group I am not in', async () => {
    const t = testConvex()
    await signUp(t, asAlice)
    await signUp(t, asBob)
    const mine = await personalSlug(t, asAlice)

    await setPins(t, asAlice, mine, ['recipes'])

    await expect(pinsOf(t, asBob, mine)).rejects.toThrow()
  })
})
