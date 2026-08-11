import { ConvexError, v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'
import { mutation, query } from './_generated/server'
import type { ComboComponent } from './lib/combos'
import { comboEntries } from './lib/combos'
import { mealValidator, quantityUnitValidator } from './lib/consumption'
import { isVisibleToGroups } from './lib/groupAccess'
import { nutritionValidator } from './lib/nutrition'
import { getCurrentUser, getMyGroupIds } from './lib/sharing'

/**
 * A Combo is Personal (ADR-0003, ADR-0012): it belongs to a person, follows
 * them into every Group and belongs to none. So every function here resolves
 * the caller and reads only their own rows — there is no Group argument to
 * take, and no Group whose membership could widen what is returned.
 */
async function myCombos(ctx: QueryCtx, userId: Id<'users'>) {
  return await ctx.db
    .query('combos')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .collect()
}

/**
 * Resolve one saved component against what it points at *now*.
 *
 * References, not figures: a food's current nutrition is what a future log
 * uses, so correcting the food corrects the Combo. A reference that has become
 * unreachable — a retired Catalog food, a Recipe in a Group the person has
 * left — comes back unavailable rather than missing, so the card can say so
 * and log the rest (ADR-0003).
 */
async function resolveComponent(
  ctx: QueryCtx,
  item: Doc<'comboItems'>,
  viewerGroupIds: Id<'groups'>[],
): Promise<ComboComponent> {
  const base = {
    id: item._id,
    label: item.label,
    quantity: item.quantity,
    quantityUnit: item.quantityUnit,
    nutrition: item.nutrition,
    icon: item.icon,
  }
  if (item.foodId) {
    const food = await ctx.db.get(item.foodId)
    return {
      ...base,
      foodId: item.foodId,
      food: food
        ? {
            baseUnit: food.baseUnit,
            nutritionPer100: food.nutritionPer100,
            servings: food.servings,
          }
        : undefined,
      available: food !== null,
    }
  }
  if (item.recipeId) {
    const recipe = await ctx.db.get(item.recipeId)
    const reachable =
      recipe !== null &&
      isVisibleToGroups(recipe, viewerGroupIds) &&
      recipe.nutrition !== undefined
    return {
      ...base,
      recipeId: item.recipeId,
      recipe:
        reachable && recipe.nutrition
          ? { nutrition: recipe.nutrition }
          : undefined,
      available: reachable,
    }
  }
  // A one-off: nothing behind it, so its own figures are all there is.
  return { ...base, available: item.nutrition !== undefined }
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    if (!user) return []
    const viewerGroupIds = await getMyGroupIds(ctx, user._id)
    const combos = await myCombos(ctx, user._id)
    return await Promise.all(
      combos
        .sort((a, b) => a.order - b.order)
        .map(async (combo) => {
          const items = await ctx.db
            .query('comboItems')
            .withIndex('by_combo', (q) => q.eq('comboId', combo._id))
            .collect()
          return {
            _id: combo._id,
            name: combo.name,
            order: combo.order,
            components: await Promise.all(
              items.map((item) =>
                resolveComponent(ctx, item, viewerGroupIds),
              ),
            ),
          }
        }),
    )
  },
})

const componentFields = {
  foodId: v.optional(v.id('foods')),
  recipeId: v.optional(v.id('recipes')),
  label: v.string(),
  quantity: v.number(),
  quantityUnit: quantityUnitValidator,
  nutrition: v.optional(nutritionValidator),
  // Travels with the figures, and for the same reason (#94): `replaceItems`
  // deletes and recreates every row, so a field missing here is a field the
  // Combo loses the moment anybody edits it — even though saving it kept it.
  icon: v.optional(v.string()),
}

/**
 * Make a Combo out of entries you have already logged, and put the Combo in
 * their place.
 *
 * This is the only way one is created: the curation is a by-product of
 * logging, not a second library to maintain (ADR-0012). What it captures is
 * the entries you ticked, of all three kinds — a food, a Recipe, or a one-off
 * with figures of its own — so nothing you chose is silently dropped, and the
 * entries you did not tick are not touched at all.
 *
 * Then it *replaces* them (#99). Saving used to leave the originals behind, so
 * the shortcut's first use cost a round of deleting and re-logging what you
 * had just curated. The replacement is the Combo's own expansion — the same
 * pure function the card renders from, so what you get is exactly what logging
 * that Combo tomorrow will get you.
 *
 * Creating, deleting and re-logging happen in this one mutation because a
 * Convex mutation is a transaction: anything thrown below rolls the whole lot
 * back. There is no order of client-side calls that could promise the same,
 * which is why there is no order of client-side calls.
 */
export const saveFromMeal = mutation({
  args: {
    date: v.string(),
    meal: mealValidator,
    name: v.string(),
    /** Which of that meal's entries go in. Empty is not a Combo. */
    entryIds: v.array(v.id('consumptionEntries')),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new ConvexError('Not authenticated')
    const name = args.name.trim()
    if (!name) throw new ConvexError('A combo needs a name.')

    const chosen = new Set<string>(args.entryIds)
    if (chosen.size === 0) {
      // A key, not a sentence. This refusal is shown to somebody, and the
      // form that shows it is the only thing that knows their language
      // (ADR-0011) — a message built here would reach a Dutch reader in
      // English.
      throw new ConvexError('comboNothingSelected')
    }

    // Read the meal and keep what was ticked, rather than reading the ticked
    // ids one by one: the Combo is saved in the order the meal is in, not in
    // whatever order the ticks arrived.
    const entries = (
      await ctx.db
        .query('consumptionEntries')
        .withIndex('by_user_date', (q) =>
          q.eq('userId', user._id).eq('date', args.date),
        )
        .collect()
    ).filter((entry) => entry.meal === args.meal && chosen.has(entry._id))
    if (entries.length !== chosen.size) {
      // One answer for an entry that does not exist, one somebody else wrote,
      // and one sitting in another meal — how the refusal reads may not be
      // used to tell them apart (ADR-0009).
      throw new ConvexError('Entry not found')
    }

    const existing = await myCombos(ctx, user._id)
    const comboId = await ctx.db.insert('combos', {
      userId: user._id,
      name,
      order: existing.length,
    })
    for (const entry of entries) {
      await ctx.db.insert('comboItems', {
        comboId,
        foodId: entry.foodId,
        recipeId: entry.recipeId,
        label: entry.label,
        quantity: entry.quantity,
        quantityUnit: entry.quantityUnit,
        // Figures are kept only where there is nothing to read them from
        // later. A food or a Recipe is re-read on every log, deliberately.
        nutrition:
          entry.foodId || entry.recipeId ? undefined : entry.nutrition,
        // Same rule for the icon (#94): a food's travels with the food, so
        // changing it there changes every future log. A one-off's has nowhere
        // else to live, and without this a Combo would quietly drop it.
        icon: entry.foodId || entry.recipeId ? undefined : entry.icon,
      })
    }

    const items = await ctx.db
      .query('comboItems')
      .withIndex('by_combo', (q) => q.eq('comboId', comboId))
      .collect()
    const viewerGroupIds = await getMyGroupIds(ctx, user._id)
    const components = await Promise.all(
      items.map((item) => resolveComponent(ctx, item, viewerGroupIds)),
    )
    const expanded = comboEntries(components)
    if (expanded.length !== entries.length) {
      // Logging an existing Combo skips a component that has gone out of reach
      // and logs the rest — losing one thing does not break the shortcut. Here
      // the originals are about to be deleted, so a component that cannot come
      // back would take a diary entry with it. Refuse the save instead; the
      // transaction takes the half-made Combo with it.
      // A key rather than a sentence, for the same reason as above: the form
      // resolves it into the reader's language.
      throw new ConvexError('comboComponentUnavailable')
    }

    for (const entry of entries) await ctx.db.delete(entry._id)
    for (const entry of expanded) {
      await ctx.db.insert('consumptionEntries', {
        userId: user._id,
        date: args.date,
        meal: args.meal,
        // Read off the rows just written, so the ids are the ones the schema
        // already validated on the way in.
        foodId: entry.foodId as Id<'foods'> | undefined,
        recipeId: entry.recipeId as Id<'recipes'> | undefined,
        label: entry.label,
        quantity: entry.quantity,
        quantityUnit: entry.quantityUnit,
        nutrition: entry.nutrition,
        icon: entry.icon,
      })
    }
    return comboId
  },
})

/**
 * Replace what a Combo contains.
 *
 * Called only by the unobtrusive offer that appears *after* logging a modified
 * Combo — never as part of logging one. Logging never edits a Combo, because
 * one unusual day must not rewrite your usual (ADR-0012).
 */
export const replaceItems = mutation({
  args: {
    id: v.id('combos'),
    components: v.array(v.object(componentFields)),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new ConvexError('Not authenticated')
    const combo = await ctx.db.get(args.id)
    // One refusal for "no such combo" and "not yours" — a Combo nobody may
    // read must not be discoverable by how the refusal is worded (ADR-0009).
    if (!combo || combo.userId !== user._id) {
      throw new ConvexError('Combo not found')
    }
    const items = await ctx.db
      .query('comboItems')
      .withIndex('by_combo', (q) => q.eq('comboId', args.id))
      .collect()
    for (const item of items) await ctx.db.delete(item._id)
    for (const component of args.components) {
      await ctx.db.insert('comboItems', { comboId: args.id, ...component })
    }
  },
})

export const rename = mutation({
  args: { id: v.id('combos'), name: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new ConvexError('Not authenticated')
    const combo = await ctx.db.get(args.id)
    if (!combo || combo.userId !== user._id) {
      throw new ConvexError('Combo not found')
    }
    const name = args.name.trim()
    if (!name) throw new ConvexError('A combo needs a name.')
    await ctx.db.patch(args.id, { name })
  },
})

export const remove = mutation({
  args: { id: v.id('combos') },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new ConvexError('Not authenticated')
    const combo = await ctx.db.get(args.id)
    if (!combo || combo.userId !== user._id) {
      throw new ConvexError('Combo not found')
    }
    const items = await ctx.db
      .query('comboItems')
      .withIndex('by_combo', (q) => q.eq('comboId', args.id))
      .collect()
    for (const item of items) await ctx.db.delete(item._id)
    await ctx.db.delete(args.id)
  },
})
