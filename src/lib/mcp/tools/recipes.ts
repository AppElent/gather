import { z } from 'zod'
import { api } from '../../../../convex/_generated/api'
import {
  asId,
  defineTool,
  groupSlug,
  publicDoc,
  ToolInputError,
} from './define'
import { groupId, idempotencyKey, matches } from './shared'

const NOT_FOUND = 'Recipe not found.'
const lines = z.array(z.string().min(1).max(500)).max(200)
const fields = {
  description: z.string().max(2000).optional(),
  ingredients: lines.describe('One ingredient per entry, with its amount'),
  steps: lines.describe('One step per entry, in order'),
  tags: z.array(z.string().min(1).max(40)).max(30),
  prepMinutes: z.number().int().min(0).max(10_000).optional(),
  servings: z.number().int().min(1).max(100).optional(),
  sourceUrl: z.string().url().max(2000).optional(),
  rating: z.number().int().min(1).max(5).optional(),
}

export const recipeTools = [
  defineTool({
    name: 'list_recipes',
    title: 'List recipes',
    description:
      "List the recipes in a Group's collection, including ones shared into it from another Group. Filter by text in the title, description or tags.",
    access: 'read',
    input: {
      groupId,
      query: z.string().max(100).optional(),
      limit: z.number().int().min(1).max(200).default(50),
    },
    async run({ groupId, query, limit }, context) {
      const recipes = await context.backend.query(api.recipes.list, {
        groupSlug: await groupSlug(context, groupId),
      })
      const found = recipes
        .filter((r) => matches(query, r.title, r.description, r.tags))
        .sort((a, b) => a.title.localeCompare(b.title))
      return {
        recipes: found.slice(0, limit).map((r) =>
          publicDoc({
            _id: r._id,
            title: r.title,
            description: r.description,
            tags: r.tags,
            rating: r.rating,
            prepMinutes: r.prepMinutes,
            servings: r.servings,
            sharedFrom: r.homeGroupName ?? undefined,
            canEdit: r.canEdit,
          }),
        ),
        total: found.length,
      }
    },
  }),
  defineTool({
    name: 'get_recipe',
    title: 'Get recipe',
    description:
      'Return one recipe with its ingredients, steps, tags and nutrition, as seen from the given Group.',
    access: 'read',
    input: { groupId, recipeId: z.string().min(1) },
    async run({ groupId, recipeId }, context) {
      const recipe = await context.backend.query(api.recipes.get, {
        groupSlug: await groupSlug(context, groupId),
        id: asId<'recipes'>(recipeId),
      })
      if (!recipe) throw new ToolInputError(NOT_FOUND)
      const { sharedGroups, homeGroupSlug, ...rest } = recipe
      return {
        recipe: publicDoc({
          ...rest,
          sharedWith: sharedGroups.map((g) => g.name),
        }),
      }
    },
  }),
  defineTool({
    name: 'create_recipe',
    title: 'Create recipe',
    description:
      "Add a recipe to a Group's collection. Ingredients and steps are lists of plain lines.",
    access: 'write',
    input: {
      groupId,
      idempotencyKey,
      title: z.string().min(1).max(200),
      ...fields,
    },
    async run({ groupId, ...input }, context) {
      const id = await context.backend.mutation(api.recipes.create, {
        groupSlug: await groupSlug(context, groupId),
        ...input,
      })
      return { recipeId: id }
    },
  }),
  defineTool({
    name: 'update_recipe',
    title: 'Update recipe',
    description:
      'Change a recipe that lives in the given Group. Only the fields you pass change; lists you pass replace the whole list. description, rating or servings set to null are cleared. A recipe shared in from another Group is changed from its home Group, not here.',
    access: 'write',
    annotations: { idempotentHint: true },
    input: {
      groupId,
      recipeId: z.string().min(1),
      title: z.string().min(1).max(200).optional(),
      description: fields.description.unwrap().nullable().optional(),
      ingredients: lines.optional(),
      steps: lines.optional(),
      tags: fields.tags.optional(),
      prepMinutes: fields.prepMinutes,
      sourceUrl: fields.sourceUrl,
      servings: fields.servings.unwrap().nullable().optional(),
      rating: fields.rating.unwrap().nullable().optional(),
    },
    async run({ groupId, recipeId, ...changes }, context) {
      const slug = await groupSlug(context, groupId)
      const id = asId<'recipes'>(recipeId)
      const current = await context.backend.query(api.recipes.get, {
        groupSlug: slug,
        id,
      })
      // Only a recipe that lives in the named Group is written from it; a
      // shared-in one reads as missing, even to a Member of its home Group.
      if (!current?.canEdit || current.homeGroupSlug !== slug)
        throw new ToolInputError(NOT_FOUND)
      // `recipes.update` takes the whole document, so unchanged fields are
      // sent back as they are.
      await context.backend.mutation(api.recipes.update, {
        id,
        title: changes.title ?? current.title,
        description:
          changes.description === null
            ? ''
            : (changes.description ?? current.description),
        ingredients: changes.ingredients ?? current.ingredients,
        steps: changes.steps ?? current.steps,
        tags: changes.tags ?? current.tags,
        prepMinutes: changes.prepMinutes ?? current.prepMinutes,
        sourceUrl: changes.sourceUrl ?? current.sourceUrl,
        servings:
          changes.servings === undefined ? current.servings : changes.servings,
        rating: changes.rating === undefined ? current.rating : changes.rating,
      })
      return { recipeId: id, updated: true }
    },
  }),
]
