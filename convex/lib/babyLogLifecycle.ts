import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'

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

/** Delete a baby and everything hanging off it. Lives here rather than in
 * convex/babies.ts so the cleanup registry never has to import a function
 * module — doing so puts the generated api types in an inference cycle. */
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

export async function cleanupBabyLogForSpace(
  ctx: MutationCtx,
  spaceId: Id<'spaces'>,
) {
  const babies = await ctx.db
    .query('babies')
    .withIndex('by_space', (q) => q.eq('spaceId', spaceId))
    .collect()
  for (const baby of babies) {
    await deleteBabyCascade(ctx, baby)
  }
}
