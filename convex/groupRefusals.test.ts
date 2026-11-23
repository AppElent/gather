import { readGroupRefusal, refusalSentence } from '@gather/core/refusals'
import { describe, expect, test } from 'vitest'
import {
  alice,
  carol,
  seedGroup,
  seedMember,
  testConvex,
} from '../test/convexHarness'
import { api } from './_generated/api'

/**
 * A refused Group is keyed (APP-429): `{ kind: 'groups:<reason>', message }`.
 * Clients read the reason by kind, and the `message` keeps the sentence these
 * refusals threw before, for readers with no wording of their own.
 *
 * One test per kind, through real functions: a query and an action that name a
 * Group by slug, and a mutation that names it by id.
 */

async function seed() {
  const t = testConvex()
  const ids = await t.run(async (ctx) => {
    const aliceId = await ctx.db.insert('users', {
      clerkId: alice.subject,
      name: alice.name,
      email: alice.email,
    })
    const carolId = await ctx.db.insert('users', {
      clerkId: carol.subject,
      name: carol.name,
      email: carol.email,
    })
    const home = await seedGroup(ctx, { name: 'Home', slug: 'home' })
    await seedMember(ctx, home, aliceId, 'admin')
    return { home, aliceId, carolId }
  })
  return { t, ...ids }
}

/** The error a call rejected with, so its kind and data can be read. */
async function refusalOf(call: Promise<unknown>): Promise<unknown> {
  try {
    await call
  } catch (error) {
    return error
  }
  throw new Error('expected the call to be refused')
}

describe('a refused Group is keyed', () => {
  test('not-a-member: the Group exists and the caller is not in it', async () => {
    const { t } = await seed()
    const error = await refusalOf(
      t.withIdentity(carol).query(api.mealPreferences.get, { groupSlug: 'home' }),
    )
    expect(readGroupRefusal(error)).toBe('not-a-member')
    expect(refusalSentence(error)).toBe('Not a member of that group')
  })

  test('unknown-slug: no Group has that slug', async () => {
    const { t } = await seed()
    const error = await refusalOf(
      t.withIdentity(alice).query(api.mealPreferences.get, { groupSlug: 'nope' }),
    )
    expect(readGroupRefusal(error)).toBe('unknown-slug')
    expect(refusalSentence(error)).toBe('No group has that slug')
  })

  test('not-signed-in: no caller at all', async () => {
    const { t } = await seed()
    const error = await refusalOf(
      t.query(api.mealPreferences.get, { groupSlug: 'home' }),
    )
    expect(readGroupRefusal(error)).toBe('not-signed-in')
    expect(refusalSentence(error)).toBe('Not authenticated')
  })

  test('not-signed-in: an identity with no Gather account yet', async () => {
    const { t } = await seed()
    const stranger = { subject: 'clerk_nobody', name: 'Nobody' }
    const error = await refusalOf(
      t
        .withIdentity(stranger)
        .query(api.mealPreferences.get, { groupSlug: 'home' }),
    )
    expect(readGroupRefusal(error)).toBe('not-signed-in')
  })

  test('a mutation that names the Group by id refuses a non-member the same way', async () => {
    const { t, home } = await seed()
    const error = await refusalOf(
      t
        .withIdentity(carol)
        .mutation(api.groups.renameGroup, { groupId: home, name: 'Mine' }),
    )
    expect(readGroupRefusal(error)).toBe('not-a-member')
    expect(refusalSentence(error)).toBe('Not a member of that group')
  })

  test('unknown-group: a mutation names a Group id that no longer exists (APP-581)', async () => {
    const { t, home } = await seed()
    await t.run(async (ctx) => {
      await ctx.db.delete(home)
    })
    const error = await refusalOf(
      t
        .withIdentity(alice)
        .mutation(api.groups.renameGroup, { groupId: home, name: 'Mine' }),
    )
    expect(readGroupRefusal(error)).toBe('unknown-group')
    expect(refusalSentence(error)).toBe('Group not found')
  })

  test('an action refuses with the same kinds as the query it asks', async () => {
    const { t } = await seed()
    const strangerError = await refusalOf(
      t.withIdentity(carol).action(api.recipeImport.importFromUrl, {
        url: 'https://example.com/recipe',
        groupSlug: 'home',
      }),
    )
    expect(readGroupRefusal(strangerError)).toBe('not-a-member')

    const typoError = await refusalOf(
      t.withIdentity(alice).action(api.recipeImport.importFromUrl, {
        url: 'https://example.com/recipe',
        groupSlug: 'nope',
      }),
    )
    expect(readGroupRefusal(typoError)).toBe('unknown-slug')
  })
})

/**
 * The sign-in helpers (`requireCurrentUser`, `requireIdentity`) throw the same
 * keyed refusal as a Group's door (APP-581), outside any Group.
 */
describe('a signed-out caller is refused with a key', () => {
  test('requireCurrentUser: a mutation with no caller', async () => {
    const { t, home } = await seed()
    const error = await refusalOf(
      t.mutation(api.groups.renameGroup, { groupId: home, name: 'Mine' }),
    )
    expect(readGroupRefusal(error)).toBe('not-signed-in')
    expect(refusalSentence(error)).toBe('Not authenticated')
  })

  test('requireCurrentUser: an identity with no Gather account yet', async () => {
    const { t, home } = await seed()
    const stranger = { subject: 'clerk_nobody', name: 'Nobody' }
    const error = await refusalOf(
      t
        .withIdentity(stranger)
        .mutation(api.groups.renameGroup, { groupId: home, name: 'Mine' }),
    )
    expect(readGroupRefusal(error)).toBe('not-signed-in')
    expect(refusalSentence(error)).toBe('Not authenticated')
  })

  test('requireIdentity: provisioning the account with no caller', async () => {
    const { t } = await seed()
    const error = await refusalOf(t.mutation(api.users.ensureUser, {}))
    expect(readGroupRefusal(error)).toBe('not-signed-in')
    expect(refusalSentence(error)).toBe('Not authenticated')
  })
})
