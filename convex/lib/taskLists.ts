import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { nextOrder } from './order'

/** What a child's two checklist cards are called when Gather makes the lists. */
export function auxListNames(childName: string) {
  return {
    todos: `${childName} to-dos`,
    questions: `${childName} questions`,
  }
}

/** A new local list at the end of the Group's lists. */
export async function insertLocalList(
  ctx: MutationCtx,
  groupId: Id<'groups'>,
  name: string,
): Promise<Id<'taskLists'>> {
  const existing = await ctx.db
    .query('taskLists')
    .withIndex('by_group', (q) => q.eq('groupId', groupId))
    .collect()
  return await ctx.db.insert('taskLists', {
    groupId,
    name,
    provider: 'local',
    order: nextOrder(existing),
  })
}
