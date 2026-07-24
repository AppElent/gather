import { ConvexError, v } from 'convex/values'
import { requireBabyAccess } from './lib/babyAccess'
import {
  babyEventDataValidator,
  babyEventTypeValidator,
  isValidEventData,
} from './lib/babyEvents'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { mutation, query } from './_generated/server'

const byTimestampDesc = (a: Doc<'babyEvents'>, b: Doc<'babyEvents'>) =>
  b.timestamp - a.timestamp

export const listByBaby = query({
  args: {
    babyId: v.id('babies'),
    type: v.optional(babyEventTypeValidator),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireBabyAccess(ctx, args.babyId)
    const rows = args.type
      ? await ctx.db
          .query('babyEvents')
          .withIndex('by_baby_type', (q) =>
            q.eq('babyId', args.babyId).eq('type', args.type!),
          )
          .collect()
      : await ctx.db
          .query('babyEvents')
          .withIndex('by_baby', (q) => q.eq('babyId', args.babyId))
          .collect()
    const filtered = rows.filter(
      (r) =>
        (args.from === undefined || r.timestamp >= args.from) &&
        (args.to === undefined || r.timestamp <= args.to),
    )
    return filtered.sort(byTimestampDesc)
  },
})

async function requireEditableEvent(
  ctx: MutationCtx,
  eventId: Id<'babyEvents'>,
) {
  const event = await ctx.db.get(eventId)
  if (!event) throw new ConvexError('Event not found')
  await requireBabyAccess(ctx, event.babyId)
  return event
}

export const add = mutation({
  args: {
    babyId: v.id('babies'),
    type: babyEventTypeValidator,
    timestamp: v.number(),
    endTimestamp: v.optional(v.number()),
    notes: v.optional(v.string()),
    data: babyEventDataValidator,
  },
  handler: async (ctx, args) => {
    const { user } = await requireBabyAccess(ctx, args.babyId)
    if (!isValidEventData(args.type, args.data)) {
      throw new ConvexError('Event data does not match the event type')
    }
    return await ctx.db.insert('babyEvents', {
      babyId: args.babyId,
      type: args.type,
      timestamp: args.timestamp,
      endTimestamp: args.endTimestamp,
      notes: args.notes,
      loggedBy: user._id,
      data: args.data,
    })
  },
})

export const update = mutation({
  args: {
    eventId: v.id('babyEvents'),
    timestamp: v.number(),
    endTimestamp: v.optional(v.union(v.number(), v.null())),
    notes: v.optional(v.union(v.string(), v.null())),
    data: babyEventDataValidator,
  },
  handler: async (ctx, args) => {
    const event = await requireEditableEvent(ctx, args.eventId)
    if (!isValidEventData(event.type, args.data)) {
      throw new ConvexError('Event data does not match the event type')
    }
    await ctx.db.patch(args.eventId, {
      timestamp: args.timestamp,
      ...(args.endTimestamp !== undefined
        ? { endTimestamp: args.endTimestamp ?? undefined }
        : {}),
      ...(args.notes !== undefined ? { notes: args.notes ?? undefined } : {}),
      data: args.data,
    })
  },
})

export const remove = mutation({
  args: { eventId: v.id('babyEvents') },
  handler: async (ctx, args) => {
    await requireEditableEvent(ctx, args.eventId)
    await ctx.db.delete(args.eventId)
  },
})
