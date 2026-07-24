import { ConvexError, v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import { requireBabyAccess } from './lib/babyAccess'
import { getCurrentUser, getMyGroupIds } from './lib/sharing'
import type { MutationCtx } from './_generated/server'
import { mutation, query } from './_generated/server'

/** Babies for the viewer's default group; null = no default group set. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    if (!user?.defaultGroupId) return null
    const groupId = user.defaultGroupId
    const babies = await ctx.db
      .query('babies')
      .withIndex('by_group', (q) => q.eq('groupId', groupId))
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
  args: { id: v.id('babies') },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) return null
    const baby = await ctx.db.get(args.id)
    if (!baby) return null
    const groupIds = await getMyGroupIds(ctx, user._id)
    if (!groupIds.includes(baby.groupId)) return null
    const photoUrl = baby.photoId ? await ctx.storage.getUrl(baby.photoId) : null
    return { ...baby, photoUrl }
  },
})

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new ConvexError('Not authenticated')
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
    name: v.string(),
    birthDate: v.string(),
    sex: v.optional(sexValidator),
    photoId: v.optional(v.id('_storage')),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new ConvexError('Not authenticated')
    if (!user.defaultGroupId) {
      throw new ConvexError('Set a default group on the Groups page first')
    }
    const groupId = user.defaultGroupId
    const existing = await ctx.db
      .query('babies')
      .withIndex('by_group', (q) => q.eq('groupId', groupId))
      .collect()
    const nextOrder =
      existing.reduce((max, b) => Math.max(max, b.order), -1) + 1
    return await ctx.db.insert('babies', {
      groupId,
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
  field: 'taskListId' | 'questionsListId',
  listName: string,
) {
  const existingListId = baby[field]
  if (existingListId) return existingListId
  const existing = await ctx.db
    .query('taskLists')
    .withIndex('by_group', (q) => q.eq('groupId', baby.groupId))
    .collect()
  const nextOrder = existing.reduce((max, l) => Math.max(max, l.order), -1) + 1
  const listId = await ctx.db.insert('taskLists', {
    groupId: baby.groupId,
    name: listName,
    provider: 'local',
    order: nextOrder,
  })
  await ctx.db.patch(baby._id, { [field]: listId })
  return listId
}

export const ensureTodoList = mutation({
  args: { id: v.id('babies') },
  handler: async (ctx, args) => {
    const { baby } = await requireBabyAccess(ctx, args.id)
    return await ensureAuxTaskList(
      ctx,
      baby,
      'taskListId',
      `${baby.name} to-dos`,
    )
  },
})

export const ensureQuestionsList = mutation({
  args: { id: v.id('babies') },
  handler: async (ctx, args) => {
    const { baby } = await requireBabyAccess(ctx, args.id)
    return await ensureAuxTaskList(
      ctx,
      baby,
      'questionsListId',
      `${baby.name} questions`,
    )
  },
})

export const update = mutation({
  args: {
    id: v.id('babies'),
    name: v.string(),
    birthDate: v.string(),
    sex: v.optional(v.union(sexValidator, v.null())),
    photoId: v.optional(v.union(v.id('_storage'), v.null())),
  },
  handler: async (ctx, args) => {
    await requireBabyAccess(ctx, args.id)
    const { id, sex, photoId, ...rest } = args
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

export const remove = mutation({
  args: { id: v.id('babies') },
  handler: async (ctx, args) => {
    const { baby } = await requireBabyAccess(ctx, args.id)
    const events = await ctx.db
      .query('babyEvents')
      .withIndex('by_baby', (q) => q.eq('babyId', args.id))
      .collect()
    await Promise.all(events.map((e) => ctx.db.delete(e._id)))
    await deleteAuxTaskList(ctx, baby.taskListId)
    await deleteAuxTaskList(ctx, baby.questionsListId)
    await ctx.db.delete(args.id)
  },
})
