import { z } from 'zod'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import {
  asId,
  defineTool,
  groupSlug,
  publicDoc,
  type ToolContext,
  ToolInputError,
} from './define'
import {
  clockOf,
  clockTime,
  day,
  groupId,
  idempotencyKey,
  minutesOf,
} from './shared'

const NOT_FOUND = 'Calendar or event not found.'
/** The longest range list_events reads, so one call stays one answer. */
const MAX_RANGE_DAYS = 92
const MAX_EVENTS = 500

type Event = {
  _id: string
  calendarId: string
  calendarName: string
  title: string
  date: string
  allDay: boolean
  startMinutes?: number
  endMinutes?: number
  location: string
  notes: string
}

/** An event as tools return it: times as HH:MM, empty text left out. */
function publicEvent(event: Event) {
  return publicDoc({
    _id: event._id,
    calendarId: event.calendarId,
    calendar: event.calendarName,
    title: event.title,
    date: event.date,
    allDay: event.allDay,
    start: event.allDay ? undefined : clockOf(event.startMinutes),
    end: event.allDay ? undefined : clockOf(event.endMinutes),
    location: event.location || undefined,
    notes: event.notes || undefined,
  })
}

function daysBetween(from: string, to: string) {
  return (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 864e5
}

async function calendarsOf(context: ToolContext, slug: string) {
  const page = await context.backend.query(api.calendar.listCalendars, {
    groupSlug: slug,
    paginationOpts: { numItems: 100, cursor: null },
  })
  return page.page
}

async function eventsOf(
  context: ToolContext,
  slug: string,
  calendarId: Id<'calendars'>,
  from: string,
  toExclusive: string,
  room: number,
) {
  const events: Event[] = []
  let cursor: string | null = null
  while (events.length < room) {
    const page: {
      page: Event[]
      isDone: boolean
      continueCursor: string
    } = await context.backend.query(api.calendar.listEvents, {
      groupSlug: slug,
      calendarId,
      from,
      toExclusive,
      paginationOpts: { numItems: 100, cursor },
    })
    events.push(...page.page)
    if (page.isDone) break
    cursor = page.continueCursor
  }
  return events.slice(0, room)
}

export const calendarTools = [
  defineTool({
    name: 'list_calendars',
    title: 'List calendars',
    description: "List a Group's calendars.",
    access: 'read',
    input: { groupId },
    async run({ groupId }, context) {
      const calendars = await calendarsOf(
        context,
        await groupSlug(context, groupId),
      )
      return {
        calendars: calendars.map((c) =>
          publicDoc({ _id: c._id, name: c.name, color: c.color }),
        ),
      }
    },
  }),
  defineTool({
    name: 'list_events',
    title: 'List events',
    description: `List a Group's calendar events from one day up to, not including, another, at most ${MAX_RANGE_DAYS} days apart. Leave calendarId out for every calendar. Times are local HH:MM.`,
    access: 'read',
    input: {
      groupId,
      from: day,
      to: day.describe('First day not included, YYYY-MM-DD'),
      calendarId: z.string().min(1).optional(),
    },
    async run({ groupId, from, to, calendarId }, context) {
      const span = daysBetween(from, to)
      if (!(span > 0 && span <= MAX_RANGE_DAYS))
        throw new ToolInputError(
          `to must be after from and at most ${MAX_RANGE_DAYS} days later.`,
        )
      const slug = await groupSlug(context, groupId)
      const calendarIds = calendarId
        ? [asId<'calendars'>(calendarId)]
        : (await calendarsOf(context, slug)).map((c) => c._id)
      const events: Event[] = []
      for (const id of calendarIds) {
        const room = MAX_EVENTS - events.length
        if (room <= 0) break
        events.push(...(await eventsOf(context, slug, id, from, to, room)))
      }
      events.sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          (a.startMinutes ?? -1) - (b.startMinutes ?? -1),
      )
      return {
        events: events.map(publicEvent),
        truncated: events.length >= MAX_EVENTS,
      }
    },
  }),
  defineTool({
    name: 'create_event',
    title: 'Create event',
    description:
      'Add an event to one of a Group\'s calendars. Leave start and end out for an all-day event.',
    access: 'write',
    input: {
      groupId,
      calendarId: z.string().min(1),
      idempotencyKey,
      title: z.string().min(1).max(200),
      date: day,
      start: clockTime.optional(),
      end: clockTime.optional(),
      location: z.string().max(500).optional(),
      notes: z.string().max(5000).optional(),
    },
    async run({ groupId, calendarId, start, end, ...input }, context) {
      const id = await context.backend.mutation(api.calendar.addCalendarEvent, {
        groupSlug: await groupSlug(context, groupId),
        calendarId: asId<'calendars'>(calendarId),
        ...input,
        startMinutes: start === undefined ? undefined : minutesOf(start),
        endMinutes: end === undefined ? undefined : minutesOf(end),
        allDay: start === undefined && end === undefined,
      })
      return { eventId: id }
    },
  }),
  defineTool({
    name: 'update_event',
    title: 'Update event',
    description:
      'Change an event. Only the fields you pass change. Set allDay true to drop its times; start, end, location or notes set to null are cleared. calendarId moves it to another calendar of the same Group.',
    access: 'write',
    annotations: { idempotentHint: true },
    input: {
      groupId,
      eventId: z.string().min(1),
      calendarId: z.string().min(1).optional(),
      title: z.string().min(1).max(200).optional(),
      date: day.optional(),
      allDay: z.boolean().optional(),
      start: clockTime.nullable().optional(),
      end: clockTime.nullable().optional(),
      location: z.string().max(500).nullable().optional(),
      notes: z.string().max(5000).nullable().optional(),
    },
    async run({ groupId, eventId, ...changes }, context) {
      const slug = await groupSlug(context, groupId)
      const id = asId<'calendarEvents'>(eventId)
      const current = await context.backend.query(
        api.calendar.getCalendarEvent,
        { groupSlug: slug, id },
      )
      if (!current) throw new ToolInputError(NOT_FOUND)
      const pick = <T>(next: T | null | undefined, now: T) =>
        next === undefined ? now : next
      const startMinutes = pick(
        changes.start === undefined
          ? undefined
          : changes.start === null
            ? null
            : minutesOf(changes.start),
        current.startMinutes ?? null,
      )
      const endMinutes = pick(
        changes.end === undefined
          ? undefined
          : changes.end === null
            ? null
            : minutesOf(changes.end),
        current.endMinutes ?? null,
      )
      // Giving a time makes a timed event unless allDay says otherwise.
      const allDay =
        changes.allDay ??
        (changes.start || changes.end ? false : current.allDay)
      const result = await context.backend.mutation(api.calendar.updateEvent, {
        groupSlug: slug,
        id,
        expectedRevision: current.revision,
        calendarId: changes.calendarId
          ? asId<'calendars'>(changes.calendarId)
          : current.calendarId,
        title: changes.title ?? current.title,
        date: changes.date ?? current.date,
        allDay,
        startMinutes: allDay ? null : startMinutes,
        endMinutes: allDay ? null : endMinutes,
        // Assignees are kept; MCP does not name people by id.
        assigneeIds: current.assigneeIds,
        location: pick(changes.location, current.location || null),
        notes: pick(changes.notes, current.notes || null),
      })
      return { eventId: result.id, updated: true }
    },
  }),
]
