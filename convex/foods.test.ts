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

/**
 * A picture arrives with an import, is kept with the food so it no longer
 * depends on Open Food Facts' servers, and goes when the last row holding it
 * lets go (#69, ADR-0010's open door).
 */
describe('a food’s picture', () => {
  async function storedImage(t: ReturnType<typeof testConvex>, body: string) {
    return await t.run(async (ctx) => ctx.storage.store(new Blob([body])))
  }

  test('an imported picture is kept with the food and handed back as a URL', async () => {
    const t = testConvex()
    await t.withIdentity(asAlice).mutation(api.users.ensureUser, {})
    const imageId = await storedImage(t, 'nutella')

    const id = await t.withIdentity(asAlice).mutation(api.foods.upsertFromOff, {
      barcode: '3017620422003',
      name: 'Nutella',
      baseUnit: 'g',
      nutritionPer100: { calories: 539 },
      imageId,
    })

    const food = await t.withIdentity(asAlice).query(api.foods.get, { id })
    expect(food?.imageId).toBe(imageId)
    expect(food?.imageUrl).toBeTruthy()
  })

  test('a product with no picture imports perfectly well', async () => {
    const t = testConvex()
    await t.withIdentity(asAlice).mutation(api.users.ensureUser, {})

    const id = await t.withIdentity(asAlice).mutation(api.foods.upsertFromOff, {
      barcode: '3017620422003',
      name: 'Nutella',
      baseUnit: 'g',
      nutritionPer100: { calories: 539 },
    })

    const food = await t.withIdentity(asAlice).query(api.foods.get, { id })
    expect(food?.name).toBe('Nutella')
    expect(food?.imageUrl).toBeNull()
  })

  test('re-importing with a new picture deletes the one it replaces', async () => {
    const t = testConvex()
    await t.withIdentity(asAlice).mutation(api.users.ensureUser, {})
    const first = await storedImage(t, 'old')
    const second = await storedImage(t, 'new')
    const fields = {
      barcode: '3017620422003',
      name: 'Nutella',
      baseUnit: 'g' as const,
      nutritionPer100: { calories: 539 },
    }

    await t.withIdentity(asAlice).mutation(api.foods.upsertFromOff, {
      ...fields,
      imageId: first,
    })
    await t.withIdentity(asAlice).mutation(api.foods.upsertFromOff, {
      ...fields,
      imageId: second,
    })

    expect(await t.run(async (ctx) => ctx.db.system.get(first))).toBeNull()
    expect(await t.run(async (ctx) => ctx.db.system.get(second))).not.toBeNull()
  })

  test('a picture another row still holds survives the food letting go of it', async () => {
    const t = testConvex()
    await t.withIdentity(asAlice).mutation(api.users.ensureUser, {})
    const shared = await storedImage(t, 'shared')
    const replacement = await storedImage(t, 'replacement')
    const fields = {
      barcode: '3017620422003',
      name: 'Nutella',
      baseUnit: 'g' as const,
      nutritionPer100: { calories: 539 },
    }

    await t.withIdentity(asAlice).mutation(api.foods.upsertFromOff, {
      ...fields,
      imageId: shared,
    })
    // A recipe holding the same blob — the case `lib/storedFiles.ts` exists
    // for: a client is handed these ids and can put one on a row of its own.
    await t.run(async (ctx) => {
      const group = await ctx.db.query('groups').first()
      const user = await ctx.db.query('users').first()
      if (!group || !user) throw new Error('seed a group and a user first')
      await ctx.db.insert('recipes', {
        groupId: group._id,
        sharedGroupIds: [],
        createdByUserId: user._id,
        title: 'Nutella on toast',
        imageId: shared,
        ingredients: [],
        steps: [],
        tags: [],
      })
    })

    await t.withIdentity(asAlice).mutation(api.foods.upsertFromOff, {
      ...fields,
      imageId: replacement,
    })

    expect(await t.run(async (ctx) => ctx.db.system.get(shared))).not.toBeNull()
  })

  test('a picture fetched for an import that is refused does not linger', async () => {
    const t = testConvex()
    await t.withIdentity(asAlice).mutation(api.users.ensureUser, {})
    const fields = {
      barcode: '3017620422003',
      name: 'Nutella',
      baseUnit: 'g' as const,
      nutritionPer100: { calories: 539 },
    }
    const id = await t
      .withIdentity(asAlice)
      .mutation(api.foods.upsertFromOff, fields)
    // Somebody has since corrected this row by hand, so a rescan writes
    // nothing at all — including the picture it just fetched.
    await t.run(async (ctx) => ctx.db.patch(id, { localEdited: true }))
    const orphan = await storedImage(t, 'unused')

    await t.withIdentity(asAlice).mutation(api.foods.upsertFromOff, {
      ...fields,
      imageId: orphan,
    })

    expect(await t.run(async (ctx) => ctx.db.system.get(orphan))).toBeNull()
  })
})

describe('editing a food’s servings', () => {
  test('taking the last one off actually takes it off', async () => {
    const t = testConvex()
    await t.withIdentity(asAlice).mutation(api.users.ensureUser, {})
    const id = await t.withIdentity(asAlice).mutation(api.foods.create, {
      name: 'Wholemeal bread',
      baseUnit: 'g',
      nutritionPer100: { calories: 250 },
      servings: [{ label: '1 slice', amount: 35 }],
    })

    // The form sends no servings at all when every row has been removed, and
    // an absent optional argument must mean "none" here rather than "leave
    // what is there" — otherwise the last serving cannot be deleted.
    await t.withIdentity(asAlice).mutation(api.foods.update, {
      id,
      name: 'Wholemeal bread',
      baseUnit: 'g',
      nutritionPer100: { calories: 250 },
    })

    const food = await t.withIdentity(asAlice).query(api.foods.get, { id })
    expect(food?.servings ?? []).toEqual([])
  })
})
