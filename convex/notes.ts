import { v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import { requireGroupBySlug, requireInGroup } from './lib/groupAccess'

export const list = query({
  args: { groupSlug: v.string() },
  handler: async (ctx, args) => {
    const { group, user } = await requireGroupBySlug(ctx, args.groupSlug)
    const notes = await ctx.db
      .query('notes')
      .withIndex('by_group', (q) => q.eq('groupId', group._id))
      .collect()
    // A note shows who last touched it, by name — never the id.
    const names = new Map<Id<'users'>, string | null>()
    const nameOf = async (id: Id<'users'>) => {
      if (!names.has(id)) names.set(id, (await ctx.db.get(id))?.name ?? null)
      return names.get(id) ?? null
    }
    const rows = await Promise.all(
      notes.map(async (note) => {
        const editor = note.updatedBy ?? note.createdBy
        return {
          ...note,
          updatedByName: await nameOf(editor),
          updatedByMe: editor === user._id,
        }
      }),
    )
    return rows.sort((a, b) => b.updatedAt - a.updatedAt)
  },
})

export const create = mutation({
  args: {
    groupSlug: v.string(),
    title: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const { group, user } = await requireGroupBySlug(ctx, args.groupSlug)
    const now = Date.now()
    return await ctx.db.insert('notes', {
      groupId: group._id,
      title: args.title,
      body: args.body,
      pinned: false,
      createdBy: user._id,
      updatedAt: now,
    })
  },
})

export const update = mutation({
  args: {
    groupSlug: v.string(),
    noteId: v.id('notes'),
    title: v.optional(v.string()),
    body: v.optional(v.string()),
    pinned: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireInGroup(
      ctx,
      args.groupSlug,
      args.noteId,
      'Note not found',
    )
    await ctx.db.patch(args.noteId, {
      ...(args.title !== undefined ? { title: args.title } : {}),
      ...(args.body !== undefined ? { body: args.body } : {}),
      ...(args.pinned !== undefined ? { pinned: args.pinned } : {}),
      updatedBy: user._id,
      updatedAt: Date.now(),
    })
  },
})

export const remove = mutation({
  args: { groupSlug: v.string(), noteId: v.id('notes') },
  handler: async (ctx, args) => {
    await requireInGroup(ctx, args.groupSlug, args.noteId, 'Note not found')
    await ctx.db.delete(args.noteId)
  },
})
