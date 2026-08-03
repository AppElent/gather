import { describe, expect, test } from 'vitest'
import { testConvex } from '../test/convexHarness'
import { api } from './_generated/api'

/**
 * The Catalog belongs to nobody and reads the same for everybody (CONTEXT.md).
 *
 * Foods is the one live Module with no Group-scoped rule to enforce, and this
 * says so as a fact rather than as a comment: two people who share no Group at
 * all still get the same food, so putting `/foods` under `/g/<slug>/` cannot
 * have narrowed anything. Signing in is the only bar.
 */

const asAlice = { subject: 'clerk_alice', name: 'Alice', email: 'a@example.com' }
const asBob = { subject: 'clerk_bob', name: 'Bob', email: 'b@example.com' }

async function seed() {
  const t = testConvex()
  await t.withIdentity(asAlice).mutation(api.users.ensureUser, {})
  await t.withIdentity(asBob).mutation(api.users.ensureUser, {})

  const hagelslag = await t.withIdentity(asAlice).mutation(api.foods.create, {
    name: 'Hagelslag',
    baseUnit: 'g',
    nutritionPer100: { calories: 500 },
  })

  return { t, hagelslag }
}

describe('the food Catalog', () => {
  test('reads the same for two people who share no group', async () => {
    const { t, hagelslag } = await seed()

    const forAlice = await t
      .withIdentity(asAlice)
      .query(api.foods.get, { id: hagelslag })
    const forBob = await t
      .withIdentity(asBob)
      .query(api.foods.get, { id: hagelslag })

    expect(forAlice?.name).toBe('Hagelslag')
    expect(forBob).toEqual(forAlice)
  })

  test('is searchable by anyone signed in', async () => {
    const { t } = await seed()

    const results = await t
      .withIdentity(asBob)
      .query(api.foods.search, { term: 'hagelslag' })

    expect(results.map((f) => f.name)).toEqual(['Hagelslag'])
  })

  test('is not readable at all without a session', async () => {
    const { t, hagelslag } = await seed()

    expect(await t.query(api.foods.get, { id: hagelslag })).toBeNull()
    expect(await t.query(api.foods.search, { term: 'hagelslag' })).toEqual([])
  })
})
