import {
  CALENDAR_COLORS,
  CALENDAR_VIEWS,
  type CalendarColor,
  type CalendarEvent,
  hasCalendarErrors,
  normalizeCalendarEvent,
  validateCalendarFields,
} from '@gather/core/calendar'
import { type CalendarRefusalCode, calendarRefusal } from '@gather/core/refusals'
import { ConvexError, v } from 'convex/values'
import type { Doc, Id } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { requireInGroup } from './groupAccess'
import { literals } from './validators'

export const calendarColorValidator = literals(CALENDAR_COLORS)

export const calendarViewValidator = literals(CALENDAR_VIEWS)

export const calendarPeopleFilterValidator = v.object({
  userIds: v.array(v.id('users')),
  includeUnassigned: v.boolean(),
})

export function calendarError(code: CalendarRefusalCode): never {
  throw new ConvexError(calendarRefusal(code))
}

export async function eventInGroup(
  ctx: QueryCtx,
  groupSlug: string,
  eventId: Id<'calendarEvents'>,
) {
  const event = await ctx.db.get(eventId)
  if (!event) calendarError('deleted')
  const { group, user, membership, doc: calendar } = await requireInGroup(
    ctx,
    groupSlug,
    event.calendarId,
    calendarRefusal('not-found'),
  )
  return { group, user, membership, calendar, event }
}

export async function currentGroupMembers(
  ctx: QueryCtx,
  groupId: Id<'groups'>,
) {
  const memberships = await ctx.db
    .query('memberships')
    .withIndex('by_group', (q) => q.eq('groupId', groupId))
    .collect()
  const rows = await Promise.all(
    memberships.map(async (membership) => ({
      membership,
      user: await ctx.db.get(membership.userId),
    })),
  )
  return rows.filter(
    (row): row is { membership: Doc<'memberships'>; user: Doc<'users'> } =>
      row.user !== null,
  )
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
  for (const id of ids)
    if (!memberIds.has(id) && !legacy.has(id))
      calendarError('assignee-not-member')
}

interface EventFields {
  title: string
  date: string
  allDay: boolean
  startMinutes: number | null
  endMinutes: number | null
  assigneeIds: readonly Id<'users'>[]
  location: string | null
  notes: string | null
}

export function validateEventFields(
  args: EventFields & { calendarId: Id<'calendars'> | null },
) {
  const errors = validateCalendarFields(args)
  if (hasCalendarErrors(errors)) calendarError(Object.values(errors)[0])
}

/** What a validated event is stored as, whichever door it came through. */
export function storedEventFields(
  args: EventFields & { calendarId: Id<'calendars'> },
) {
  return {
    calendarId: args.calendarId,
    title: args.title.trim(),
    date: args.date,
    allDay: args.allDay,
    startMinutes: args.allDay ? undefined : (args.startMinutes ?? undefined),
    endMinutes: args.allDay ? undefined : (args.endMinutes ?? undefined),
    assigneeIds: [...new Set(args.assigneeIds)],
    location: args.location?.trim() || undefined,
    notes: args.notes?.trim() || undefined,
  }
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
