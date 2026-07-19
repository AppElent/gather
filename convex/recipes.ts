import { ConvexError, v } from 'convex/values'
import { internalQuery, mutation, query } from './_generated/server'
import type { Id } from './_generated/dataModel'
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
}

const recipePatchFields = {
  title: v.optional(v.string()),
  description: v.optional(v.string()),
  imageId: v.optional(v.union(v.id('_storage'), v.null())),
  ingredients: v.optional(v.array(v.string())),
  steps: v.optional(v.array(v.string())),
  tags: v.optional(v.array(v.string())),
  rating: v.optional(v.union(v.number(), v.null())),
  prepMinutes: v.optional(v.number()),
  sourceUrl: v.optional(v.string()),
}

async function requireRecipeInSpace(
  ctx: Parameters<typeof requireActiveSpace>[0],
  spaceSlug: string,
  id: Id<'recipes'>,
) {
  const { space, user } = await requireActiveSpace(ctx, { spaceSlug })
  const recipe = await ctx.db.get(id)
  if (!recipe) return { recipe: null, space, user }
  if (recipe.spaceId !== space._id) {
    throw new ConvexError('Recipe does not belong to this Space')
  }
  return { recipe, space, user }
}

export const list = query({
  args: { spaceSlug: v.string() },
  handler: async (ctx, args) => {
    const { space } = await requireActiveSpace(ctx, { spaceSlug: args.spaceSlug })
    const recipes = await ctx.db
      .query('recipes')
      .withIndex('by_space', (q) => q.eq('spaceId', space._id))
      .collect()
    return await Promise.all(recipes.map(async (recipe) => ({
      ...recipe,
      imageUrl: recipe.imageId ? await ctx.storage.getUrl(recipe.imageId) : null,
    })))
  },
})

export const get = query({
  args: { spaceSlug: v.string(), id: v.id('recipes') },
  handler: async (ctx, args) => {
    const { recipe } = await requireRecipeInSpace(ctx, args.spaceSlug, args.id)
    if (!recipe) return null
    return {
      ...recipe,
      imageUrl: recipe.imageId ? await ctx.storage.getUrl(recipe.imageId) : null,
    }
  },
})

export const generateUploadUrl = mutation({
  args: { spaceSlug: v.string() },
  handler: async (ctx, args) => {
    await requireActiveSpace(ctx, { spaceSlug: args.spaceSlug })
    return await ctx.storage.generateUploadUrl()
  },
})

export const create = mutation({
  args: { spaceSlug: v.string(), ...recipeFields },
  handler: async (ctx, args) => {
    const { space, user } = await requireActiveSpace(ctx, { spaceSlug: args.spaceSlug })
    const { spaceSlug: _spaceSlug, ...fields } = args
    const now = Date.now()
    return await ctx.db.insert('recipes', {
      spaceId: space._id,
      createdByUserId: user._id,
      ...fields,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const update = mutation({
  args: {
    spaceSlug: v.string(),
    id: v.id('recipes'),
    ...recipePatchFields,
  },
  handler: async (ctx, args) => {
    const { recipe } = await requireRecipeInSpace(ctx, args.spaceSlug, args.id)
    if (!recipe) throw new ConvexError('Recipe not found')
    const { id, spaceSlug: _spaceSlug, imageId, rating, ...fields } = args
    await ctx.db.patch(id, {
      ...fields,
      ...(imageId !== undefined ? { imageId: imageId ?? undefined } : {}),
      ...(rating !== undefined ? { rating: rating ?? undefined } : {}),
      updatedAt: Date.now(),
    })
  },
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
  handler: async (ctx, args) => {
    const module = await ctx.db
      .query('spaceModules')
      .withIndex('by_space_module', (q) =>
        q.eq('spaceId', args.spaceId).eq('moduleId', 'recipes'),
      )
      .unique()
    if (module?.state !== 'enabled') throw new ConvexError('Recipes is not enabled')
  },
})
