import { describe, expect, test, vi } from 'vitest'
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

/**
 * A food says where its *figures* came from, which is a different question
 * from where the *row* came from (`source`). The two can disagree — a row
 * somebody added by hand can carry figures read off a packet, and an imported
 * row can carry figures they typed over — and the pair is only worth having
 * while each keeps answering its own question.
 *
 * `foods.update` decides this itself rather than being told, because it is the
 * one place a person can type over a food's nutrition. It is a public
 * mutation: if it took the answer as an argument, "these came from Open Food
 * Facts" would be a claim any caller could make about numbers it had just
 * changed.
 */
describe('where a food’s figures came from', () => {
  const nutella = {
    barcode: '3017620422003',
    name: 'Nutella',
    baseUnit: 'g' as const,
    nutritionPer100: { calories: 539, sugars: 56.3 },
  }

  async function signedIn() {
    const t = testConvex()
    await t.withIdentity(asAlice).mutation(api.users.ensureUser, {})
    return t
  }

  test('an Open Food Facts import records its figures as imported', async () => {
    const t = await signedIn()
    const id = await t
      .withIdentity(asAlice)
      .mutation(api.foods.upsertFromOff, nutella)

    const food = await t.withIdentity(asAlice).query(api.foods.get, { id })
    expect(food?.nutritionSource).toBe('imported')
    // The row came from Open Food Facts too — but that is the other question,
    // and it is still being answered separately.
    expect(food?.source).toBe('openfoodfacts')
  })

  test('a food created by hand records its figures as manual', async () => {
    const t = await signedIn()
    const id = await t.withIdentity(asAlice).mutation(api.foods.create, {
      name: 'Nora’s granola',
      baseUnit: 'g',
      nutritionPer100: { calories: 471 },
    })

    const food = await t.withIdentity(asAlice).query(api.foods.get, { id })
    expect(food?.nutritionSource).toBe('manual')
  })

  test('an import corrected in the review form saves as manual', async () => {
    const t = await signedIn()
    // The form shows Open Food Facts' figures until the person types over
    // one, at which point it says `manual` and the save records that.
    const id = await t.withIdentity(asAlice).mutation(api.foods.upsertFromOff, {
      ...nutella,
      nutritionPer100: { calories: 530, sugars: 56.3 },
      nutritionSource: 'manual',
    })

    const food = await t.withIdentity(asAlice).query(api.foods.get, { id })
    expect(food?.nutritionSource).toBe('manual')
  })

  test('editing the figures by hand makes them manual, whatever they were', async () => {
    const t = await signedIn()
    const id = await t
      .withIdentity(asAlice)
      .mutation(api.foods.upsertFromOff, nutella)

    await t.withIdentity(asAlice).mutation(api.foods.update, {
      id,
      name: 'Nutella',
      baseUnit: 'g',
      nutritionPer100: { calories: 530, sugars: 56.3 },
    })

    const food = await t.withIdentity(asAlice).query(api.foods.get, { id })
    expect(food?.nutritionSource).toBe('manual')
  })

  test('editing without touching the figures leaves the record alone', async () => {
    const t = await signedIn()
    const id = await t
      .withIdentity(asAlice)
      .mutation(api.foods.upsertFromOff, nutella)

    // A brand, a serving, the same numbers: nothing has been claimed about
    // where those numbers came from.
    await t.withIdentity(asAlice).mutation(api.foods.update, {
      id,
      name: 'Nutella',
      brand: 'Ferrero',
      baseUnit: 'g',
      nutritionPer100: { ...nutella.nutritionPer100 },
      servings: [{ label: '1 spoon', amount: 15 }],
    })

    const food = await t.withIdentity(asAlice).query(api.foods.get, { id })
    expect(food?.nutritionSource).toBe('imported')
  })

  test('a food that recorded nothing goes on recording nothing', async () => {
    const t = await signedIn()
    const id = await t
      .withIdentity(asAlice)
      .mutation(api.foods.upsertFromOff, nutella)
    // Exactly the rows that predate the field: nothing backfills them, so an
    // edit that leaves the figures alone must not invent an answer either.
    await t.run(async (ctx) => ctx.db.patch(id, { nutritionSource: undefined }))

    await t.withIdentity(asAlice).mutation(api.foods.update, {
      id,
      name: 'Nutella',
      brand: 'Ferrero',
      baseUnit: 'g',
      nutritionPer100: { ...nutella.nutritionPer100 },
    })

    const food = await t.withIdentity(asAlice).query(api.foods.get, { id })
    expect(food?.nutritionSource).toBeUndefined()
  })

  test('a refresh from Open Food Facts takes the figures back to imported', async () => {
    const t = await signedIn()
    const id = await t
      .withIdentity(asAlice)
      .mutation(api.foods.upsertFromOff, nutella)
    await t.withIdentity(asAlice).mutation(api.foods.update, {
      id,
      name: 'Nutella',
      baseUnit: 'g',
      nutritionPer100: { calories: 530 },
    })

    await t
      .withIdentity(asAlice)
      .mutation(api.foods.applyOffRefresh, { id, ...nutella })

    const food = await t.withIdentity(asAlice).query(api.foods.get, { id })
    expect(food?.nutritionSource).toBe('imported')
  })

  test('a food saved with no figures claims nothing about them', async () => {
    const t = await signedIn()
    const id = await t.withIdentity(asAlice).mutation(api.foods.create, {
      name: 'Water',
      baseUnit: 'ml',
      nutritionPer100: {},
    })

    const food = await t.withIdentity(asAlice).query(api.foods.get, { id })
    expect(food?.nutritionSource).toBeUndefined()
  })

  test('a Catalog food claims nothing, and no edit can give it an answer', async () => {
    const t = await signedIn()
    const id = await t.run(async (ctx) =>
      ctx.db.insert('foods', {
        name: 'Banana',
        baseUnit: 'g',
        nutritionPer100: { calories: 89 },
        source: 'seed',
        seedKey: 'banana',
      }),
    )

    const food = await t.withIdentity(asAlice).query(api.foods.get, { id })
    // Their figures are authored, and "Built-in" already says where they came
    // from — no badge rather than a wrong one.
    expect(food?.nutritionSource).toBeUndefined()
    // Read-only (ADR 0004), and the new field is no way around that.
    await expect(
      t.withIdentity(asAlice).mutation(api.foods.update, {
        id,
        name: 'Banana',
        baseUnit: 'g',
        nutritionPer100: { calories: 100 },
      }),
    ).rejects.toThrow()
  })
})

/**
 * Every Open Food Facts import is reviewed before it is saved (#93): choosing a
 * result opens the pre-filled form, and *saving* is what imports the food and
 * logs the entry.
 *
 * The property that makes that safe is the first one below — the lookup that
 * fills the form is a read, all the way down. Somebody who opens the review and
 * changes their mind leaves the database exactly as they found it: no orphaned
 * food row, and no picture in storage. The picture is fetched by
 * `importFromOff`, at the save, which is the only reason that can be true.
 */
describe('reviewing an import before it is saved', () => {
  const product = {
    status: 1,
    product: {
      code: '3017620422003',
      product_name: 'Nutella',
      brands: 'Ferrero',
      nutriments: { 'energy-kcal_100g': 539 },
      image_front_small_url:
        'https://images.openfoodfacts.org/images/products/front.jpg',
    },
  }

  async function signedIn() {
    const t = testConvex()
    await t.withIdentity(asAlice).mutation(api.users.ensureUser, {})
    return t
  }

  /** What is actually in the database, whatever anybody meant to put there. */
  async function contents(t: ReturnType<typeof testConvex>) {
    return await t.run(async (ctx) => ({
      foods: await ctx.db.query('foods').collect(),
      files: await ctx.db.system.query('_storage').collect(),
    }))
  }

  test('abandoning the form leaves no orphaned food and no stored picture', async () => {
    const t = await signedIn()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify(product), { status: 200 })),
    )

    try {
      const mapped = await t
        .withIdentity(asAlice)
        .action(api.foodsLookup.lookupBarcode, { barcode: '3017620422003' })

      // The form is filled from this, so it really did resolve the product —
      // what follows is about a lookup that worked, not one that quietly
      // did nothing.
      expect(mapped?.name).toBe('Nutella')
      expect(mapped?.imageUrl).toBeTruthy()
    } finally {
      vi.unstubAllGlobals()
    }

    // …and then the person closed the form. Nothing was written, including the
    // picture, which is still only a URL on Open Food Facts' servers.
    const after = await contents(t)
    expect(after.foods).toEqual([])
    expect(after.files).toEqual([])
  })

  test('saving is what imports the food, and it carries the review’s answer', async () => {
    const t = await signedIn()

    // No picture on this product, so nothing is fetched — the same call the
    // review form makes when it saves, minus the network. The person corrected
    // a figure while reviewing, so the food must not go on claiming the
    // numbers came off a packet.
    const id = await t
      .withIdentity(asAlice)
      .action(api.foodsLookup.importFromOff, {
        barcode: '3017620422003',
        name: 'Nutella',
        brand: 'Ferrero',
        baseUnit: 'g',
        nutritionPer100: { calories: 530 },
        nutritionSource: 'manual',
      })

    const food = await t.withIdentity(asAlice).query(api.foods.get, { id })
    expect(food?.name).toBe('Nutella')
    expect(food?.source).toBe('openfoodfacts')
    expect(food?.nutritionSource).toBe('manual')
  })

  test('an import accepted as it stands still says the figures were imported', async () => {
    const t = await signedIn()

    const id = await t
      .withIdentity(asAlice)
      .action(api.foodsLookup.importFromOff, {
        barcode: '3017620422003',
        name: 'Nutella',
        baseUnit: 'g',
        nutritionPer100: { calories: 539 },
      })

    const food = await t.withIdentity(asAlice).query(api.foods.get, { id })
    expect(food?.nutritionSource).toBe('imported')
  })
})

/**
 * The emoji a person picked for a food (#94).
 *
 * Content, stored rather than translated, and optional in both directions:
 * nothing is backfilled, and taking one off has to be a thing the row can
 * actually record. The tier below it in the tile is the generic glyph, and an
 * icon stored as `''` would stand in front of that glyph rendering nothing —
 * so "cleared" has to mean an absent field, which is what these check.
 */
describe('a food’s icon', () => {
  async function signedIn() {
    const t = testConvex()
    await t.withIdentity(asAlice).mutation(api.users.ensureUser, {})
    return t
  }

  test('is saved with the food, and read back with it', async () => {
    const t = await signedIn()

    const id = await t.withIdentity(asAlice).mutation(api.foods.create, {
      name: 'Hagelslag',
      baseUnit: 'g',
      nutritionPer100: { calories: 500 },
      icon: '🍫',
    })

    const food = await t.withIdentity(asAlice).query(api.foods.get, { id })
    expect(food?.icon).toBe('🍫')
  })

  test('a food nobody gave one has no field at all', async () => {
    const t = await signedIn()

    const id = await t.withIdentity(asAlice).mutation(api.foods.create, {
      name: 'Hagelslag',
      baseUnit: 'g',
      nutritionPer100: { calories: 500 },
    })

    const row = await t.run(async (ctx) => ctx.db.get(id))
    expect(row && 'icon' in row).toBe(false)
  })

  test('can be changed', async () => {
    const t = await signedIn()
    const id = await t.withIdentity(asAlice).mutation(api.foods.create, {
      name: 'Melk',
      baseUnit: 'ml',
      nutritionPer100: { calories: 46 },
      icon: '🥛',
    })

    await t.withIdentity(asAlice).mutation(api.foods.update, {
      id,
      name: 'Melk',
      baseUnit: 'ml',
      nutritionPer100: { calories: 46 },
      icon: '🧀',
    })

    const food = await t.withIdentity(asAlice).query(api.foods.get, { id })
    expect(food?.icon).toBe('🧀')
  })

  // The one that would fail silently: an optional argument nobody sent is not
  // a key on the arguments at all, so a save that only spread them would keep
  // the old icon forever and clearing would look like it had worked.
  test('clearing it removes the field rather than storing an empty string', async () => {
    const t = await signedIn()
    const id = await t.withIdentity(asAlice).mutation(api.foods.create, {
      name: 'Melk',
      baseUnit: 'ml',
      nutritionPer100: { calories: 46 },
      icon: '🥛',
    })

    // Exactly what the form sends once the icon has been taken off: every
    // other field, and no icon.
    await t.withIdentity(asAlice).mutation(api.foods.update, {
      id,
      name: 'Melk',
      baseUnit: 'ml',
      nutritionPer100: { calories: 46 },
    })

    const row = await t.run(async (ctx) => ctx.db.get(id))
    expect(row?.icon).toBeUndefined()
    expect(row && 'icon' in row).toBe(false)
  })

  // The path most likely to drop it: an import goes through the *action*, not
  // the mutation, because of the picture. A field the action does not carry is
  // lost at the save with nothing saying so.
  test('survives an Open Food Facts import, which is where it is picked', async () => {
    const t = await signedIn()

    const id = await t
      .withIdentity(asAlice)
      .action(api.foodsLookup.importFromOff, {
        barcode: '8712345678901',
        name: 'Volkoren crackers',
        brand: 'Plus',
        baseUnit: 'g',
        nutritionPer100: {},
        // A product with no photograph and no figures — the review screen's
        // whole reason for existing, and the row an icon does the most for.
        icon: '🍞',
      })

    const food = await t.withIdentity(asAlice).query(api.foods.get, { id })
    expect(food?.icon).toBe('🍞')
    expect(food?.source).toBe('openfoodfacts')
  })

  test('a refresh from Open Food Facts leaves the one you chose alone', async () => {
    const t = await signedIn()
    const id = await t.withIdentity(asAlice).mutation(api.foods.upsertFromOff, {
      barcode: '3017620422003',
      name: 'Nutella',
      baseUnit: 'g',
      nutritionPer100: { calories: 539 },
      icon: '🍫',
    })

    // Open Food Facts has no emoji, so a refresh has nothing to overwrite it
    // with — and the icon was yours, not theirs.
    await t.withIdentity(asAlice).mutation(api.foods.applyOffRefresh, {
      id,
      barcode: '3017620422003',
      name: 'Nutella',
      baseUnit: 'g',
      nutritionPer100: { calories: 546 },
    })

    const food = await t.withIdentity(asAlice).query(api.foods.get, { id })
    expect(food?.icon).toBe('🍫')
    expect(food?.nutritionPer100.calories).toBe(546)
  })

  test('a Catalog food carries the fixture’s icon and still refuses every write', async () => {
    const t = await signedIn()
    const id = await t.run(async (ctx) =>
      ctx.db.insert('foods', {
        name: 'Banana',
        baseUnit: 'g',
        nutritionPer100: { calories: 89 },
        source: 'seed',
        seedKey: 'banana',
        icon: '🍌',
      }),
    )

    const food = await t.withIdentity(asAlice).query(api.foods.get, { id })
    expect(food?.icon).toBe('🍌')
    // A fixture setting an icon is not the same as making these rows editable
    // (ADR 0004) — `assertNotCatalog` still guards the write path.
    await expect(
      t.withIdentity(asAlice).mutation(api.foods.update, {
        id,
        name: 'Banana',
        baseUnit: 'g',
        nutritionPer100: { calories: 89 },
        icon: '🍎',
      }),
    ).rejects.toThrow()

    const after = await t.withIdentity(asAlice).query(api.foods.get, { id })
    expect(after?.icon).toBe('🍌')
  })
})
