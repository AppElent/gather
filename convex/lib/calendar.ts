import { ConvexError, v } from 'convex/values'
import {
  hasCalendarErrors,
  normalizeCalendarEvent,
  validateCalendarFields,
  type CalendarColor,
  type CalendarEvent,
} from '@gather/core/calendar'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { getMembership, requireGroupBySlug } from './groupAccess'

export const calendarColorValidator = v.union(
  v.literal('home'),
  v.literal('kitchen'),
  v.literal('money'),
  v.literal('tasting'),
)

export const calendarViewValidator = v.union(
  v.literal('month'),
  v.literal('week'),
  v.literal('agenda'),
)

export const calendarPeopleFilterValidator = v.object({
  userIds: v.array(v.id('users')),
  includeUnassigned: v.boolean(),
})

export function calendarError(code: string): never {
  throw new ConvexError(`calendar:${code}`)
}

export async function calendarInGroup(
  ctx: QueryCtx,
  groupSlug: string,
  calendarId: Id<'calendars'>,
) {
  const { group, user, membership } = await requireGroupBySlug(ctx, groupSlug)
  const calendar = await ctx.db.get(calendarId)
  if (!calendar || calendar.groupId !== group._id) calendarError('not-found')
  return { group, user, membership, calendar }
}

export async function eventInGroup(
  ctx: QueryCtx,
  groupSlug: string,
  eventId: Id<'calendarEvents'>,
) {
  const event = await ctx.db.get(eventId)
  if (!event) calendarError('deleted')
  const result = await calendarInGroup(ctx, groupSlug, event.calendarId)
  return { ...result, event }
}

export async function currentGroupMembers(ctx: QueryCtx, groupId: Id<'groups'>) {
  const memberships = await ctx.db
    .query('memberships')
    .withIndex('by_group', (q) => q.eq('groupId', groupId))
    .collect()
  const rows = await Promise.all(
    memberships.map(async (membership) => ({ membership, user: await ctx.db.get(membership.userId) })),
  )
  return rows.filter((row): row is { membership: Doc<'memberships'>; user: Doc<'users'> } => row.user !== null)
}

export async function validateAssignees(
  ctx: QueryCtx,
  groupId: Id<'groups'>,
  ids: readonly Id<'users'>[],
  allowedLegacyIds: readonly Id<'users'>[] = [],
) {
  const members = await currentGroupMembers(ctx, groupId)
  const memberIds = new Set(members.map(({ user }) => user._id))
  const legacy = new Set(allowedLegacyIds)
  for (const id of ids) if (!memberIds.has(id) && !legacy.has(id)) calendarError('assignee-not-member')
}

export function validateEventFields(args: {
  calendarId: Id<'calendars'> | null
  title: string
  date: string
  allDay: boolean
  startMinutes: number | null
  endMinutes: number | null
  assigneeIds: readonly Id<'users'>[]
  location: string | null
  notes: string | null
}) {
  const errors = validateCalendarFields(args)
  if (hasCalendarErrors(errors)) calendarError(Object.values(errors)[0])
}

export function normalizedEvent(
  event: Doc<'calendarEvents'>,
  calendar: Doc<'calendars'>,
): Omit<CalendarEvent, 'calendarId' | 'assigneeIds' | 'calendarName'> & {
  _id: Id<'calendarEvents'>
  calendarId: Id<'calendars'>
  assigneeIds: Id<'users'>[]
  calendarName: string
} {
  return {
    ...normalizeCalendarEvent({
      id: event._id,
      calendarId: calendar._id,
      calendarName: calendar.name,
      color: calendar.color as CalendarColor | undefined,
      title: event.title,
      date: event.date,
      startMinutes: event.startMinutes,
      endMinutes: event.endMinutes,
      allDay: event.allDay,
      assigneeIds: event.assigneeIds,
      location: event.location,
      notes: event.notes,
      revision: event.revision,
    }),
    _id: event._id,
    calendarId: calendar._id,
    assigneeIds: [...new Set(event.assigneeIds ?? [])],
    calendarName: calendar.name,
  }
}

export async function callerMembership(ctx: QueryCtx, groupId: Id<'groups'>, userId: Id<'users'>) {
  const membership = await getMembership(ctx, groupId, userId)
  if (!membership) calendarError('not-member')
  return membership
}

export type CalendarCtx = QueryCtx | MutationCtx
