import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import { mutation, type QueryCtx, query } from './_generated/server'
import { findInGroup, requireGroupBySlug, requireInGroup } from './lib/groupAccess'
import { createOnce, idempotencyKeyValidator } from './lib/idempotency'
import {
  findNotes,
  insertNote,
  noteExcerpt,
  patchNote,
  takeNotes,
} from './lib/noteSearch'

/** How many notes the Drop picker offers before anything is typed. */
const PICKER_NOTES = 50

/**
 * The bytes one read of whole notes takes (APP-805), and at most one note more,
 * so a Group full of the longest notes stays inside a query's 16 MiB.
 */
const READ_BYTES = 8 * 1024 * 1024

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
 * @deprecated Reads every note, up to `READ_BYTES` of the newest (APP-805). Kept
 * because installed phone builds from before APP-700 call it; nothing in this
 * repository does. Retire it once no supported build predates `listPage`.
 */
export const list = query({
  args: { groupSlug: v.string() },
  handler: async (ctx, args) => {
    const { group, user } = await requireGroupBySlug(ctx, args.groupSlug)
    const notes = await takeNotes(newestNotes(ctx, group._id), {
      bytes: READ_BYTES,
    })
    // A note shows who last touched it, by name — never the id.
    const names = new Map<Id<'users'>, string | null>()
    const nameOf = async (id: Id<'users'>) => {
      if (!names.has(id)) names.set(id, (await ctx.db.get(id))?.name ?? null)
      return names.get(id) ?? null
    }
    return await Promise.all(
      // `searchText` repeats title and body; those phones never read it.
      notes.map(async ({ searchText: _, ...note }) => {
        const editor = note.updatedBy ?? note.createdBy
        return {
          ...note,
          updatedByName: await nameOf(editor),
          updatedByMe: editor === user._id,
        }
      }),
    )
  },
})

/**
 * One page of a Group's notes, most recently changed first. `unpinnedOnly`
 * leaves out the pinned notes, so a page is full without them; `pinnedOnly`
 * answers those alone, and looks at every note to find them (an index on
 * `pinned` would spare the reads). A page also ends at `READ_BYTES` of the notes
 * looked at, so it can be short, or empty, and not be the last.
 */
export const listPage = query({
  args: {
    groupSlug: v.string(),
    unpinnedOnly: v.optional(v.boolean()),
    pinnedOnly: v.optional(v.boolean()),
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
    const result = await (args.pinnedOnly
      ? newest.filter((q) => q.eq(q.field('pinned'), true))
      : args.unpinnedOnly
        ? newest.filter((q) => q.neq(q.field('pinned'), true))
        : newest
    ).paginate({ ...args.paginationOpts, maximumBytesRead: READ_BYTES })
    return {
      ...result,
      page: await Promise.all(result.page.map(withEditors(ctx, user._id))),
    }
  },
})

/**
 * The pinned notes among the newest `READ_BYTES` of a Group's notes (APP-805),
 * most recently changed first.
 *
 * @deprecated Installed phone builds from before APP-805 call it; nothing in
 * this repository does, because a Group past the bound has older pinned notes
 * it does not answer. Retire it once no supported build predates
 * `listPage`'s `pinnedOnly`.
 */
export const listPinned = query({
  args: { groupSlug: v.string() },
  returns: v.array(noteOutput),
  handler: async (ctx, args) => {
    const { group, user } = await requireGroupBySlug(ctx, args.groupSlug)
    const notes = await takeNotes(newestNotes(ctx, group._id), {
      bytes: READ_BYTES,
    })
    return await Promise.all(
      notes.filter((note) => note.pinned).map(withEditors(ctx, user._id)),
    )
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
    const notes = await takeNotes(newestNotes(ctx, group._id), {
      count: PICKER_NOTES,
      bytes: READ_BYTES,
    })
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
      insertNote(ctx, {
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

/**
 * Changes a note's title, body or pin.
 *
 * `baseUpdatedAt` is the `updatedAt` the edit started from (APP-347). When
 * another Member has edited the note since, nothing is written and the answer
 * is `conflict`, with the note as it is now, so the editor can choose. The
 * caller's own later edits never conflict: its saves overlap while it types.
 * Left out, the last write wins, as before: installed phones from before
 * APP-347 send none (`docs/migrations/README.md`). The web's note editor and
 * MCP `update_note` send it (APP-994).
 */
export const update = mutation({
  args: {
    groupSlug: v.string(),
    noteId: v.id('notes'),
    title: v.optional(v.string()),
    body: v.optional(v.string()),
    pinned: v.optional(v.boolean()),
    baseUpdatedAt: v.optional(v.number()),
  },
  returns: v.union(
    v.object({ status: v.literal('saved'), updatedAt: v.number() }),
    v.object({
      status: v.literal('conflict'),
      note: v.object({
        title: v.string(),
        body: v.string(),
        updatedAt: v.number(),
        updatedByName: v.union(v.string(), v.null()),
      }),
    }),
  ),
  handler: async (ctx, args) => {
    const { doc, user } = await requireInGroup(
      ctx,
      args.groupSlug,
      args.noteId,
      'Note not found',
    )
    // Only a changed title or body is an edit (APP-789). Pinning is not: it
    // leaves the note's place in Recent and its "edited by" line alone.
    const edited =
      (args.title !== undefined && args.title !== doc.title) ||
      (args.body !== undefined && args.body !== doc.body)
    const editor = doc.updatedBy ?? doc.createdBy
    if (
      edited &&
      args.baseUpdatedAt !== undefined &&
      args.baseUpdatedAt !== doc.updatedAt &&
      editor !== user._id
    ) {
      return {
        status: 'conflict' as const,
        note: {
          title: doc.title,
          body: doc.body,
          updatedAt: doc.updatedAt,
          updatedByName: (await ctx.db.get(editor))?.name ?? null,
        },
      }
    }
    // Always later than the version it replaces, so two edits in one
    // millisecond still read as two versions.
    const updatedAt = edited
      ? Math.max(Date.now(), doc.updatedAt + 1)
      : doc.updatedAt
    await patchNote(ctx, doc, {
      ...(args.title !== undefined ? { title: args.title } : {}),
      ...(args.body !== undefined ? { body: args.body } : {}),
      ...(args.pinned !== undefined ? { pinned: args.pinned } : {}),
      ...(edited ? { updatedBy: user._id, updatedAt } : {}),
    })
    return { status: 'saved' as const, updatedAt }
  },
})

export const remove = mutation({
  args: { groupSlug: v.string(), noteId: v.id('notes') },
  handler: async (ctx, args) => {
    await requireInGroup(ctx, args.groupSlug, args.noteId, 'Note not found')
    await ctx.db.delete(args.noteId)
  },
})
