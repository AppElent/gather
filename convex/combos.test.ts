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

const asAlice = { subject: 'clerk_alice', name: 'Alice', email: 'a@example.com' }
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

async function saveBreakfast() {
  const seeded = await loggedBreakfast()
  const comboId = await seeded.t
    .withIdentity(asAlice)
    .mutation(api.combos.saveFromMeal, {
      date: DAY,
      meal: 'breakfast',
      name: 'Usual breakfast',
    })
  return { ...seeded, comboId }
}

describe('saving a meal slot as a Combo', () => {
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

  test('refuses to save a meal with nothing in it', async () => {
    const { t } = await loggedBreakfast()
    await expect(
      t.withIdentity(asAlice).mutation(api.combos.saveFromMeal, {
        date: DAY,
        meal: 'dinner',
        name: 'Nothing',
      }),
    ).rejects.toThrow()
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

describe('a Combo is one person’s', () => {
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
        nutrition:
          entry.foodId || entry.recipeId ? undefined : entry.nutrition,
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
