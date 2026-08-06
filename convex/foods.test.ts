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

/**
 * A brand is what is written largest on the carton, so it is what people type.
 * A search index has one full-text field, so matching it is a fact about the
 * row rather than about the query — see `lib/foodSearchText.ts`.
 */
describe('searching by brand', () => {
  test('finds a food by the brand on its carton', async () => {
    const t = testConvex()
    await t.withIdentity(asAlice).mutation(api.users.ensureUser, {})
    await t.withIdentity(asAlice).mutation(api.foods.create, {
      name: 'Halfvolle melk',
      brand: 'Campina',
      baseUnit: 'ml',
      nutritionPer100: { calories: 46 },
    })

    const results = await t
      .withIdentity(asAlice)
      .query(api.foods.search, { term: 'campina' })

    expect(results.map((f) => f.name)).toEqual(['Halfvolle melk'])
  })

  test('keeps up with a brand that changes', async () => {
    const t = testConvex()
    await t.withIdentity(asAlice).mutation(api.users.ensureUser, {})
    const id = await t.withIdentity(asAlice).mutation(api.foods.create, {
      name: 'Halfvolle melk',
      brand: 'Campina',
      baseUnit: 'ml',
      nutritionPer100: { calories: 46 },
    })

    await t.withIdentity(asAlice).mutation(api.foods.update, {
      id,
      name: 'Halfvolle melk',
      brand: 'Zaanse Hoeve',
      baseUnit: 'ml',
      nutritionPer100: { calories: 46 },
    })

    expect(
      await t.withIdentity(asAlice).query(api.foods.search, { term: 'campina' }),
    ).toEqual([])
    expect(
      (
        await t
          .withIdentity(asAlice)
          .query(api.foods.search, { term: 'zaanse hoeve' })
      ).map((f) => f.name),
    ).toEqual(['Halfvolle melk'])
  })

  test('a food imported from Open Food Facts is searchable by its brand too', async () => {
    const t = testConvex()
    await t.withIdentity(asAlice).mutation(api.users.ensureUser, {})
    await t.withIdentity(asAlice).mutation(api.foods.upsertFromOff, {
      barcode: '3017620422003',
      name: 'Nutella',
      brand: 'Ferrero',
      baseUnit: 'g',
      nutritionPer100: { calories: 539 },
    })

    const results = await t
      .withIdentity(asAlice)
      .query(api.foods.search, { term: 'ferrero' })

    expect(results.map((f) => f.name)).toEqual(['Nutella'])
  })
})
