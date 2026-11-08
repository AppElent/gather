import { CALENDAR_COLORS } from '@gather/core/calendar'
import { calendarRefusal } from '@gather/core/refusals'
import { paginationOptsValidator } from 'convex/server'
import { ConvexError, v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import {
  calendarColorValidator,
  calendarError,
  calendarPeopleFilterValidator,
  calendarViewValidator,
  currentGroupMembers,
  eventInGroup,
  normalizedEvent,
  storedEventFields,
  validateAssignees,
  validateEventFields,
} from './lib/calendar'
import { requireGroupBySlug, requireInGroup } from './lib/groupAccess'
import { purgeEventsOfCalendar } from './lib/groupCascade'

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
    const { doc: calendar } = await requireInGroup(
      ctx,
      args.groupSlug,
      args.calendarId,
      calendarRefusal('not-found'),
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
        normalizedEvent(event, calendar),
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
    const { doc: calendar } = await requireInGroup(
      ctx,
      args.groupSlug,
      args.id,
      calendarRefusal('not-found'),
    )
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
    const destination = await requireInGroup(
      ctx,
      args.groupSlug,
      args.calendarId,
      calendarRefusal('not-found'),
    )
    const currentRevision = current.event.revision ?? 0
    if (currentRevision !== args.expectedRevision)
      calendarError('conflict')
    validateEventFields(args)
    await validateAssignees(
      ctx,
      destination.group._id,
      args.assigneeIds,
      current.event.assigneeIds ?? [],
    )
    const patch = storedEventFields({
      ...args,
      calendarId: destination.doc._id,
    })
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
    const { group, membership } = await requireGroupBySlug(ctx, args.groupSlug)
    if (args.peopleFilter) {
      const members = await currentGroupMembers(ctx, group._id)
      const allowed = new Set(members.map(({ user: member }) => member._id))
      if (args.peopleFilter.userIds.some((id) => !allowed.has(id)))
        calendarError('person-not-member')
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

export const addCalendar = mutation({
  args: {
    groupSlug: v.string(),
    name: v.string(),
    color: v.optional(calendarColorValidator),
  },
  returns: v.id('calendars'),
  handler: async (ctx, args) => {
    const { group, user } = await requireGroupBySlug(ctx, args.groupSlug)
    const name = args.name.trim()
    if (!name) throw new ConvexError('Calendar name required')
    const existing = await ctx.db
      .query('calendars')
      .withIndex('by_group', (q) => q.eq('groupId', group._id))
      .collect()
    const counts = new Map(CALENDAR_COLORS.map((color) => [color, 0]))
    for (const calendar of existing) {
      const color = calendar.color ?? 'home'
      counts.set(color, (counts.get(color) ?? 0) + 1)
    }
    const defaultColor = CALENDAR_COLORS.reduce(
      (chosen, color) =>
        counts.get(color)! < counts.get(chosen)! ? color : chosen,
      CALENDAR_COLORS[0],
    )
    return await ctx.db.insert('calendars', {
      groupId: group._id,
      name,
      source: 'local',
      createdBy: user._id,
      color: args.color ?? defaultColor,
    })
  },
})

export const removeCalendar = mutation({
  args: { groupSlug: v.string(), id: v.id('calendars') },
  handler: async (ctx, args) => {
    const { doc: calendar } = await requireInGroup(
      ctx,
      args.groupSlug,
      args.id,
      calendarRefusal('not-found'),
    )
    await purgeEventsOfCalendar(ctx, calendar._id)
    await ctx.db.delete(calendar._id)
    const memberships = await ctx.db
      .query('memberships')
      .withIndex('by_group', (q) => q.eq('groupId', calendar.groupId))
      .collect()
    await Promise.all(
      memberships.map((membership) =>
        ctx.db.patch(membership._id, {
          hiddenCalendarIds: (membership.hiddenCalendarIds ?? []).filter(
            (id) => id !== calendar._id,
          ),
        }),
      ),
    )
  },
})

export const addCalendarEvent = mutation({
  args: {
    groupSlug: v.string(),
    calendarId: v.id('calendars'),
    title: v.string(),
    date: v.string(),
    startMinutes: v.optional(v.number()),
    endMinutes: v.optional(v.number()),
    allDay: v.optional(v.boolean()),
    assigneeIds: v.optional(v.array(v.id('users'))),
    location: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { doc: calendar, user } = await requireInGroup(
      ctx,
      args.groupSlug,
      args.calendarId,
      calendarRefusal('not-found'),
    )
    const fields = {
      calendarId: calendar._id,
      title: args.title,
      date: args.date,
      allDay:
        args.allDay ??
        (args.startMinutes === undefined && args.endMinutes === undefined),
      startMinutes: args.startMinutes ?? null,
      endMinutes: args.endMinutes ?? null,
      assigneeIds: args.assigneeIds ?? [],
      location: args.location ?? null,
      notes: args.notes ?? null,
    }
    validateEventFields(fields)
    await validateAssignees(ctx, calendar.groupId, fields.assigneeIds)
    return await ctx.db.insert('calendarEvents', {
      ...storedEventFields(fields),
      revision: 0,
      createdBy: user._id,
    })
  },
})

/** One event's own destination, including when Search opened it cold. */
export const getCalendarEvent = query({
  args: { groupSlug: v.string(), id: v.id('calendarEvents') },
  returns: v.union(v.null(), eventOutput),
  handler: async (ctx, args) => {
    await requireGroupBySlug(ctx, args.groupSlug)
    const event = await ctx.db.get(args.id)
    if (!event) return null
    const { doc: calendar } = await requireInGroup(
      ctx,
      args.groupSlug,
      event.calendarId,
      calendarRefusal('not-found'),
    )
    return normalizedEvent(event, calendar)
  },
})

export const removeCalendarEvent = mutation({
  args: { groupSlug: v.string(), id: v.id('calendarEvents') },
  handler: async (ctx, args) => {
    await eventInGroup(ctx, args.groupSlug, args.id)
    await ctx.db.delete(args.id)
  },
})

export const setCalendarVisibility = mutation({
  args: {
    groupSlug: v.string(),
    calendarId: v.id('calendars'),
    visible: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { doc: calendar, membership } = await requireInGroup(
      ctx,
      args.groupSlug,
      args.calendarId,
      calendarRefusal('not-found'),
    )
    const hidden = new Set(membership.hiddenCalendarIds ?? [])
    if (args.visible) hidden.delete(calendar._id)
    else hidden.add(calendar._id)
    await ctx.db.patch(membership._id, { hiddenCalendarIds: [...hidden] })
  },
})
