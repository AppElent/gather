import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import { mutation, type QueryCtx, query } from './_generated/server'
import { findInGroup, requireGroupBySlug, requireInGroup } from './lib/groupAccess'
import { createOnce, idempotencyKeyValidator } from './lib/idempotency'
import { findNotes, noteExcerpt } from './lib/noteSearch'

/** How many notes the Drop picker offers before anything is typed. */
const PICKER_NOTES = 50

const noteOutput = v.object({
  _id: v.id('notes'),
  title: v.string(),
  body: v.string(),
  pinned: v.boolean(),
  updatedAt: v.number(),
  /** The last editor's name; null when that account no longer exists. */
  updatedByName: v.union(v.string(), v.null()),
  updatedByMe: v.boolean(),
})

/** A note shows who last touched it, by name — never the id. */
function withEditors(ctx: QueryCtx, me: Id<'users'>) {
  const names = new Map<Id<'users'>, Promise<string | null>>()
  const nameOf = (id: Id<'users'>) => {
    const known = names.get(id)
    if (known) return known
    const name = ctx.db.get(id).then((user) => user?.name ?? null)
    names.set(id, name)
    return name
  }
  return async (note: Doc<'notes'>) => {
    const editor = note.updatedBy ?? note.createdBy
    return {
      _id: note._id,
      title: note.title,
      body: note.body,
      pinned: note.pinned ?? false,
      updatedAt: note.updatedAt,
      updatedByName: await nameOf(editor),
      updatedByMe: editor === me,
    }
  }
}

/** A Group's notes, most recently changed first. */
function newestNotes(ctx: QueryCtx, groupId: Id<'groups'>) {
  return ctx.db
    .query('notes')
    .withIndex('by_group_and_updatedAt', (q) => q.eq('groupId', groupId))
    .order('desc')
}

/**
 * @deprecated Reads every note. Kept unchanged because installed phone builds
 * from before APP-700 call it; nothing in this repository does. Retire it once
 * no supported build predates `listPage`.
 */
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

/**
 * One page of a Group's notes, most recently changed first. `unpinnedOnly`
 * leaves out the notes `listPinned` answers, so a page is full without them.
 */
export const listPage = query({
  args: {
    groupSlug: v.string(),
    unpinnedOnly: v.optional(v.boolean()),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(noteOutput),
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
  }),
  handler: async (ctx, args) => {
    const { group, user } = await requireGroupBySlug(ctx, args.groupSlug)
    const newest = newestNotes(ctx, group._id)
    const result = await (args.unpinnedOnly
      ? newest.filter((q) => q.neq(q.field('pinned'), true))
      : newest
    ).paginate(args.paginationOpts)
    return {
      ...result,
      page: await Promise.all(result.page.map(withEditors(ctx, user._id))),
    }
  },
})

/**
 * A Group's pinned notes, most recently changed first. Pinned notes are the old
 * ones a household keeps at hand, so this looks at every note and answers with
 * few; an index on `pinned` would spare the reads.
 */
export const listPinned = query({
  args: { groupSlug: v.string() },
  returns: v.array(noteOutput),
  handler: async (ctx, args) => {
    const { group, user } = await requireGroupBySlug(ctx, args.groupSlug)
    const pinned = await newestNotes(ctx, group._id)
      .filter((q) => q.eq(q.field('pinned'), true))
      .collect()
    return await Promise.all(pinned.map(withEditors(ctx, user._id)))
  },
})

/**
 * One note, or null when it is not in the addressed Group or is gone: a screen
 * still open on a note somebody deletes must not throw. `noteId` is a route
 * segment, so any text is accepted.
 */
export const get = query({
  args: { groupSlug: v.string(), noteId: v.string() },
  returns: v.union(noteOutput, v.null()),
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId('notes', args.noteId)
    if (!id) {
      await requireGroupBySlug(ctx, args.groupSlug)
      return null
    }
    const found = await findInGroup(ctx, args.groupSlug, id)
    return found ? await withEditors(ctx, found.user._id)(found.doc) : null
  },
})

/**
 * The notes a Drop can be added to before anything is typed: the most recently
 * changed ones. `searchNotes` finds the rest.
 */
export const picker = query({
  args: { groupSlug: v.string() },
  returns: v.array(
    v.object({ _id: v.id('notes'), title: v.string(), body: v.string() }),
  ),
  handler: async (ctx, args) => {
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    const notes = await newestNotes(ctx, group._id).take(PICKER_NOTES)
    return notes.map(({ _id, title, body }) => ({ _id, title, body }))
  },
})

/**
 * The addressed Group's notes that match a search, best first. `search.group`
 * answers the phone's search screen from the same `findNotes`.
 */
export const searchNotes = query({
  args: { groupSlug: v.string(), query: v.string() },
  returns: v.array(
    v.object({
      _id: v.id('notes'),
      title: v.string(),
      body: v.string(),
      excerpt: v.string(),
      pinned: v.boolean(),
      createdBy: v.id('users'),
      updatedAt: v.number(),
      updatedByName: v.union(v.string(), v.null()),
      updatedByMe: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const { group, user } = await requireGroupBySlug(ctx, args.groupSlug)
    const notes = await findNotes(ctx, group._id, args.query)
    const withEditor = withEditors(ctx, user._id)
    return await Promise.all(
      notes.map(async (note) => ({
        ...(await withEditor(note)),
        excerpt: noteExcerpt(note.body),
        createdBy: note.createdBy,
      })),
    )
  },
})

export const create = mutation({
  args: {
    groupSlug: v.string(),
    title: v.string(),
    body: v.string(),
    /** Set by the phone's composer Pin chip (APP-588); unpinned when left out. */
    pinned: v.optional(v.boolean()),
    idempotencyKey: idempotencyKeyValidator,
  },
  handler: async (ctx, args) => {
    const { group, user } = await requireGroupBySlug(ctx, args.groupSlug)
    const now = Date.now()
    return await createOnce(ctx, user._id, 'notes', args.idempotencyKey, () =>
      ctx.db.insert('notes', {
        groupId: group._id,
        title: args.title,
        body: args.body,
        pinned: args.pinned ?? false,
        createdBy: user._id,
        updatedAt: now,
      }),
    )
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
