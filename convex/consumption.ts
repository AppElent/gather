import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  computeFoodEntryNutrition,
  computeRecipeEntryNutrition,
  mealValidator,
  quantityUnitValidator,
  scaleFacts,
} from './lib/consumption'
import { withImageUrl } from './foods'
import { isVisibleToGroups } from './lib/groupAccess'
import { NUTRIENT_KEYS, type NutritionFacts, nutritionValidator } from './lib/nutrition'
import {
  rankLoggedAmounts,
  rankMealChoices,
  suggestionWindowStart,
} from './lib/servings'
import { getCurrentUser, getMyGroupIds } from './lib/sharing'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'

function assertValidNutrition(nutrition: NutritionFacts) {
  for (const key of NUTRIENT_KEYS) {
    const value = nutrition[key]
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
      throw new Error(`${key} must be a non-negative number`)
    }
  }
}

/**
 * Provenance, permission-checked on read (ADR-0003).
 *
 * The reference survives on the entry only while the caller can still see the
 * recipe. A recipe that was deleted and a recipe that is no longer visible to
 * this caller drop it in precisely the same way — there is one branch and it
 * cannot tell them apart — so nothing about how a diary entry reads can be used
 * to find out that a recipe exists somewhere.
 *
 * What the entry recorded is untouched either way: the label, the quantity and
 * the nutrition are a snapshot, and a snapshot does not change because the
 * thing it was taken from did.
 */
async function visibleRecipeId(
  ctx: QueryCtx,
  recipeId: Id<'recipes'> | undefined,
  viewerGroupIds: Id<'groups'>[],
): Promise<Id<'recipes'> | undefined> {
  if (!recipeId) return undefined
  const recipe = await ctx.db.get(recipeId)
  if (!recipe || !isVisibleToGroups(recipe, viewerGroupIds)) return undefined
  return recipeId
}

export const listForDay = query({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) return []
    const entries = await ctx.db
      .query('consumptionEntries')
      .withIndex('by_user_date', (q) =>
        q.eq('userId', user._id).eq('date', args.date),
      )
      .collect()
    const viewerGroupIds = await getMyGroupIds(ctx, user._id)
    return await Promise.all(
      entries.map(async (entry) => ({
        ...entry,
        recipeId: await visibleRecipeId(ctx, entry.recipeId, viewerGroupIds),
      })),
    )
  },
})

/**
 * The amounts you have logged for one food before, most-used first.
 *
 * Your own history is the third source of servings (#68) and the only one that
 * covers a Catalog food, which nobody may edit (ADR-0004). It is yours alone:
 * the entries are read off your own diary, and there is no argument by which
 * one person can ask about another's.
 */
export const loggedAmountsForFood = query({
  args: { foodId: v.id('foods') },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) return []
    const food = await ctx.db.get(args.foodId)
    if (!food) return []
    const entries = await ctx.db
      .query('consumptionEntries')
      .withIndex('by_user_food', (q) =>
        q.eq('userId', user._id).eq('foodId', args.foodId),
      )
      .collect()
    return rankLoggedAmounts(entries, food.baseUnit)
  },
})

/**
 * How many diary rows the empty sheet will read to work out a habit.
 *
 * The date window is the real bound; this is the second one, for the person
 * who logs a dozen things a day and would otherwise turn "what do I usually
 * have for breakfast" into a two-month scan. Entries come back newest-first,
 * so what a cap this size drops is always the oldest of a very full window.
 */
const SUGGESTION_SCAN_LIMIT = 400

/**
 * What the add sheet opens on: the foods and recipes you usually have at this
 * meal, most-chosen first (#76).
 *
 * The sheet used to open on every recipe you own and none of your foods, which
 * read as broken — foods came from a search that returns nothing for an empty
 * term, and recipes came from a list with no bound on it. Both sections are
 * answered from your own diary now, ranked the same way and bounded to the
 * same handful. Anything you have never logged is behind the search box, which
 * is where a thing you have to think about belongs.
 *
 * The meal is an argument because the answer differs by meal — that is the
 * point of it (#73). The date is an argument too: the window is measured back
 * from the day being logged, so opening the sheet on a day last month asks
 * about the habits of that month.
 *
 * Yours alone, like every other read of your diary: the entries are found by
 * your user id and there is no argument by which one person can ask about
 * another's. A recipe you can no longer see drops out here exactly as it drops
 * out of `listForDay` (ADR-0003).
 */
export const suggestionsForMeal = query({
  args: { date: v.string(), meal: mealValidator },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) return { foods: [], recipes: [] }
    const since = suggestionWindowStart(args.date)
    const entries = await ctx.db
      .query('consumptionEntries')
      .withIndex('by_user_date', (q) =>
        q.eq('userId', user._id).gte('date', since),
      )
      .order('desc')
      .take(SUGGESTION_SCAN_LIMIT)
    const { foodIds, recipeIds } = rankMealChoices(entries, {
      meal: args.meal,
      since,
    })

    const foodDocs = await Promise.all(foodIds.map((id) => ctx.db.get(id)))
    const foods = await Promise.all(
      foodDocs
        .filter((food) => food !== null)
        .map((food) => withImageUrl(ctx, food)),
    )

    const viewerGroupIds = await getMyGroupIds(ctx, user._id)
    const recipeDocs = await Promise.all(recipeIds.map((id) => ctx.db.get(id)))
    // Only what a card can be built from: a recipe with no nutrition has
    // nothing to log, and one this reader may no longer see is not offered
    // back to them by their own history.
    const recipes = []
    for (const recipe of recipeDocs) {
      if (!recipe || !recipe.nutrition) continue
      if (!isVisibleToGroups(recipe, viewerGroupIds)) continue
      recipes.push({
        _id: recipe._id,
        title: recipe.title,
        nutrition: recipe.nutrition,
      })
    }

    return { foods, recipes }
  },
})

export const create = mutation({
  args: {
    date: v.string(),
    meal: mealValidator,
    recipeId: v.optional(v.id('recipes')),
    foodId: v.optional(v.id('foods')),
    label: v.string(),
    quantity: v.number(),
    quantityUnit: quantityUnitValidator,
    nutrition: nutritionValidator,
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new Error('Not authenticated')
    if (args.recipeId && args.foodId) {
      throw new Error('An entry cannot reference both a recipe and a food')
    }
    if (args.quantity <= 0) throw new Error('Quantity must be positive')
    assertValidNutrition(args.nutrition)
    return await ctx.db.insert('consumptionEntries', {
      userId: user._id,
      ...args,
    })
  },
})

/**
 * Write several entries at once — what confirming a Combo does.
 *
 * One mutation rather than a loop of `create` calls from the client, so a
 * Combo's entries land together or not at all, and so undo has every id it
 * needs to take all of them back. The per-entry rules are `create`'s, applied
 * to each.
 */
export const createMany = mutation({
  args: {
    date: v.string(),
    meal: mealValidator,
    entries: v.array(
      v.object({
        recipeId: v.optional(v.id('recipes')),
        foodId: v.optional(v.id('foods')),
        label: v.string(),
        quantity: v.number(),
        quantityUnit: quantityUnitValidator,
        nutrition: nutritionValidator,
      }),
    ),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new Error('Not authenticated')
    const ids: Id<'consumptionEntries'>[] = []
    for (const entry of args.entries) {
      if (entry.recipeId && entry.foodId) {
        throw new Error('An entry cannot reference both a recipe and a food')
      }
      if (entry.quantity <= 0) throw new Error('Quantity must be positive')
      assertValidNutrition(entry.nutrition)
      ids.push(
        await ctx.db.insert('consumptionEntries', {
          userId: user._id,
          date: args.date,
          meal: args.meal,
          ...entry,
        }),
      )
    }
    return ids
  },
})

// On a quantity change, nutrition is recomputed from the current recipe/food
// values when the source still exists (spec §4.5); if the source was
// deleted, the existing snapshot is scaled proportionally instead so the
// entry still reflects the new quantity without needing source data. A
// recipe that still exists but is no longer visible to the entry's owner
// (they have left its Group since logging it) is treated the same as
// deleted — recomputing from it would leak nutrition data the owner is no
// longer authorized to see, and the two must be indistinguishable anyway.
// Foods have no sharing/visibility model (spec §3.3: "readable by any
// authenticated user"), so no check is needed there.
async function recomputeFromSource(
  ctx: MutationCtx,
  entry: Doc<'consumptionEntries'>,
  quantity: number,
  viewerGroupIds: Id<'groups'>[],
): Promise<NutritionFacts | null> {
  if (entry.recipeId) {
    const recipe = await ctx.db.get(entry.recipeId)
    const visible = recipe && isVisibleToGroups(recipe, viewerGroupIds)
    return visible && recipe.nutrition
      ? computeRecipeEntryNutrition(recipe.nutrition, quantity)
      : null
  }
  if (entry.foodId) {
    const food = await ctx.db.get(entry.foodId)
    // Food entries never use 'serving' (only recipe entries do), but the
    // schema's quantityUnit field is the full 4-member union — narrow to
    // the 3 units computeFoodEntryNutrition actually accepts.
    return food
      ? computeFoodEntryNutrition(
          food,
          quantity,
          entry.quantityUnit as 'g' | 'ml' | 'piece',
        )
      : null
  }
  return null
}

export const update = mutation({
  args: {
    id: v.id('consumptionEntries'),
    date: v.optional(v.string()),
    meal: v.optional(mealValidator),
    quantity: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new Error('Not authenticated')
    const entry = await ctx.db.get(args.id)
    if (!entry) throw new Error('Entry not found')
    if (entry.userId !== user._id) throw new Error('Not the owner')

    let nutrition = entry.nutrition
    let quantity = entry.quantity
    if (args.quantity !== undefined && args.quantity !== entry.quantity) {
      if (args.quantity <= 0) throw new Error('Quantity must be positive')
      quantity = args.quantity
      const viewerGroupIds = await getMyGroupIds(ctx, user._id)
      const recomputed = await recomputeFromSource(
        ctx,
        entry,
        quantity,
        viewerGroupIds,
      )
      nutrition = recomputed ?? scaleFacts(entry.nutrition, quantity / entry.quantity)
    }

    await ctx.db.patch(args.id, {
      ...(args.date !== undefined ? { date: args.date } : {}),
      ...(args.meal !== undefined ? { meal: args.meal } : {}),
      quantity,
      nutrition,
    })
  },
})

export const remove = mutation({
  args: { id: v.id('consumptionEntries') },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new Error('Not authenticated')
    const entry = await ctx.db.get(args.id)
    if (!entry) return
    if (entry.userId !== user._id) throw new Error('Not the owner')
    await ctx.db.delete(args.id)
  },
})
