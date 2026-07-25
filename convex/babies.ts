import { v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import { requireBabyAccess, requireBabyLogSpace } from './lib/babyAccess'
import type { MutationCtx } from './_generated/server'
import { mutation, query } from './_generated/server'

/** Babies in the given Space, ordered. */
export const list = query({
  args: { spaceSlug: v.string() },
  handler: async (ctx, args) => {
    const { space } = await requireBabyLogSpace(ctx, args.spaceSlug)
    const babies = await ctx.db
      .query('babies')
      .withIndex('by_space', (q) => q.eq('spaceId', space._id))
      .collect()
    return await Promise.all(
      babies
        .sort((a, b) => a.order - b.order)
        .map(async (b) => ({
          ...b,
          photoUrl: b.photoId ? await ctx.storage.getUrl(b.photoId) : null,
        })),
    )
  },
})

export const get = query({
  args: { spaceSlug: v.string(), id: v.id('babies') },
  handler: async (ctx, args) => {
    const { space } = await requireBabyLogSpace(ctx, args.spaceSlug)
    const baby = await ctx.db.get(args.id)
    if (!baby || baby.spaceId !== space._id) return null
    const photoUrl = baby.photoId ? await ctx.storage.getUrl(baby.photoId) : null
    return { ...baby, photoUrl }
  },
})

export const generateUploadUrl = mutation({
  args: { spaceSlug: v.string() },
  handler: async (ctx, args) => {
    await requireBabyLogSpace(ctx, args.spaceSlug)
    return await ctx.storage.generateUploadUrl()
  },
})

const sexValidator = v.union(
  v.literal('female'),
  v.literal('male'),
  v.literal('unspecified'),
)

export const create = mutation({
  args: {
    spaceSlug: v.string(),
    name: v.string(),
    birthDate: v.string(),
    sex: v.optional(sexValidator),
    photoId: v.optional(v.id('_storage')),
  },
  handler: async (ctx, args) => {
    const { space } = await requireBabyLogSpace(ctx, args.spaceSlug)
    const existing = await ctx.db
      .query('babies')
      .withIndex('by_space', (q) => q.eq('spaceId', space._id))
      .collect()
    const nextOrder =
      existing.reduce((max, b) => Math.max(max, b.order), -1) + 1
    return await ctx.db.insert('babies', {
      spaceId: space._id,
      name: args.name,
      birthDate: args.birthDate,
      sex: args.sex,
      photoId: args.photoId,
      order: nextOrder,
    })
  },
})

/** Lazily creates a local taskList backing one of the baby's pinned
 * checklist cards (to-dos, questions) — reuses the Tasks module instead of
 * a parallel concept per card. `field` is which column on `babies` stores
 * the resulting list id. */
async function ensureAuxTaskList(
  ctx: MutationCtx,
  baby: Doc<'babies'>,
  spaceId: Id<'spaces'>,
  field: 'taskListId' | 'questionsListId',
  listName: string,
) {
  const existingListId = baby[field]
  if (existingListId) return existingListId
  const existing = await ctx.db
    .query('taskLists')
    .withIndex('by_space', (q) => q.eq('spaceId', spaceId))
    .collect()
  const nextOrder = existing.reduce((max, l) => Math.max(max, l.order), -1) + 1
  const listId = await ctx.db.insert('taskLists', {
    spaceId,
    name: listName,
    provider: 'local',
    order: nextOrder,
  })
  await ctx.db.patch(baby._id, { [field]: listId })
  return listId
}

export const ensureTodoList = mutation({
  args: { spaceSlug: v.string(), id: v.id('babies') },
  handler: async (ctx, args) => {
    const { baby, space } = await requireBabyAccess(
      ctx,
      args.spaceSlug,
      args.id,
    )
    return await ensureAuxTaskList(
      ctx,
      baby,
      space._id,
      'taskListId',
      `${baby.name} to-dos`,
    )
  },
})

export const ensureQuestionsList = mutation({
  args: { spaceSlug: v.string(), id: v.id('babies') },
  handler: async (ctx, args) => {
    const { baby, space } = await requireBabyAccess(
      ctx,
      args.spaceSlug,
      args.id,
    )
    return await ensureAuxTaskList(
      ctx,
      baby,
      space._id,
      'questionsListId',
      `${baby.name} questions`,
    )
  },
})

export const update = mutation({
  args: {
    spaceSlug: v.string(),
    id: v.id('babies'),
    name: v.string(),
    birthDate: v.string(),
    sex: v.optional(v.union(sexValidator, v.null())),
    photoId: v.optional(v.union(v.id('_storage'), v.null())),
  },
  handler: async (ctx, args) => {
    await requireBabyAccess(ctx, args.spaceSlug, args.id)
    const { id, spaceSlug: _spaceSlug, sex, photoId, ...rest } = args
    await ctx.db.patch(id, {
      ...rest,
      ...(sex !== undefined ? { sex: sex ?? undefined } : {}),
      ...(photoId !== undefined ? { photoId: photoId ?? undefined } : {}),
    })
  },
})

async function deleteAuxTaskList(
  ctx: MutationCtx,
  taskListId: Id<'taskLists'> | undefined,
) {
  if (!taskListId) return
  const tasks = await ctx.db
    .query('tasks')
    .withIndex('by_list', (q) => q.eq('listId', taskListId))
    .collect()
  await Promise.all(tasks.map((t) => ctx.db.delete(t._id)))
  await ctx.db.delete(taskListId)
}

/** Delete a baby and everything hanging off it. Shared with the Space-level
 * module cleanup so both paths cascade identically. */
export async function deleteBabyCascade(ctx: MutationCtx, baby: Doc<'babies'>) {
  const events = await ctx.db
    .query('babyEvents')
    .withIndex('by_baby', (q) => q.eq('babyId', baby._id))
    .collect()
  await Promise.all(events.map((e) => ctx.db.delete(e._id)))
  await deleteAuxTaskList(ctx, baby.taskListId)
  await deleteAuxTaskList(ctx, baby.questionsListId)
  if (baby.photoId) await ctx.storage.delete(baby.photoId)
  await ctx.db.delete(baby._id)
}

export const remove = mutation({
  args: { spaceSlug: v.string(), id: v.id('babies') },
  handler: async (ctx, args) => {
    const { baby } = await requireBabyAccess(ctx, args.spaceSlug, args.id)
    await deleteBabyCascade(ctx, baby)
  },
})
