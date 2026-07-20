import { ConvexError, v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { internalQuery, mutation, query } from './_generated/server'
import {
  nextNutritionStale,
  nutritionSourceValidator,
  nutritionValidator,
} from './lib/nutrition'
import { getCurrentUser, getMyGroupIds, isVisibleTo } from './lib/sharing'
import { requireActiveSpace } from './lib/spaceAuth'

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

const recipePatchFields = {
  title: v.optional(v.string()),
  description: v.optional(v.string()),
  imageId: v.optional(v.union(v.id('_storage'), v.null())),
  ingredients: v.optional(v.array(v.string())),
  steps: v.optional(v.array(v.string())),
  tags: v.optional(v.array(v.string())),
  rating: v.optional(v.union(v.number(), v.null())),
  prepMinutes: v.optional(v.union(v.number(), v.null())),
  sourceUrl: v.optional(v.union(v.string(), v.null())),
  sharedGroupIds: v.optional(v.array(v.id('groups'))),
  servings: v.optional(v.union(v.number(), v.null())),
  nutrition: v.optional(v.union(nutritionValidator, v.null())),
  nutritionSource: v.optional(v.union(nutritionSourceValidator, v.null())),
}

type SpaceContext = Parameters<typeof requireActiveSpace>[0]

async function requireRecipesModuleEnabled(
  ctx: { db: Parameters<typeof requireActiveSpace>[0]['db'] },
  spaceId: Id<'spaces'>,
) {
  const module = await ctx.db
    .query('spaceModules')
    .withIndex('by_space_module', (q) =>
      q.eq('spaceId', spaceId).eq('moduleId', 'recipes'),
    )
    .unique()
  if (!module || module.state !== 'enabled') {
    throw new ConvexError('Recipes is not enabled')
  }
}

async function requireRecipeInSpace(
  ctx: SpaceContext,
  spaceSlug: string,
  id: Id<'recipes'>,
) {
  const { space, user } = await requireActiveSpace(ctx, { spaceSlug })
  await requireRecipesModuleEnabled(ctx, space._id)
  const recipe = await ctx.db.get(id)
  if (!recipe) return { recipe: null, space, user }
  if (recipe.spaceId !== space._id) {
    throw new ConvexError('Recipe does not belong to this Space')
  }
  return { recipe, space, user }
}

async function visibleLegacyRecipe(
  ctx: SpaceContext,
  id: Id<'recipes'>,
  requireOwner = false,
) {
  const user = await getCurrentUser(ctx)
  if (!user) throw new ConvexError('Not authenticated')
  const recipe = await ctx.db.get(id)
  if (!recipe || recipe.ownerId === undefined) {
    throw new ConvexError('Recipe not found')
  }
  if (requireOwner && recipe.ownerId !== user._id) {
    throw new ConvexError('Not the owner')
  }
  const groupIds = await getMyGroupIds(ctx, user._id)
  if (
    !isVisibleTo(
      {
        ownerId: recipe.ownerId,
        sharedGroupIds: recipe.sharedGroupIds ?? [],
      },
      { userId: user._id, groupIds },
    )
  ) {
    throw new ConvexError('Recipe not found')
  }
  return { recipe, user }
}

async function listLegacyRecipes(ctx: SpaceContext) {
  const user = await getCurrentUser(ctx)
  if (!user) return []
  const groupIds = await getMyGroupIds(ctx, user._id)
  const recipes = await ctx.db.query('recipes').collect()
  return recipes.filter((recipe) => {
    if (recipe.ownerId === undefined) return false
    return isVisibleTo(
      {
        ownerId: recipe.ownerId,
        sharedGroupIds: recipe.sharedGroupIds ?? [],
      },
      { userId: user._id, groupIds },
    )
  })
}

export const list = query({
  args: { spaceSlug: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.spaceSlug) {
      const { space } = await requireActiveSpace(ctx, { spaceSlug: args.spaceSlug })
      await requireRecipesModuleEnabled(ctx, space._id)
      const recipes = await ctx.db
        .query('recipes')
        .withIndex('by_space', (q) => q.eq('spaceId', space._id))
        .collect()
      return await Promise.all(
        recipes.map(async (recipe) => ({
          ...recipe,
          imageUrl: recipe.imageId
            ? await ctx.storage.getUrl(recipe.imageId)
            : null,
        })),
      )
    }

    const recipes = await listLegacyRecipes(ctx)
    return await Promise.all(
      recipes.map(async (recipe) => ({
        ...recipe,
        imageUrl: recipe.imageId
          ? await ctx.storage.getUrl(recipe.imageId)
          : null,
      })),
    )
  },
})

export const get = query({
  args: { id: v.id('recipes'), spaceSlug: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const recipe = args.spaceSlug
      ? (await requireRecipeInSpace(ctx, args.spaceSlug, args.id)).recipe
      : (await visibleLegacyRecipe(ctx, args.id)).recipe
    if (!recipe) return null
    return {
      ...recipe,
      imageUrl: recipe.imageId ? await ctx.storage.getUrl(recipe.imageId) : null,
    }
  },
})

export const generateUploadUrl = mutation({
  args: { spaceSlug: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.spaceSlug) {
      const { space } = await requireActiveSpace(ctx, { spaceSlug: args.spaceSlug })
      await requireRecipesModuleEnabled(ctx, space._id)
    } else if (!(await getCurrentUser(ctx))) {
      throw new ConvexError('Not authenticated')
    }
    return await ctx.storage.generateUploadUrl()
  },
})

export const create = mutation({
  args: { spaceSlug: v.optional(v.string()), ...recipeFields },
  handler: async (ctx, args) => {
    const { spaceSlug: _spaceSlug, ...fields } = args
    const now = Date.now()

    if (args.spaceSlug) {
      const { space, user } = await requireActiveSpace(ctx, { spaceSlug: args.spaceSlug })
      await requireRecipesModuleEnabled(ctx, space._id)
      return await ctx.db.insert('recipes', {
        spaceId: space._id,
        createdByUserId: user._id,
        ownerId: user._id,
        sharedGroupIds: fields.sharedGroupIds ?? [],
        ...fields,
        createdAt: now,
        updatedAt: now,
      })
    }

    const user = await getCurrentUser(ctx)
    if (!user) throw new ConvexError('Not authenticated')
    return await ctx.db.insert('recipes', {
      ownerId: user._id,
      sharedGroupIds: fields.sharedGroupIds ?? [],
      ...fields,
    })
  },
})

export const update = mutation({
  args: {
    spaceSlug: v.optional(v.string()),
    id: v.id('recipes'),
    ...recipePatchFields,
  },
  handler: async (ctx, args) => {
    const recipe = args.spaceSlug
      ? (await requireRecipeInSpace(ctx, args.spaceSlug, args.id)).recipe
      : (await visibleLegacyRecipe(ctx, args.id, true)).recipe
    if (!recipe) throw new ConvexError('Recipe not found')

    const {
      id: _id,
      spaceSlug: _spaceSlug,
      imageId,
      rating,
      prepMinutes,
      sourceUrl,
      servings,
      nutrition,
      nutritionSource,
      sharedGroupIds,
      ...fields
    } = args
    const nextServings =
      servings === null ? undefined : (servings ?? recipe.servings)
    const nextNutrition =
      nutrition === null ? undefined : (nutrition ?? recipe.nutrition)
    const stale = nextNutritionStale(recipe, {
      ingredients: fields.ingredients ?? recipe.ingredients,
      servings: nextServings,
      nutrition: nextNutrition,
    })

    await ctx.db.patch(args.id, {
      ...fields,
      ...(imageId !== undefined ? { imageId: imageId ?? undefined } : {}),
      ...(rating !== undefined ? { rating: rating ?? undefined } : {}),
      ...(sharedGroupIds !== undefined ? { sharedGroupIds } : {}),
      servings: nextServings,
      nutrition: nextNutrition,
      nutritionSource: nextNutrition
        ? nutritionSource === null
          ? undefined
          : (nutritionSource ?? recipe.nutritionSource)
        : undefined,
      nutritionStale: stale || undefined,
      updatedAt: Date.now(),
    })
  },
})

export const setNutrition = mutation({
  args: {
    spaceSlug: v.optional(v.string()),
    id: v.id('recipes'),
    nutrition: nutritionValidator,
    source: v.union(v.literal('ai'), v.literal('manual')),
  },
  handler: async (ctx, args) => {
    const recipe = args.spaceSlug
      ? (await requireRecipeInSpace(ctx, args.spaceSlug, args.id)).recipe
      : (await visibleLegacyRecipe(ctx, args.id, true)).recipe
    if (!recipe) throw new ConvexError('Recipe not found')
    await ctx.db.patch(args.id, {
      nutrition: args.nutrition,
      nutritionSource: args.source,
      nutritionStale: undefined,
      updatedAt: Date.now(),
    })
  },
})

/** Whether the AI-estimation features are configured on this deployment. */
export const aiConfigured = query({
  args: {},
  handler: async () => Boolean(process.env.ANTHROPIC_API_KEY),
})

export const remove = mutation({
  args: { spaceSlug: v.string(), id: v.id('recipes') },
  handler: async (ctx, args) => {
    const { recipe } = await requireRecipeInSpace(ctx, args.spaceSlug, args.id)
    if (!recipe) return
    if (recipe.imageId) await ctx.storage.delete(recipe.imageId)
    await ctx.db.delete(args.id)
  },
})

export const requireRecipesModuleForAction = internalQuery({
  args: { spaceId: v.id('spaces') },
  handler: async (ctx, args) =>
    await requireRecipesModuleEnabled(ctx, args.spaceId),
})
