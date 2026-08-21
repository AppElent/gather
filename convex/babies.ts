import { ConvexError, v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { mutation, query } from './_generated/server'
import { findBabyInGroup, requireBabyAccess } from './lib/babyAccess'
import { babyBarSlotValidator, babyEventTypeValidator } from './lib/babyEvents'
import { requireGroupBySlug } from './lib/groupAccess'
import { getCurrentUser } from './lib/sharing'
import { deleteStoredFile, replaceStoredFile } from './lib/storedFiles'
import { requireListAccess } from './lib/taskAccess'

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
    const photoUrl = baby.photoId
      ? await ctx.storage.getUrl(baby.photoId)
      : null
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

/**
 * The list backing one of a child's two checklist cards.
 *
 * Either a list the caller picked out of the same Group — any list, whatever
 * provider it runs on, because Tasks already presents one model across backends
 * and a baby-only restriction would be an invention (ADR-0021) — or a new local
 * one named after the child.
 */
async function resolveAuxTaskList(
  ctx: MutationCtx,
  groupSlug: string,
  groupId: Id<'groups'>,
  chosen: Id<'taskLists'> | undefined,
  listName: string,
) {
  // A list from another Group is refused rather than quietly replaced with a
  // new one: the caller named something that is not theirs to name.
  if (chosen) return (await requireListAccess(ctx, groupSlug, chosen)).list._id
  const existing = await ctx.db
    .query('taskLists')
    .withIndex('by_group', (q) => q.eq('groupId', groupId))
    .collect()
  const nextOrder = existing.reduce((max, l) => Math.max(max, l.order), -1) + 1
  return await ctx.db.insert('taskLists', {
    groupId,
    name: listName,
    provider: 'local',
    order: nextOrder,
  })
}

export const create = mutation({
  args: {
    name: v.string(),
    birthDate: v.string(),
    sex: v.optional(sexValidator),
    photoId: v.optional(v.id('_storage')),
    groupSlug: v.string(),
    // The types this child's log will *not* offer. Absent or empty means
    // every type, which is what a form that asked nothing sends.
    untrackedTypes: v.optional(v.array(babyEventTypeValidator)),
    // Absent means "make one for this child" rather than "leave it empty":
    // both cards exist from the moment the child does.
    taskListId: v.optional(v.id('taskLists')),
    questionsListId: v.optional(v.id('taskLists')),
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
    const taskListId = await resolveAuxTaskList(
      ctx,
      args.groupSlug,
      group._id,
      args.taskListId,
      `${args.name} to-dos`,
    )
    const questionsListId = await resolveAuxTaskList(
      ctx,
      args.groupSlug,
      group._id,
      args.questionsListId,
      `${args.name} questions`,
    )
    return await ctx.db.insert('babies', {
      groupId: group._id,
      name: args.name,
      birthDate: args.birthDate,
      sex: args.sex,
      photoId: args.photoId,
      untrackedTypes: args.untrackedTypes,
      taskListId,
      questionsListId,
      taskListChosen: args.taskListId !== undefined,
      questionsListChosen: args.questionsListId !== undefined,
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

/**
 * Fills in whichever of a Child's two lists is missing, and returns both.
 *
 * `create` has made both since ADR-0022, but two kinds of Child predate it and
 * have neither: the ones seeded straight into the table by `lib/seed`, and any
 * created before the field existed. Those had no way to get a list at all —
 * the Lists screen rendered nothing and the quick-add had nothing to write to,
 * which reads as a broken feature rather than as missing data.
 *
 * Idempotent, so a screen can call it on mount without checking first. It
 * creates on first *need* rather than on read of the Module, so a household
 * that never opens the lists never accumulates two empty ones per child.
 */
export const ensureAuxLists = mutation({
  args: { id: v.id('babies'), groupSlug: v.string() },
  handler: async (ctx, args) => {
    const { baby, group } = await requireBabyAccess(
      ctx,
      args.groupSlug,
      args.id,
    )
    if (baby.taskListId && baby.questionsListId) {
      return {
        taskListId: baby.taskListId,
        questionsListId: baby.questionsListId,
      }
    }
    const taskListId =
      baby.taskListId ??
      (await resolveAuxTaskList(
        ctx,
        args.groupSlug,
        group._id,
        undefined,
        `${baby.name} to-dos`,
      ))
    const questionsListId =
      baby.questionsListId ??
      (await resolveAuxTaskList(
        ctx,
        args.groupSlug,
        group._id,
        undefined,
        `${baby.name} questions`,
      ))
    await ctx.db.patch(args.id, { taskListId, questionsListId })
    return { taskListId, questionsListId }
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
    // Omitted leaves the child's offer alone. An empty array is a real
    // choice too — it takes every refusal back off, so the log offers
    // everything again.
    untrackedTypes: v.optional(v.array(babyEventTypeValidator)),
    // Omitted leaves the arrangement alone. An empty array is a real choice
    // too — a bar with nothing on it — and is reconciled back to the tracked
    // types on read, which is the closest thing to "reset" this has.
    barOrder: v.optional(v.array(babyBarSlotValidator)),
    taskListId: v.optional(v.id('taskLists')),
    questionsListId: v.optional(v.id('taskLists')),
  },
  handler: async (ctx, args) => {
    const { baby } = await requireBabyAccess(ctx, args.groupSlug, args.id)
    const {
      sex,
      photoId,
      untrackedTypes,
      barOrder,
      taskListId,
      questionsListId,
    } = args
    // Repointing a card at a list from another Group is refused, exactly as it
    // is at creation.
    if (taskListId) await requireListAccess(ctx, args.groupSlug, taskListId)
    if (questionsListId) {
      await requireListAccess(ctx, args.groupSlug, questionsListId)
    }
    await ctx.db.patch(args.id, {
      name: args.name,
      birthDate: args.birthDate,
      ...(sex !== undefined ? { sex: sex ?? undefined } : {}),
      ...(photoId !== undefined ? { photoId: photoId ?? undefined } : {}),
      ...(untrackedTypes !== undefined ? { untrackedTypes } : {}),
      ...(barOrder !== undefined ? { barOrder } : {}),
      // Repointing a card is always at a list somebody chose, so the list the
      // child used to hold stops being the child's to delete. It is left
      // standing rather than cleaned up: a list holds somebody's tasks, and
      // unlike a stored photo it is a thing in its own right in Tasks.
      ...(taskListId !== undefined ? { taskListId, taskListChosen: true } : {}),
      ...(questionsListId !== undefined
        ? { questionsListId, questionsListChosen: true }
        : {}),
    })
    // Behind the access check, and only once the row has stopped pointing at
    // the old photo: nothing else in the app can reach it after this.
    await replaceStoredFile(ctx, baby.photoId, photoId)
  },
})

/**
 * Deletes a checklist card's list — but only one the child was given.
 *
 * A list somebody chose is a list with its own life: it may hold the
 * household's tasks, it may be backed by Todoist, and it was reachable from
 * Tasks before this child existed. Deleting a child un-points it, exactly as
 * deleting a Group un-shares a recipe rather than destroying it.
 */
async function deleteAuxTaskList(
  ctx: MutationCtx,
  taskListId: Id<'taskLists'> | undefined,
  chosen: boolean | undefined,
) {
  if (!taskListId || chosen) return
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
    // The entries are gone, so nothing points at their pictures any more. A
    // Memory's photo is reachable from nowhere else once its entry is deleted.
    for (const event of events) await deleteStoredFile(ctx, event.photoId)
    await deleteAuxTaskList(ctx, baby.taskListId, baby.taskListChosen)
    await deleteAuxTaskList(ctx, baby.questionsListId, baby.questionsListChosen)
    await ctx.db.delete(args.id)
    // After the row is gone, so that the child being deleted is not itself
    // counted as still holding the photo.
    await deleteStoredFile(ctx, baby.photoId)
  },
})
