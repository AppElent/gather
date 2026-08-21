import { v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'
import { mutation, query } from './_generated/server'
import {
  getGroupBySlug,
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
import { deleteStoredFile, replaceStoredFile } from './lib/storedFiles'

/** A recipe as every list and detail page wants it: with its picture resolved. */
async function withImageUrl<T extends { imageId?: Id<'_storage'> }>(
  ctx: QueryCtx,
  recipe: T,
) {
  return {
    ...recipe,
    imageUrl: recipe.imageId ? await ctx.storage.getUrl(recipe.imageId) : null,
  }
}

/**
 * A Group's recipe collection: the recipes that live in it, and the recipes
 * shared into it from elsewhere.
 *
 * The slug is what makes the collection the *Group's* rather than the caller's,
 * so it is required. The slugless form this query used to have unioned in every
 * Group the caller belonged to, which showed two Members standing on the same
 * page different lists — the URL stopped deciding what you see, which is the
 * whole point of ADR-0002. #24 deleted the flat route that needed it and it is
 * gone with it; `listAcrossMyGroups` below is what is left, and it is not a
 * Group's collection and does not pretend to be one.
 */
export const list = query({
  args: { groupSlug: v.string() },
  handler: async (ctx, args) => {
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)

    // The Group's own recipes come off `by_group` exactly. The ones shared
    // *into* it cannot: `sharedGroupIds` is an array, and a Convex index keys
    // on a field's value rather than on membership of one, so there is nothing
    // to look those up by and they are found by reading every recipe.
    //
    // Be clear about what the index buys, because it is not what it looks like:
    // the scan below is still a scan, so this query costs one either way. What
    // the index does is take the Group's own recipes out of it and leave the
    // remaining half in one marked place, so that when a scan stops being
    // affordable there is a single thing to replace (a row per shared Group,
    // indexed, is the obvious replacement) rather than a filter to unpick.
    const own = await ctx.db
      .query('recipes')
      .withIndex('by_group', (q) => q.eq('groupId', group._id))
      .collect()
    const sharedIn = (await ctx.db.query('recipes').collect()).filter(
      (r) => r.groupId !== group._id && r.sharedGroupIds.includes(group._id),
    )

    return await Promise.all(
      [...own, ...sharedIn].map((r) => withImageUrl(ctx, r)),
    )
  },
})

/**
 * Every recipe the caller can reach, across all of their Groups.
 *
 * Deliberately caller-wide, and deliberately not `list`. The food diary is a
 * Personal record that reads the same inside every Group (ADR-0003), so its
 * recipe picker cannot be narrowed to the Group in the URL without offering
 * different recipes depending on which Group the diary happened to be opened
 * from. Nothing that renders a *Group's* page may use this — `list` is that.
 */
export const listAcrossMyGroups = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    if (!user) return []
    const viewerGroupIds = await getMyGroupIds(ctx, user._id)
    const all = await ctx.db.query('recipes').collect()
    return await Promise.all(
      all
        .filter((r) => isVisibleToGroups(r, viewerGroupIds))
        .map((r) => withImageUrl(ctx, r)),
    )
  },
})

/**
 * One recipe, read through the Group the URL claims can see it.
 *
 * The recipe has to be visible *from that Group*: a deep link to
 * `/g/cooking-club/recipes/<id>` answers "not found" for a recipe the caller
 * can only reach through their household, because the URL is claiming something
 * about this recipe and that Group which is not true. Same rule as
 * `babies.get`; asking the caller's memberships instead is the caller-wide
 * shape ADR-0002 removes.
 *
 * Not visible from here and no such recipe are the same answer, so the page
 * cannot be used to find out that a recipe exists somewhere.
 */
export const get = query({
  args: { id: v.id('recipes'), groupSlug: v.string() },
  handler: async (ctx, args) => {
    const { user, group } = await requireGroupBySlug(ctx, args.groupSlug)
    const recipe = await ctx.db.get(args.id)
    if (!recipe || !isVisibleToGroups(recipe, [group._id])) return null

    // Attribution is resolved here rather than shipped to the client as an id:
    // reading a recipe is not a licence to read the `users` table. A row that
    // has since gone comes back as null and the page simply says nothing.
    const addedBy = await ctx.db.get(recipe.createdByUserId)
    // `canEdit` answers the *write* question, not the reading one, because that
    // is what the buttons it governs do. Writing follows the home Group and not
    // the shared list, so a Member of the home Group may change the recipe from
    // whichever of their Groups they are reading it in, and a Group that was
    // only shared it may not change it from anywhere.
    const canEdit =
      (await getMembership(ctx, recipe.groupId, user._id)) !== null
    const homeGroup = await ctx.db.get(recipe.groupId)
    // "Who can see this?" is answered for the Members of the Group it lives in,
    // because they are the people who can change that answer. A Group that was
    // merely shared the recipe is told where it lives — it was handed to them
    // from there — and not the rest of that household's sharing, which is none
    // of its business.
    const sharedGroups = canEdit
      ? (await Promise.all(recipe.sharedGroupIds.map((id) => ctx.db.get(id))))
          .filter((g): g is Doc<'groups'> => g !== null)
          .map((g) => ({ _id: g._id, name: g.name, slug: g.slug }))
      : []

    return {
      ...(await withImageUrl(ctx, recipe)),
      addedByName: addedBy?.name ?? null,
      canEdit,
      homeGroupName: homeGroup?.name ?? null,
      homeGroupSlug: homeGroup?.slug ?? null,
      sharedGroups,
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
 *
 * A recipe the caller may not write and a recipe that is not there are the same
 * null. This used to throw "Not a member of that group", which confirmed that
 * the id was real — the leak #20 closed for babies and `recipes.get` already
 * avoided. Each caller then renders that one null however it renders a missing
 * recipe, and the two cases stay indistinguishable all the way out.
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
  if (!membership) return null
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
    const nextServings =
      servings === null ? undefined : (servings ?? recipe.servings)
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
    // Behind the access check, and only once the row has stopped pointing at
    // the old picture: nothing else in the app can reach it after this.
    await replaceStoredFile(ctx, recipe.imageId, imageId)
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
    // A recipe the caller may not touch takes the same branch, and has to —
    // that is what stops the reply telling a stranger their id was real.
    const recipe = await writableRecipe(ctx, args.id)
    if (!recipe) return
    await ctx.db.delete(args.id)
    // The Groups this was Shared into lose the picture along with the recipe.
    // A Share is standing to read and no claim on the content, so there is
    // nothing of theirs to keep (ADR-0007). After the row is gone, so that the
    // recipe being deleted is not itself counted as still holding the file.
    await deleteStoredFile(ctx, recipe.imageId)
  },
})

/**
 * Move, Share and Unshare — the three verbs that decide which Groups a recipe
 * is visible in (CONTEXT.md).
 *
 * Who may use them: a Member of the recipe's home Group. The looser reading —
 * anyone who can already *see* it — includes seeing it through a Share, and a
 * cooking club that was shown a household's recipe must not be able to move it
 * out from under the household. So `writableRecipe` gates all three, exactly as
 * it gates editing: writing follows the home Group, not the shared list.
 *
 * Where they may point: for Move and Share, a Group the caller is a Member of.
 * Putting content into a Group you are not in is pushing it at strangers.
 * Unshare is the exception and deliberately so — it only ever *removes*
 * visibility, and requiring membership there would leave a Share into a Group
 * the sharer has since left impossible to take back.
 *
 * What they refuse: the recipe is checked before the Group being named, so that
 * someone outside the recipe's home Group is told "Recipe not found" whatever
 * destination they pass, and learns nothing about either.
 */

export const move = mutation({
  args: { id: v.id('recipes'), toGroupSlug: v.string() },
  handler: async (ctx, args) => {
    const recipe = await writableRecipe(ctx, args.id)
    if (!recipe) throw new Error('Recipe not found')
    const { group } = await requireGroupBySlug(ctx, args.toGroupSlug)
    // Already home. Moving somewhere it already lives changes nothing.
    if (group._id === recipe.groupId) return
    await ctx.db.patch(args.id, {
      groupId: group._id,
      // The destination stops being a guest the moment it becomes home —
      // `sharedGroupIds` never contains `groupId` (schema). Shares into *other*
      // Groups are untouched: a move changes where the recipe lives, and the
      // club that was shown it goes on being shown it.
      sharedGroupIds: recipe.sharedGroupIds.filter((id) => id !== group._id),
    })
  },
})

export const share = mutation({
  args: { id: v.id('recipes'), withGroupSlug: v.string() },
  handler: async (ctx, args) => {
    const recipe = await writableRecipe(ctx, args.id)
    if (!recipe) throw new Error('Recipe not found')
    const { group } = await requireGroupBySlug(ctx, args.withGroupSlug)
    // Sharing with the Group it lives in, and sharing twice, both ask for
    // something that is already true.
    if (group._id === recipe.groupId) return
    if (recipe.sharedGroupIds.includes(group._id)) return
    await ctx.db.patch(args.id, {
      sharedGroupIds: [...recipe.sharedGroupIds, group._id],
    })
  },
})

export const unshare = mutation({
  args: { id: v.id('recipes'), withGroupSlug: v.string() },
  handler: async (ctx, args) => {
    const recipe = await writableRecipe(ctx, args.id)
    if (!recipe) throw new Error('Recipe not found')
    const group = await getGroupBySlug(ctx, args.withGroupSlug)
    // Unsharing the home Group is refused rather than quietly ignored: it is
    // not a Share to withdraw, and a recipe visible in no Group at all is not a
    // thing this app can express. Deleting or moving it is the honest answer.
    if (group && group._id === recipe.groupId) {
      throw new Error('A recipe cannot be unshared from the Group it lives in')
    }
    // Nothing to withdraw — an unknown slug and a Group it was never shared
    // with land in the same place a second unshare does.
    if (!group || !recipe.sharedGroupIds.includes(group._id)) return
    await ctx.db.patch(args.id, {
      sharedGroupIds: recipe.sharedGroupIds.filter((id) => id !== group._id),
    })
  },
})
