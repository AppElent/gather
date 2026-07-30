import { v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'
import { mutation, query } from './_generated/server'
import {
  getMembership,
  isVisibleToGroups,
  requireGroupBySlug,
} from './lib/groupAccess'
import {
  nextNutritionStale,
  nutritionSourceValidator,
  nutritionValidator,
} from './lib/nutrition'
import { getCurrentUser, getMyGroupIds } from './lib/sharing'

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    if (!user) return []
    const groupIds = await getMyGroupIds(ctx, user._id)
    const all = await ctx.db.query('recipes').collect()
    const visible = all.filter((r) => isVisibleToGroups(r, groupIds))
    return await Promise.all(
      visible.map(async (r) => ({
        ...r,
        imageUrl: r.imageId ? await ctx.storage.getUrl(r.imageId) : null,
      })),
    )
  },
})

export const get = query({
  args: { id: v.id('recipes') },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) return null
    const recipe = await ctx.db.get(args.id)
    if (!recipe) return null
    const groupIds = await getMyGroupIds(ctx, user._id)
    if (!isVisibleToGroups(recipe, groupIds)) return null
    const imageUrl = recipe.imageId
      ? await ctx.storage.getUrl(recipe.imageId)
      : null
    // Attribution is resolved here rather than shipped to the client as an id:
    // reading a recipe is not a licence to read the `users` table. A row that
    // has since gone comes back as null and the page simply says nothing.
    const addedBy = await ctx.db.get(recipe.createdByUserId)
    return {
      ...recipe,
      imageUrl,
      addedByName: addedBy?.name ?? null,
      canEdit: groupIds.includes(recipe.groupId),
    }
  },
})

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new Error('Not authenticated')
    return await ctx.storage.generateUploadUrl()
  },
})

const recipeFields = {
  title: v.string(),
  description: v.optional(v.string()),
  imageId: v.optional(v.id('_storage')),
  ingredients: v.array(v.string()),
  steps: v.array(v.string()),
  tags: v.array(v.string()),
  rating: v.optional(v.number()),
  prepMinutes: v.optional(v.number()),
  sourceUrl: v.optional(v.string()),
  servings: v.optional(v.number()),
  nutrition: v.optional(nutritionValidator),
  nutritionSource: v.optional(nutritionSourceValidator),
}

/**
 * The recipe behind an id, when the caller may change it — or null when there
 * is no such recipe, which each caller reads differently.
 *
 * Writing follows the home Group and not the shared list: a Share makes content
 * visible in a further Group without moving it, so that Group reads it and no
 * more. Attribution is not consulted at all — inside its Group, the person who
 * added a recipe has exactly the standing of every other Member.
 */
async function writableRecipe(
  ctx: QueryCtx,
  id: Id<'recipes'>,
): Promise<Doc<'recipes'> | null> {
  const user = await getCurrentUser(ctx)
  if (!user) throw new Error('Not authenticated')
  const recipe = await ctx.db.get(id)
  if (!recipe) return null
  const membership = await getMembership(ctx, recipe.groupId, user._id)
  if (!membership) throw new Error('Not a member of that group')
  return recipe
}

export const create = mutation({
  args: { groupSlug: v.string(), ...recipeFields },
  handler: async (ctx, args) => {
    const { groupSlug, ...fields } = args
    // The destination is the Group the caller asked for and nothing else. There
    // is deliberately no fallback to `defaultGroupId`: a recipe landing
    // somewhere the caller did not name is the thing #19 exists to stop.
    const { user, group } = await requireGroupBySlug(ctx, groupSlug)
    return await ctx.db.insert('recipes', {
      groupId: group._id,
      // Sharing a recipe into further Groups is a verb of its own (#25); a new
      // recipe is visible in the one Group it was added to.
      sharedGroupIds: [],
      createdByUserId: user._id,
      ...fields,
    })
  },
})

export const update = mutation({
  args: {
    id: v.id('recipes'),
    ...recipeFields,
    imageId: v.optional(v.union(v.id('_storage'), v.null())),
    rating: v.optional(v.union(v.number(), v.null())),
    servings: v.optional(v.union(v.number(), v.null())),
    nutrition: v.optional(v.union(nutritionValidator, v.null())),
    nutritionSource: v.optional(v.union(nutritionSourceValidator, v.null())),
  },
  handler: async (ctx, args) => {
    const recipe = await writableRecipe(ctx, args.id)
    if (!recipe) throw new Error('Recipe not found')
    const {
      id,
      imageId,
      rating,
      servings,
      nutrition,
      nutritionSource,
      ...rest
    } = args
    const nextServings = servings === null ? undefined : (servings ?? recipe.servings)
    const nextNutrition =
      nutrition === null ? undefined : (nutrition ?? recipe.nutrition)
    const stale = nextNutritionStale(recipe, {
      ingredients: args.ingredients,
      servings: nextServings,
      nutrition: nextNutrition,
    })
    await ctx.db.patch(id, {
      ...rest,
      ...(imageId !== undefined ? { imageId: imageId ?? undefined } : {}),
      ...(rating !== undefined ? { rating: rating ?? undefined } : {}),
      servings: nextServings,
      nutrition: nextNutrition,
      nutritionSource: nextNutrition
        ? nutritionSource === null
          ? undefined
          : (nutritionSource ?? recipe.nutritionSource)
        : undefined,
      nutritionStale: stale || undefined,
    })
  },
})

export const setNutrition = mutation({
  args: {
    id: v.id('recipes'),
    nutrition: nutritionValidator,
    source: v.union(v.literal('ai'), v.literal('manual')),
  },
  handler: async (ctx, args) => {
    const recipe = await writableRecipe(ctx, args.id)
    if (!recipe) throw new Error('Recipe not found')
    await ctx.db.patch(args.id, {
      nutrition: args.nutrition,
      nutritionSource: args.source,
      nutritionStale: undefined,
    })
  },
})

/** Whether the AI-estimation features are configured on this deployment. */
export const aiConfigured = query({
  args: {},
  handler: async () => Boolean(process.env.ANTHROPIC_API_KEY),
})

export const remove = mutation({
  args: { id: v.id('recipes') },
  handler: async (ctx, args) => {
    // Already gone is not an error: deleting twice lands in the same place.
    const recipe = await writableRecipe(ctx, args.id)
    if (!recipe) return
    await ctx.db.delete(args.id)
  },
})
