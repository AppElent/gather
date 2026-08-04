import { ConvexError, v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import { findBabyInGroup, requireBabyAccess } from './lib/babyAccess'
import { requireGroupBySlug } from './lib/groupAccess'
import { getCurrentUser } from './lib/sharing'
import { deleteStoredFile, replaceStoredFile } from './lib/storedFiles'
import type { MutationCtx } from './_generated/server'
import { mutation, query } from './_generated/server'

/**
 * The children in one household's log.
 *
 * The Group comes from the URL and nowhere else (ADR-0002): there is no
 * fallback to a stored default, so this answers for the Group the caller named
 * or refuses outright.
 */
export const list = query({
  args: { groupSlug: v.string() },
  handler: async (ctx, args) => {
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    const babies = await ctx.db
      .query('babies')
      .withIndex('by_group', (q) => q.eq('groupId', group._id))
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

/**
 * One child, read through the Group the URL claims they are in.
 *
 * The child must live in *that* Group: a deep link to
 * /g/other-household/baby/<id> answers "not found" even when the caller can see
 * that child from a Group of their own, because the URL claims something about
 * this child and that Group which is not true.
 *
 * Not-a-member and no-such-child are the same answer on purpose, so the page
 * cannot be used to find out that a child exists somewhere.
 */
export const get = query({
  args: { id: v.id('babies'), groupSlug: v.string() },
  handler: async (ctx, args) => {
    const found = await findBabyInGroup(ctx, args.groupSlug, args.id)
    if (!found) return null
    const { baby } = found
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
    groupSlug: v.string(),
  },
  handler: async (ctx, args) => {
    // The child belongs to the Group the page was opened in, and not to
    // whichever one the account happens to default to.
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    const existing = await ctx.db
      .query('babies')
      .withIndex('by_group', (q) => q.eq('groupId', group._id))
      .collect()
    const nextOrder =
      existing.reduce((max, b) => Math.max(max, b.order), -1) + 1
    return await ctx.db.insert('babies', {
      groupId: group._id,
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
  args: { id: v.id('babies'), groupSlug: v.string() },
  handler: async (ctx, args) => {
    const { baby } = await requireBabyAccess(ctx, args.groupSlug, args.id)
    return await ensureAuxTaskList(
      ctx,
      baby,
      'taskListId',
      `${baby.name} to-dos`,
    )
  },
})

export const ensureQuestionsList = mutation({
  args: { id: v.id('babies'), groupSlug: v.string() },
  handler: async (ctx, args) => {
    const { baby } = await requireBabyAccess(ctx, args.groupSlug, args.id)
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
    groupSlug: v.string(),
    name: v.string(),
    birthDate: v.string(),
    sex: v.optional(v.union(sexValidator, v.null())),
    photoId: v.optional(v.union(v.id('_storage'), v.null())),
  },
  handler: async (ctx, args) => {
    const { baby } = await requireBabyAccess(ctx, args.groupSlug, args.id)
    const { sex, photoId } = args
    await ctx.db.patch(args.id, {
      name: args.name,
      birthDate: args.birthDate,
      ...(sex !== undefined ? { sex: sex ?? undefined } : {}),
      ...(photoId !== undefined ? { photoId: photoId ?? undefined } : {}),
    })
    // Behind the access check, and only once the row has stopped pointing at
    // the old photo: nothing else in the app can reach it after this.
    await replaceStoredFile(ctx, baby.photoId, photoId)
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
  args: { id: v.id('babies'), groupSlug: v.string() },
  handler: async (ctx, args) => {
    const { baby } = await requireBabyAccess(ctx, args.groupSlug, args.id)
    const events = await ctx.db
      .query('babyEvents')
      .withIndex('by_baby', (q) => q.eq('babyId', args.id))
      .collect()
    await Promise.all(events.map((e) => ctx.db.delete(e._id)))
    await deleteAuxTaskList(ctx, baby.taskListId)
    await deleteAuxTaskList(ctx, baby.questionsListId)
    await deleteStoredFile(ctx, baby.photoId)
    await ctx.db.delete(args.id)
  },
})
