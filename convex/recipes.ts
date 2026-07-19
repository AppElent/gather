import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  nextNutritionStale,
  nutritionSourceValidator,
  nutritionValidator,
} from './lib/nutrition'
import { getCurrentUser, getMyGroupIds, isVisibleTo } from './lib/sharing'

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    if (!user) return []
    const groupIds = await getMyGroupIds(ctx, user._id)
    const all = await ctx.db.query('recipes').collect()
    const visible = all.filter((r) =>
      isVisibleTo(
        { ownerId: r.ownerId, sharedGroupIds: r.sharedGroupIds },
        { userId: user._id, groupIds },
      ),
    )
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
    const visible = isVisibleTo(
      { ownerId: recipe.ownerId, sharedGroupIds: recipe.sharedGroupIds },
      { userId: user._id, groupIds },
    )
    if (!visible) return null
    const imageUrl = recipe.imageId
      ? await ctx.storage.getUrl(recipe.imageId)
      : null
    return { ...recipe, imageUrl }
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
  sharedGroupIds: v.optional(v.array(v.id('groups'))),
  servings: v.optional(v.number()),
  nutrition: v.optional(nutritionValidator),
  nutritionSource: v.optional(nutritionSourceValidator),
}

export const create = mutation({
  args: recipeFields,
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new Error('Not authenticated')
    const { sharedGroupIds, ...rest } = args
    const defaultShare = user.defaultGroupId ? [user.defaultGroupId] : []
    return await ctx.db.insert('recipes', {
      ownerId: user._id,
      sharedGroupIds: sharedGroupIds ?? defaultShare,
      ...rest,
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
    const user = await getCurrentUser(ctx)
    if (!user) throw new Error('Not authenticated')
    const recipe = await ctx.db.get(args.id)
    if (!recipe) throw new Error('Recipe not found')
    if (recipe.ownerId !== user._id) throw new Error('Not the owner')
    const {
      id,
      sharedGroupIds,
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
      ...(sharedGroupIds ? { sharedGroupIds } : {}),
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
    const user = await getCurrentUser(ctx)
    if (!user) throw new Error('Not authenticated')
    const recipe = await ctx.db.get(args.id)
    if (!recipe) throw new Error('Recipe not found')
    if (recipe.ownerId !== user._id) throw new Error('Not the owner')
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
    const user = await getCurrentUser(ctx)
    if (!user) throw new Error('Not authenticated')
    const recipe = await ctx.db.get(args.id)
    if (!recipe) return
    if (recipe.ownerId !== user._id) throw new Error('Not the owner')
    await ctx.db.delete(args.id)
  },
})
