import { describe, expect, test } from 'vitest'
import { testConvex } from '../test/convexHarness'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { comboEntries } from './lib/combos'

/**
 * A Combo is Personal (ADR-0003, ADR-0012): it belongs to a person, follows
 * them into every Group and belongs to none.
 *
 * These exercise the two halves of that at the function boundary — that it is
 * invisible to anybody else, and that it reads the same whichever Group the
 * caller is standing in — plus the rule that keeps it usable: logging a
 * changed Combo never changes the Combo.
 */

const asAlice = {
  subject: 'clerk_alice',
  name: 'Alice',
  email: 'a@example.com',
}
const asBob = { subject: 'clerk_bob', name: 'Bob', email: 'b@example.com' }

const DAY = '2026-07-30'

/**
 * Alice's breakfast, already logged: a Catalog-ish food, a Recipe from a
 * household she is in, and a one-off with figures of its own — the three kinds
 * of entry a Combo has to capture faithfully.
 */
async function loggedBreakfast() {
  const t = testConvex()
  await t.withIdentity(asAlice).mutation(api.users.ensureUser, {})
  await t.withIdentity(asBob).mutation(api.users.ensureUser, {})

  const foodId = await t.withIdentity(asAlice).mutation(api.foods.create, {
    name: 'Wholemeal bread',
    baseUnit: 'g',
    nutritionPer100: { calories: 250 },
    servings: [{ label: '1 slice', amount: 35 }],
  })

  const { recipeId, groupId } = await t.run(async (ctx) => {
    const alice = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', asAlice.subject))
      .unique()
    if (!alice) throw new Error('Alice should exist')
    const group = await ctx.db.insert('groups', {
      name: 'Jansen Household',
      inviteCode: 'household',
      slug: 'jansen-household',
      isPersonal: false,
    })
    await ctx.db.insert('memberships', {
      groupId: group,
      userId: alice._id,
      role: 'admin',
    })
    const recipe = await ctx.db.insert('recipes', {
      groupId: group,
      sharedGroupIds: [],
      createdByUserId: alice._id,
      title: 'Nora’s granola',
      ingredients: [],
      steps: [],
      tags: [],
      nutrition: { calories: 400 },
    })
    return { recipeId: recipe, groupId: group }
  })

  await t.withIdentity(asAlice).mutation(api.consumption.create, {
    date: DAY,
    meal: 'breakfast',
    foodId,
    label: 'Wholemeal bread',
    quantity: 70,
    quantityUnit: 'g',
    nutrition: { calories: 175 },
  })
  await t.withIdentity(asAlice).mutation(api.consumption.create, {
    date: DAY,
    meal: 'breakfast',
    recipeId,
    label: 'Nora’s granola',
    quantity: 1,
    quantityUnit: 'serving',
    nutrition: { calories: 400 },
  })
  await t.withIdentity(asAlice).mutation(api.consumption.create, {
    date: DAY,
    meal: 'breakfast',
    label: 'Flat white from the corner',
    quantity: 1,
    quantityUnit: 'piece',
    nutrition: { calories: 120 },
  })

  return { t, foodId, recipeId, groupId }
}

/** The ids of one meal's entries, in the order the diary shows them. */
async function entryIdsFor(
  t: ReturnType<typeof testConvex>,
  meal: 'breakfast' | 'lunch' | 'dinner' | 'snack',
  date = DAY,
) {
  const entries = await t
    .withIdentity(asAlice)
    .query(api.consumption.listForDay, { date })
  return entries
    .filter((entry) => entry.meal === meal)
    .map((entry) => entry._id)
}

async function saveBreakfast() {
  const seeded = await loggedBreakfast()
  const entryIds = await entryIdsFor(seeded.t, 'breakfast')
  const comboId = await seeded.t
    .withIdentity(asAlice)
    .mutation(api.combos.saveFromMeal, {
      date: DAY,
      meal: 'breakfast',
      name: 'Usual breakfast',
      entryIds,
    })
  return { ...seeded, comboId, entryIds }
}

describe('saving entries from a meal as a Combo', () => {
  /**
   * A one-off's icon has to be captured with it, for the same reason its
   * figures are: there is no food and no recipe behind it to read one back
   * from later. Without this the icon survives the first log and disappears
   * on every log made through the Combo afterwards — the shortcut quietly
   * producing a worse entry than the thing it was a shortcut for.
   */
  test('a one-off’s icon is captured and still there when it is logged again', async () => {
    const { t } = await loggedBreakfast()
    await t.withIdentity(asAlice).mutation(api.consumption.create, {
      date: DAY,
      meal: 'breakfast',
      label: 'Stroopwafel from the market',
      quantity: 1,
      quantityUnit: 'piece',
      nutrition: { calories: 150 },
      icon: '🍪',
    })
    await t.withIdentity(asAlice).mutation(api.combos.saveFromMeal, {
      date: DAY,
      meal: 'breakfast',
      name: 'Usual breakfast',
      entryIds: await entryIdsFor(t, 'breakfast'),
    })

    const [combo] = await t.withIdentity(asAlice).query(api.combos.list, {})
    const saved = combo.components.find(
      (c) => c.label === 'Stroopwafel from the market',
    )
    expect(saved?.icon).toBe('🍪')

    // And through to what the log actually writes — the pure function the
    // client and the mutation share, so this is the entry either would send.
    const logged = comboEntries(combo.components).find(
      (e) => e.label === 'Stroopwafel from the market',
    )
    expect(logged?.icon).toBe('🍪')

    // The other half of the rule: a food carries its own icon, so the Combo
    // does not keep a stale copy of one.
    const bread = combo.components.find((c) => c.label === 'Wholemeal bread')
    expect(bread?.icon).toBeUndefined()
  })

  test('captures all three kinds of entry', async () => {
    const { t, foodId, recipeId } = await saveBreakfast()

    const [combo] = await t.withIdentity(asAlice).query(api.combos.list, {})
    expect(combo.name).toBe('Usual breakfast')
    expect(combo.components).toHaveLength(3)
    expect(combo.components.map((c) => c.label)).toEqual([
      'Wholemeal bread',
      'Nora’s granola',
      'Flat white from the corner',
    ])
    expect(combo.components[0]).toMatchObject({
      foodId,
      quantity: 70,
      quantityUnit: 'g',
      available: true,
    })
    expect(combo.components[1]).toMatchObject({ recipeId, available: true })
    // A one-off keeps its own figures, because there is nothing behind it to
    // read them from later; the other two deliberately do not.
    expect(combo.components[2].nutrition).toEqual({ calories: 120 })
    expect(combo.components[0].nutrition).toBeUndefined()
  })

  test('refuses to save a selection with nothing in it', async () => {
    const { t } = await loggedBreakfast()
    await expect(
      t.withIdentity(asAlice).mutation(api.combos.saveFromMeal, {
        date: DAY,
        meal: 'dinner',
        name: 'Nothing',
        entryIds: [],
      }),
      // The key, not a sentence: the form resolves it into the reader's
      // language, so changing it here without the message tree must fail.
    ).rejects.toThrow('comboNothingSelected')
    expect(await t.withIdentity(asAlice).query(api.combos.list, {})).toEqual([])
  })

  test('reads the current food, not the figures that were logged', async () => {
    const { t, foodId } = await saveBreakfast()
    // The bread was wrong and somebody has corrected it. Every future log of
    // every Combo containing it is corrected with it.
    await t.withIdentity(asAlice).mutation(api.foods.update, {
      id: foodId,
      name: 'Wholemeal bread',
      baseUnit: 'g',
      nutritionPer100: { calories: 300 },
    })

    const [combo] = await t.withIdentity(asAlice).query(api.combos.list, {})
    expect(combo.components[0].food?.nutritionPer100).toEqual({ calories: 300 })
  })
})

/**
 * Saving does not only capture — it *replaces*. The entries that went into the
 * Combo leave the meal and the Combo's own expansion takes their place, so
 * nobody has to delete what they just saved and log it again (#99).
 *
 * All of it is one mutation, which is the whole point: a Convex mutation that
 * throws rolls back everything it wrote, so there is no state in which the
 * Combo exists and the meal was not replaced, or the entries have gone and no
 * Combo was made.
 */
describe('saving a selection replaces exactly what was chosen', () => {
  test('the Combo holds the ticked entries, in order, at their quantities', async () => {
    const { t, foodId } = await loggedBreakfast()
    const [bread, , coffee] = await entryIdsFor(t, 'breakfast')

    await t.withIdentity(asAlice).mutation(api.combos.saveFromMeal, {
      date: DAY,
      meal: 'breakfast',
      name: 'Bread and coffee',
      // Deliberately out of the order the meal is in: what is saved is the
      // order of the meal, not the order the ticks happened to arrive in.
      entryIds: [coffee, bread],
    })

    const [combo] = await t.withIdentity(asAlice).query(api.combos.list, {})
    expect(combo.components.map((c) => c.label)).toEqual([
      'Wholemeal bread',
      'Flat white from the corner',
    ])
    expect(combo.components[0]).toMatchObject({ foodId, quantity: 70 })
    expect(combo.components[1]).toMatchObject({ quantity: 1 })
  })

  test('the ticked entries are gone and the expansion is logged in their place', async () => {
    const { t } = await loggedBreakfast()
    const before = await entryIdsFor(t, 'breakfast')

    await t.withIdentity(asAlice).mutation(api.combos.saveFromMeal, {
      date: DAY,
      meal: 'breakfast',
      name: 'Usual breakfast',
      entryIds: before,
    })

    const after = await t
      .withIdentity(asAlice)
      .query(api.consumption.listForDay, { date: DAY })
    // Same day, same meal, none of the rows that were there before.
    expect(after.every((entry) => entry.meal === 'breakfast')).toBe(true)
    expect(after.some((entry) => before.includes(entry._id))).toBe(false)

    // And what took their place is the Combo's own expansion — the pure
    // function the card and the mutation share.
    const [combo] = await t.withIdentity(asAlice).query(api.combos.list, {})
    expect(
      after.map((entry) => ({
        label: entry.label,
        quantity: entry.quantity,
        quantityUnit: entry.quantityUnit,
        nutrition: entry.nutrition,
      })),
    ).toEqual(
      comboEntries(combo.components).map((entry) => ({
        label: entry.label,
        quantity: entry.quantity,
        quantityUnit: entry.quantityUnit,
        nutrition: entry.nutrition,
      })),
    )
  })

  test('the replacements say which Combo put them there', async () => {
    const { t } = await loggedBreakfast()
    const [bread, coffee] = await entryIdsFor(t, 'breakfast')

    const comboId = await t
      .withIdentity(asAlice)
      .mutation(api.combos.saveFromMeal, {
        date: DAY,
        meal: 'breakfast',
        name: 'Bread and coffee',
        entryIds: [bread, coffee],
      })

    const after = await t
      .withIdentity(asAlice)
      .query(api.consumption.listForDay, { date: DAY })
    const stamped = after.filter((entry) => entry.comboId === comboId)
    // The two that were replaced, and only those: the granola nobody ticked
    // was not logged by a Combo and must not claim it was.
    expect(stamped).toHaveLength(2)
    expect(stamped.every((e) => e.comboLabel === 'Bread and coffee')).toBe(true)
    expect(after.filter((entry) => entry.comboId === undefined)).toHaveLength(1)
  })

  test('renaming the Combo afterwards does not rewrite the day it was logged on', async () => {
    const { t } = await loggedBreakfast()
    const before = await entryIdsFor(t, 'breakfast')
    const comboId = await t
      .withIdentity(asAlice)
      .mutation(api.combos.saveFromMeal, {
        date: DAY,
        meal: 'breakfast',
        name: 'Usual breakfast',
        entryIds: before,
      })

    await t
      .withIdentity(asAlice)
      .mutation(api.combos.rename, { id: comboId, name: 'Weekday breakfast' })

    // An entry snapshots what it references (ADR-0003). What happened that
    // morning was "Usual breakfast", whatever the Combo is called now.
    const after = await t
      .withIdentity(asAlice)
      .query(api.consumption.listForDay, { date: DAY })
    expect(after.every((e) => e.comboLabel === 'Usual breakfast')).toBe(true)
  })

  test('deleting the Combo leaves the entries it wrote saying so', async () => {
    const { t } = await loggedBreakfast()
    const before = await entryIdsFor(t, 'breakfast')
    const comboId = await t
      .withIdentity(asAlice)
      .mutation(api.combos.saveFromMeal, {
        date: DAY,
        meal: 'breakfast',
        name: 'Usual breakfast',
        entryIds: before,
      })

    await t.withIdentity(asAlice).mutation(api.combos.remove, { id: comboId })

    // Provenance is allowed to dangle; the record of what happened is not.
    const after = await t
      .withIdentity(asAlice)
      .query(api.consumption.listForDay, { date: DAY })
    expect(after).not.toHaveLength(0)
    expect(after.every((e) => e.comboLabel === 'Usual breakfast')).toBe(true)
  })

  test('entries nobody ticked are left exactly as they were', async () => {
    const { t } = await loggedBreakfast()
    const [bread, granola, coffee] = await entryIdsFor(t, 'breakfast')
    const untouched = await t.run(async (ctx) => ctx.db.get(granola))

    await t.withIdentity(asAlice).mutation(api.combos.saveFromMeal, {
      date: DAY,
      meal: 'breakfast',
      name: 'Bread and coffee',
      entryIds: [bread, coffee],
    })

    expect(await t.run(async (ctx) => ctx.db.get(granola))).toEqual(untouched)
  })

  test('an entry in another meal is refused, and nothing at all is written', async () => {
    const { t } = await loggedBreakfast()
    await t.withIdentity(asAlice).mutation(api.consumption.create, {
      date: DAY,
      meal: 'lunch',
      label: 'Soup',
      quantity: 1,
      quantityUnit: 'piece',
      nutrition: { calories: 90 },
    })
    const breakfast = await entryIdsFor(t, 'breakfast')
    const [soup] = await entryIdsFor(t, 'lunch')

    await expect(
      t.withIdentity(asAlice).mutation(api.combos.saveFromMeal, {
        date: DAY,
        meal: 'breakfast',
        name: 'Breakfast and soup',
        entryIds: [...breakfast, soup],
      }),
    ).rejects.toThrow()

    expect(await t.withIdentity(asAlice).query(api.combos.list, {})).toEqual([])
    expect(
      (
        await t
          .withIdentity(asAlice)
          .query(api.consumption.listForDay, { date: DAY })
      ).map((entry) => entry._id),
    ).toEqual([...breakfast, soup])
  })

  /**
   * The same refusal for an entry that does not exist, one somebody else
   * wrote, and one in another meal (ADR-0009) — and nothing partially applied
   * behind it.
   */
  test('somebody else’s entry is refused, and nothing at all is written', async () => {
    const { t } = await loggedBreakfast()
    const breakfast = await entryIdsFor(t, 'breakfast')
    const bobs = await t.withIdentity(asBob).mutation(api.consumption.create, {
      date: DAY,
      meal: 'breakfast',
      label: 'Bob’s toast',
      quantity: 1,
      quantityUnit: 'piece',
      nutrition: { calories: 100 },
    })

    await expect(
      t.withIdentity(asAlice).mutation(api.combos.saveFromMeal, {
        date: DAY,
        meal: 'breakfast',
        name: 'Not mine',
        entryIds: [...breakfast, bobs],
      }),
    ).rejects.toThrow('Entry not found')

    expect(await t.withIdentity(asAlice).query(api.combos.list, {})).toEqual([])
    expect((await entryIdsFor(t, 'breakfast')).length).toBe(3)
    expect(await t.run(async (ctx) => ctx.db.get(bobs))).not.toBeNull()
  })

  /**
   * Replacing must not lose a record. Logging an *existing* Combo skips a
   * component that has gone out of reach and logs the rest — but here the
   * originals are being deleted, so a component that cannot come back would
   * take a diary entry with it. The whole save refuses instead, and the
   * transaction takes the half-made Combo with it.
   */
  test('refuses when something ticked can no longer be logged, and writes nothing at all', async () => {
    const { t, groupId } = await loggedBreakfast()
    const breakfast = await entryIdsFor(t, 'breakfast')

    // Alice leaves the household the Recipe lives in.
    await t.run(async (ctx) => {
      for (const membership of await ctx.db
        .query('memberships')
        .withIndex('by_group', (q) => q.eq('groupId', groupId))
        .collect()) {
        await ctx.db.delete(membership._id)
      }
    })

    await expect(
      t.withIdentity(asAlice).mutation(api.combos.saveFromMeal, {
        date: DAY,
        meal: 'breakfast',
        name: 'Usual breakfast',
        entryIds: breakfast,
      }),
    ).rejects.toThrow('comboComponentUnavailable')

    expect(await t.withIdentity(asAlice).query(api.combos.list, {})).toEqual([])
    const orphans = await t.run(async (ctx) =>
      ctx.db.query('comboItems').collect(),
    )
    expect(orphans).toEqual([])
    expect(await entryIdsFor(t, 'breakfast')).toEqual(breakfast)
  })

  test('a name of nothing but spaces is refused, and writes nothing at all', async () => {
    const { t } = await loggedBreakfast()
    const breakfast = await entryIdsFor(t, 'breakfast')
    await expect(
      t.withIdentity(asAlice).mutation(api.combos.saveFromMeal, {
        date: DAY,
        meal: 'breakfast',
        name: '   ',
        entryIds: breakfast,
      }),
    ).rejects.toThrow()
    expect(await entryIdsFor(t, 'breakfast')).toEqual(breakfast)
  })
})

describe('a Combo is one person’s', () => {
  /**
   * Saving from a meal is done from inside a Group in the UI, and still writes
   * nothing that belongs to one: no `groupId` reaches either table, which is
   * what makes "reads the same in every Group" true by construction rather
   * than by care (ADR-0012).
   */
  test('replacing a meal writes no Group onto anything', async () => {
    const { t } = await saveBreakfast()
    const rows = await t.run(async (ctx) => ({
      combos: await ctx.db.query('combos').collect(),
      items: await ctx.db.query('comboItems').collect(),
    }))
    for (const row of [...rows.combos, ...rows.items]) {
      expect(row).not.toHaveProperty('groupId')
    }
  })

  test('nobody else sees it', async () => {
    const { t } = await saveBreakfast()
    expect(await t.withIdentity(asBob).query(api.combos.list, {})).toEqual([])
  })

  test('nobody else can change it', async () => {
    const { t, comboId } = await saveBreakfast()
    await expect(
      t
        .withIdentity(asBob)
        .mutation(api.combos.rename, { id: comboId, name: 'Bob’s' }),
    ).rejects.toThrow()
  })

  test('there is nothing to see without a session', async () => {
    const { t } = await saveBreakfast()
    expect(await t.query(api.combos.list, {})).toEqual([])
  })

  test('nobody else can delete it', async () => {
    const { t, comboId } = await saveBreakfast()
    await expect(
      t.withIdentity(asBob).mutation(api.combos.remove, { id: comboId }),
    ).rejects.toThrow()
    expect(
      await t.withIdentity(asAlice).query(api.combos.list, {}),
    ).toHaveLength(1)
  })

  test('reads identically however many Groups the person is in', async () => {
    const { t } = await saveBreakfast()
    const before = await t.withIdentity(asAlice).query(api.combos.list, {})

    // A second Group changes nothing: a Combo belongs to no Group, so there is
    // no Group argument to pass and no Group whose membership could alter it.
    await t.run(async (ctx) => {
      const alice = await ctx.db
        .query('users')
        .withIndex('by_clerkId', (q) => q.eq('clerkId', asAlice.subject))
        .unique()
      if (!alice) throw new Error('Alice should exist')
      const other = await ctx.db.insert('groups', {
        name: 'Wine club',
        inviteCode: 'wine',
        slug: 'wine-club',
        isPersonal: false,
      })
      await ctx.db.insert('memberships', {
        groupId: other,
        userId: alice._id,
        role: 'member',
      })
    })

    expect(await t.withIdentity(asAlice).query(api.combos.list, {})).toEqual(
      before,
    )
  })
})

describe('a Combo whose Recipe has gone out of reach', () => {
  test('renders that component as unavailable and still logs the rest', async () => {
    const { t, comboId, groupId } = await saveBreakfast()

    // Alice leaves the household the Recipe lives in. Provenance is
    // permission-checked on read and safe to dangle (ADR-0003).
    await t.run(async (ctx) => {
      for (const membership of await ctx.db
        .query('memberships')
        .withIndex('by_group', (q) => q.eq('groupId', groupId))
        .collect()) {
        await ctx.db.delete(membership._id)
      }
    })

    const [combo] = await t.withIdentity(asAlice).query(api.combos.list, {})
    expect(combo._id).toBe(comboId)
    expect(combo.components[1]).toMatchObject({
      label: 'Nora’s granola',
      available: false,
    })
    expect(combo.components[1].recipe).toBeUndefined()
    // The other two are untouched and still loggable.
    expect(
      combo.components.filter((c) => c.available).map((c) => c.label),
    ).toEqual(['Wholemeal bread', 'Flat white from the corner'])
  })
})

describe('logging a Combo', () => {
  test('writes one entry per component, and undo can take them all back', async () => {
    const { t } = await saveBreakfast()
    const [combo] = await t.withIdentity(asAlice).query(api.combos.list, {})

    const ids = await t
      .withIdentity(asAlice)
      .mutation(api.consumption.createMany, {
        date: '2026-08-01',
        meal: 'breakfast',
        entries: combo.components.map((component) => ({
          foodId: component.foodId as Id<'foods'> | undefined,
          recipeId: component.recipeId as Id<'recipes'> | undefined,
          label: component.label,
          quantity: component.quantity,
          quantityUnit: component.quantityUnit,
          nutrition: { calories: 100 },
        })),
      })

    expect(ids).toHaveLength(3)
    for (const id of ids) {
      await t.withIdentity(asAlice).mutation(api.consumption.remove, { id })
    }
    expect(
      await t
        .withIdentity(asAlice)
        .query(api.consumption.listForDay, { date: '2026-08-01' }),
    ).toEqual([])
  })

  test('stamps the entries with the Combo that wrote them', async () => {
    const { t } = await saveBreakfast()
    const [combo] = await t.withIdentity(asAlice).query(api.combos.list, {})

    await t.withIdentity(asAlice).mutation(api.consumption.createMany, {
      date: '2026-08-01',
      meal: 'breakfast',
      entries: combo.components.map((component) => ({
        foodId: component.foodId as Id<'foods'> | undefined,
        recipeId: component.recipeId as Id<'recipes'> | undefined,
        label: component.label,
        quantity: component.quantity,
        quantityUnit: component.quantityUnit,
        nutrition: { calories: 100 },
      })),
      comboId: combo._id,
      comboLabel: combo.name,
    })

    // Logging one and saving one both leave the same mark: the diary says a
    // Combo put these here, whichever way it happened.
    const entries = await t
      .withIdentity(asAlice)
      .query(api.consumption.listForDay, { date: '2026-08-01' })
    expect(entries).toHaveLength(3)
    expect(entries.every((e) => e.comboId === combo._id)).toBe(true)
    expect(entries.every((e) => e.comboLabel === combo.name)).toBe(true)
  })

  test('an entry logged one at a time claims no Combo', async () => {
    const { t } = await saveBreakfast()

    await t.withIdentity(asAlice).mutation(api.consumption.create, {
      date: '2026-08-01',
      meal: 'lunch',
      label: 'An apple',
      quantity: 1,
      quantityUnit: 'piece',
      nutrition: { calories: 52 },
    })

    const [entry] = await t
      .withIdentity(asAlice)
      .query(api.consumption.listForDay, { date: '2026-08-01' })
    expect(entry.comboId).toBeUndefined()
    expect(entry.comboLabel).toBeUndefined()
  })

  test('leaves the stored Combo alone however much today’s logging changed', async () => {
    const { t } = await saveBreakfast()
    const before = await t.withIdentity(asAlice).query(api.combos.list, {})

    // Today: twice the bread, no coffee.
    await t.withIdentity(asAlice).mutation(api.consumption.createMany, {
      date: '2026-08-01',
      meal: 'breakfast',
      entries: [
        {
          foodId: before[0].components[0].foodId as Id<'foods'>,
          label: 'Wholemeal bread',
          quantity: 140,
          quantityUnit: 'g',
          nutrition: { calories: 350 },
        },
      ],
    })

    expect(await t.withIdentity(asAlice).query(api.combos.list, {})).toEqual(
      before,
    )
  })

  test('the offer afterwards is what changes it, and only when taken', async () => {
    const { t, comboId } = await saveBreakfast()
    const [before] = await t.withIdentity(asAlice).query(api.combos.list, {})

    await t.withIdentity(asAlice).mutation(api.combos.replaceItems, {
      id: comboId,
      components: [
        {
          foodId: before.components[0].foodId as Id<'foods'>,
          label: 'Wholemeal bread',
          quantity: 140,
          quantityUnit: 'g',
        },
      ],
    })

    const [after] = await t.withIdentity(asAlice).query(api.combos.list, {})
    expect(after.components).toHaveLength(1)
    expect(after.components[0]).toMatchObject({ quantity: 140 })
    expect(after.name).toBe('Usual breakfast')
  })

  /**
   * Saving a Combo keeps a one-off's icon; editing one has to keep it too.
   *
   * `replaceItems` deletes and recreates every row, so any field the payload
   * does not carry is lost the first time somebody changes a count — silently,
   * and long after the save that appeared to work. The initial-save test two
   * blocks up would go on passing throughout.
   */
  test('a one-off’s icon survives editing the Combo', async () => {
    const { t } = await loggedBreakfast()
    await t.withIdentity(asAlice).mutation(api.consumption.create, {
      date: DAY,
      meal: 'breakfast',
      label: 'Stroopwafel from the market',
      quantity: 1,
      quantityUnit: 'piece',
      nutrition: { calories: 150 },
      icon: '🍪',
    })
    const comboId = await t
      .withIdentity(asAlice)
      .mutation(api.combos.saveFromMeal, {
        date: DAY,
        meal: 'breakfast',
        name: 'Usual breakfast',
        entryIds: await entryIdsFor(t, 'breakfast'),
      })

    const [before] = await t.withIdentity(asAlice).query(api.combos.list, {})
    const saved = before.components.find(
      (c) => c.label === 'Stroopwafel from the market',
    )
    expect(saved?.icon).toBe('🍪')

    // Exactly what the add sheet sends when a count changed and the offer to
    // update was taken: every component rebuilt from what was logged.
    await t.withIdentity(asAlice).mutation(api.combos.replaceItems, {
      id: comboId,
      components: comboEntries(before.components).map((entry) => ({
        foodId: entry.foodId as Id<'foods'> | undefined,
        recipeId: entry.recipeId as Id<'recipes'> | undefined,
        label: entry.label,
        quantity: entry.quantity,
        quantityUnit: entry.quantityUnit,
        nutrition: entry.foodId || entry.recipeId ? undefined : entry.nutrition,
        icon: entry.foodId || entry.recipeId ? undefined : entry.icon,
      })),
    })

    const [after] = await t.withIdentity(asAlice).query(api.combos.list, {})
    const rebuilt = after.components.find(
      (c) => c.label === 'Stroopwafel from the market',
    )
    expect(rebuilt?.icon).toBe('🍪')
  })
})

/**
 * Renaming and deleting from the library (#129).
 *
 * A Combo is a shortcut for what will happen; the diary is the record of what
 * did. So neither of these may reach into the diary — which is the thing
 * somebody would reasonably fear when pressing Delete.
 */
describe('keeping the library tidy', () => {
  test('renaming changes what the library and the add sheet find', async () => {
    const { t, comboId } = await saveBreakfast()

    await t
      .withIdentity(asAlice)
      .mutation(api.combos.rename, { id: comboId, name: 'Weekday breakfast' })

    const [combo] = await t.withIdentity(asAlice).query(api.combos.list, {})
    expect(combo.name).toBe('Weekday breakfast')
  })

  test('a name of nothing but spaces is refused', async () => {
    const { t, comboId } = await saveBreakfast()

    await expect(
      t.withIdentity(asAlice).mutation(api.combos.rename, {
        id: comboId,
        name: '   ',
      }),
    ).rejects.toThrow()

    const [combo] = await t.withIdentity(asAlice).query(api.combos.list, {})
    expect(combo.name).toBe('Usual breakfast')
  })

  test('deleting takes the components with it, leaving no orphans', async () => {
    const { t, comboId } = await saveBreakfast()
    expect(
      await t.run(async (ctx) => ctx.db.query('comboItems').collect()),
    ).not.toHaveLength(0)

    await t.withIdentity(asAlice).mutation(api.combos.remove, { id: comboId })

    expect(await t.withIdentity(asAlice).query(api.combos.list, {})).toEqual([])
    expect(
      await t.run(async (ctx) => ctx.db.query('comboItems').collect()),
    ).toEqual([])
  })

  test('deleting leaves the diary exactly as it was', async () => {
    const { t, comboId } = await saveBreakfast()
    const before = await t
      .withIdentity(asAlice)
      .query(api.consumption.listForDay, { date: DAY })
    expect(before).not.toHaveLength(0)

    await t.withIdentity(asAlice).mutation(api.combos.remove, { id: comboId })

    // What was logged happened. Losing the shortcut does not unhappen it.
    expect(
      await t.withIdentity(asAlice).query(api.consumption.listForDay, {
        date: DAY,
      }),
    ).toEqual(before)
  })

  test('renaming leaves the diary exactly as it was', async () => {
    const { t, comboId } = await saveBreakfast()
    const before = await t
      .withIdentity(asAlice)
      .query(api.consumption.listForDay, { date: DAY })

    await t
      .withIdentity(asAlice)
      .mutation(api.combos.rename, { id: comboId, name: 'Something else' })

    expect(
      await t.withIdentity(asAlice).query(api.consumption.listForDay, {
        date: DAY,
      }),
    ).toEqual(before)
  })

  test('a Combo that is not yours refuses the same way one that does not exist does', async () => {
    const { t, comboId } = await saveBreakfast()
    await t.withIdentity(asAlice).mutation(api.combos.remove, { id: comboId })

    // Gone now, so this is the "no such combo" case; Bob's attempt above is
    // the "not yours" one. Neither wording may tell them apart (ADR-0009).
    await expect(
      t.withIdentity(asAlice).mutation(api.combos.remove, { id: comboId }),
    ).rejects.toThrow('Combo not found')
    await expect(
      t.withIdentity(asBob).mutation(api.combos.remove, { id: comboId }),
    ).rejects.toThrow('Combo not found')
  })
})
