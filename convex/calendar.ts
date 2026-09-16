import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import {
  calendarColorValidator,
  calendarInGroup,
  calendarPeopleFilterValidator,
  calendarViewValidator,
  callerMembership,
  currentGroupMembers,
  eventInGroup,
  normalizedEvent,
  validateAssignees,
  validateEventFields,
} from './lib/calendar'
import { requireGroupBySlug } from './lib/groupAccess'

const nullableNumber = v.union(v.null(), v.number())

const calendarOutput = v.object({
  _id: v.id('calendars'),
  _creationTime: v.number(),
  groupId: v.id('groups'),
  name: v.string(),
  source: v.literal('local'),
  createdBy: v.id('users'),
  color: calendarColorValidator,
})

const eventOutput = v.object({
  _id: v.id('calendarEvents'),
  id: v.string(),
  calendarId: v.id('calendars'),
  calendarName: v.string(),
  color: calendarColorValidator,
  title: v.string(),
  date: v.string(),
  allDay: v.boolean(),
  startMinutes: v.optional(v.number()),
  endMinutes: v.optional(v.number()),
  assigneeIds: v.array(v.id('users')),
  location: v.string(),
  notes: v.string(),
  revision: v.number(),
})

const calendarPagination = v.object({
  page: v.array(calendarOutput),
  isDone: v.boolean(),
  continueCursor: v.string(),
  splitCursor: v.optional(v.union(v.string(), v.null())),
  pageStatus: v.optional(
    v.union(
      v.literal('SplitRecommended'),
      v.literal('SplitRequired'),
      v.null(),
    ),
  ),
})

const eventPagination = v.object({
  page: v.array(eventOutput),
  isDone: v.boolean(),
  continueCursor: v.string(),
  splitCursor: v.optional(v.union(v.string(), v.null())),
  pageStatus: v.optional(
    v.union(
      v.literal('SplitRecommended'),
      v.literal('SplitRequired'),
      v.null(),
    ),
  ),
})

function eventForOutput(event: ReturnType<typeof normalizedEvent>) {
  return {
    ...event,
    id: event._id,
    color: event.color,
  }
}

export const listCalendars = query({
  args: { groupSlug: v.string(), paginationOpts: paginationOptsValidator },
  returns: calendarPagination,
  handler: async (ctx, args) => {
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    const page = await ctx.db
      .query('calendars')
      .withIndex('by_group', (q) => q.eq('groupId', group._id))
      .order('asc')
      .paginate(args.paginationOpts)
    return {
      page: page.page.map((calendar) => ({
        ...calendar,
        color: calendar.color ?? ('home' as const),
      })),
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    }
  },
})

export const preferences = query({
  args: { groupSlug: v.string() },
  returns: v.object({
    view: calendarViewValidator,
    hiddenCalendarIds: v.array(v.id('calendars')),
    peopleFilter: v.union(v.null(), calendarPeopleFilterValidator),
  }),
  handler: async (ctx, args) => {
    const { membership } = await requireGroupBySlug(ctx, args.groupSlug)
    return {
      view: membership.calendarView ?? 'week',
      hiddenCalendarIds: membership.hiddenCalendarIds ?? [],
      peopleFilter: membership.calendarPeopleFilter ?? null,
    }
  },
})

export const listEvents = query({
  args: {
    groupSlug: v.string(),
    calendarId: v.id('calendars'),
    from: v.string(),
    toExclusive: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  returns: eventPagination,
  handler: async (ctx, args) => {
    const { calendar } = await calendarInGroup(
      ctx,
      args.groupSlug,
      args.calendarId,
    )
    const page = await ctx.db
      .query('calendarEvents')
      .withIndex('by_calendar_date', (q) =>
        q
          .eq('calendarId', calendar._id)
          .gte('date', args.from)
          .lt('date', args.toExclusive),
      )
      .order('asc')
      .paginate({
        ...args.paginationOpts,
        numItems: Math.min(args.paginationOpts.numItems, 100),
      })
    return {
      page: page.page.map((event) =>
        eventForOutput(normalizedEvent(event, calendar)),
      ),
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    }
  },
})

export const updateCalendar = mutation({
  args: {
    groupSlug: v.string(),
    id: v.id('calendars'),
    color: calendarColorValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { calendar } = await calendarInGroup(ctx, args.groupSlug, args.id)
    await ctx.db.patch(calendar._id, { color: args.color })
    return null
  },
})

export const updateEvent = mutation({
  args: {
    groupSlug: v.string(),
    id: v.id('calendarEvents'),
    expectedRevision: v.number(),
    title: v.string(),
    calendarId: v.id('calendars'),
    date: v.string(),
    allDay: v.boolean(),
    startMinutes: nullableNumber,
    endMinutes: nullableNumber,
    assigneeIds: v.array(v.id('users')),
    location: v.union(v.null(), v.string()),
    notes: v.union(v.null(), v.string()),
  },
  returns: v.object({ id: v.id('calendarEvents'), revision: v.number() }),
  handler: async (ctx, args) => {
    const current = await eventInGroup(ctx, args.groupSlug, args.id)
    const destination = await calendarInGroup(
      ctx,
      args.groupSlug,
      args.calendarId,
    )
    const currentRevision = current.event.revision ?? 0
    if (currentRevision !== args.expectedRevision)
      throw new Error('calendar:conflict')
    validateEventFields(args)
    await validateAssignees(
      ctx,
      destination.group._id,
      args.assigneeIds,
      current.event.assigneeIds ?? [],
    )
    const patch = {
      calendarId: destination.calendar._id,
      title: args.title.trim(),
      date: args.date,
      allDay: args.allDay,
      startMinutes: args.allDay ? undefined : (args.startMinutes ?? undefined),
      endMinutes: args.allDay ? undefined : (args.endMinutes ?? undefined),
      assigneeIds: [...new Set(args.assigneeIds)],
      location: args.location?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
    }
    const unchanged =
      current.event.calendarId === patch.calendarId &&
      current.event.title === patch.title &&
      current.event.date === patch.date &&
      (current.event.allDay ??
        (current.event.startMinutes === undefined &&
          current.event.endMinutes === undefined)) === patch.allDay &&
      current.event.startMinutes === patch.startMinutes &&
      current.event.endMinutes === patch.endMinutes &&
      JSON.stringify(current.event.assigneeIds ?? []) ===
        JSON.stringify(patch.assigneeIds) &&
      (current.event.location ?? '') === (patch.location ?? '') &&
      (current.event.notes ?? '') === (patch.notes ?? '')
    const revision = unchanged ? currentRevision : currentRevision + 1
    if (!unchanged)
      await ctx.db.patch(current.event._id, { ...patch, revision })
    return { id: current.event._id, revision }
  },
})

export const setPreferences = mutation({
  args: {
    groupSlug: v.string(),
    view: v.optional(calendarViewValidator),
    peopleFilter: v.optional(v.union(v.null(), calendarPeopleFilterValidator)),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { group, user } = await requireGroupBySlug(ctx, args.groupSlug)
    const membership = await callerMembership(ctx, group._id, user._id)
    if (args.peopleFilter) {
      const members = await currentGroupMembers(ctx, group._id)
      const allowed = new Set(members.map(({ user: member }) => member._id))
      if (args.peopleFilter.userIds.some((id) => !allowed.has(id)))
        throw new Error('calendar:person-not-member')
    }
    const patch: {
      calendarView?: 'month' | 'week' | 'agenda'
      calendarPeopleFilter?: {
        userIds: Id<'users'>[]
        includeUnassigned: boolean
      }
    } = {}
    if (args.view !== undefined) patch.calendarView = args.view
    if (args.peopleFilter !== undefined)
      patch.calendarPeopleFilter = args.peopleFilter ?? undefined
    if (Object.keys(patch).length > 0) await ctx.db.patch(membership._id, patch)
    return null
  },
})
