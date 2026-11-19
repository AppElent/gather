/**
 * The one Member responsible for a task (APP-302).
 *
 * A task's `assigneeId` is a current Member of its list's Group, checked on
 * every write that sets it; leaving the Group clears it (`detachFromGroup`).
 * Giving a task to somebody else also leaves them a notice: the
 * `assignmentNotice` the app shows until they open the task, and a push
 * through `lib/notifications.ts`, which checks their switch and Group mute
 * when it sends and does nothing for a person with no phone registered.
 * Assigning yourself, or clearing, tells nobody.
 */
import { taskRefusal } from '@gather/core/refusals'
import { ConvexError } from 'convex/values'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { getMembership } from './groupAccess'
import { notify } from './notifications'

/** Refuse anyone who is not a current, live Member of the Group. */
export async function requireAssignableMember(
  ctx: QueryCtx,
  groupId: Id<'groups'>,
  userId: Id<'users'>,
): Promise<void> {
  const [user, membership] = await Promise.all([
    ctx.db.get(userId),
    getMembership(ctx, groupId, userId),
  ])
  if (!user || user.deletedAt || !membership) {
    throw new ConvexError(taskRefusal('assignee-not-member'))
  }
}

/** The task fields a change of assignee writes. */
export type AssigneeFields = Pick<
  Doc<'tasks'>,
  'assigneeId' | 'assignmentNotice'
>

/**
 * What changing a task's assignee to `next` writes, after checking it.
 * `null` is nobody. The same assignee again changes nothing, so a retried
 * write or a form saved twice does not notify twice.
 */
export async function assigneeChange(
  ctx: QueryCtx,
  {
    groupId,
    actorId,
    current,
    next,
  }: {
    groupId: Id<'groups'>
    actorId: Id<'users'>
    current: Id<'users'> | undefined
    next: Id<'users'> | null
  },
): Promise<AssigneeFields | null> {
  if ((current ?? null) === next) return null
  if (next === null) return { assigneeId: undefined, assignmentNotice: undefined }
  await requireAssignableMember(ctx, groupId, next)
  return {
    assigneeId: next,
    assignmentNotice:
      next === actorId ? undefined : { by: actorId, at: Date.now() },
  }
}

/**
 * Push the notice for a change `assigneeChange` returned, once the task has
 * been written: the push reads the task as it is then.
 */
export async function notifyAssignee(
  ctx: MutationCtx,
  groupId: Id<'groups'>,
  taskId: Id<'tasks'>,
  fields: AssigneeFields | null,
): Promise<void> {
  if (!fields?.assigneeId || !fields.assignmentNotice) return
  await notify(ctx, [fields.assigneeId], {
    kind: 'taskAssignment',
    groupId,
    target: { type: 'task', id: taskId },
  })
}

/**
 * Take a departing Member off every task they had in this Group, and the
 * notices they had not opened yet. Tasks they gave others stay given.
 */
export async function unassignFromGroup(
  ctx: MutationCtx,
  userId: Id<'users'>,
  groupId: Id<'groups'>,
): Promise<void> {
  const assigned = await ctx.db
    .query('tasks')
    .withIndex('by_assignee', (q) => q.eq('assigneeId', userId))
    .collect()
  const listGroups = new Map<Id<'taskLists'>, Id<'groups'> | null>()
  for (const task of assigned) {
    if (!listGroups.has(task.listId)) {
      const list = await ctx.db.get(task.listId)
      listGroups.set(task.listId, list?.groupId ?? null)
    }
    if (listGroups.get(task.listId) !== groupId) continue
    await ctx.db.patch(task._id, {
      assigneeId: undefined,
      assignmentNotice: undefined,
    })
  }
}
