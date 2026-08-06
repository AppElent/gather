import { ConvexError, v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'
import { mutation, query } from './_generated/server'
import type { ComboComponent } from './lib/combos'
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
}

/**
 * Make a Combo out of a meal slot you have already filled in.
 *
 * This is the only way one is created: the curation is a by-product of
 * logging, not a second library to maintain (ADR-0012). What it captures is
 * every entry in that slot, of all three kinds — a food, a Recipe, or a
 * one-off with figures of its own — so nothing you logged is silently
 * dropped.
 */
export const saveFromMeal = mutation({
  args: { date: v.string(), meal: mealValidator, name: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new ConvexError('Not authenticated')
    const name = args.name.trim()
    if (!name) throw new ConvexError('A combo needs a name.')

    const entries = (
      await ctx.db
        .query('consumptionEntries')
        .withIndex('by_user_date', (q) =>
          q.eq('userId', user._id).eq('date', args.date),
        )
        .collect()
    ).filter((entry) => entry.meal === args.meal)
    if (entries.length === 0) {
      throw new ConvexError('There is nothing in this meal to save.')
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
