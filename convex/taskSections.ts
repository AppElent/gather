/**
 * A list's sections (APP-357): add, rename, reorder and delete.
 *
 * Every write resolves the list through `requireInGroup` against the Group the
 * caller named, as `taskLists.setAppearance` does, so a section can only be
 * changed by a Member of the list's own Group. Only a local list has sections:
 * a linked list's tasks live in Notion or Todoist, where Gather cannot file
 * them (ADR-0021).
 */
import { ConvexError, v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { type MutationCtx, mutation } from './_generated/server'
import { requireInGroup } from './lib/groupAccess'
import {
  checkedSectionName,
  checkSectionCount,
  newSectionId,
} from './lib/taskSections'

/** The local list a section write is about, in the Group the caller named. */
async function requireLocalList(
  ctx: MutationCtx,
  groupSlug: string,
  listId: Id<'taskLists'>,
) {
  const found = await requireInGroup(ctx, groupSlug, listId, 'List not found')
  if (found.doc.provider !== 'local') {
    throw new ConvexError('This list is read-only')
  }
  return found.doc
}

/** A section at the end of the list. Answers its id. */
export const add = mutation({
  args: { listId: v.id('taskLists'), groupSlug: v.string(), name: v.string() },
  returns: v.string(),
  handler: async (ctx, args) => {
    const list = await requireLocalList(ctx, args.groupSlug, args.listId)
    const sections = list.sections ?? []
    checkSectionCount(sections.length + 1)
    const id = newSectionId()
    await ctx.db.patch(list._id, {
      sections: [...sections, { id, name: checkedSectionName(args.name) }],
    })
    return id
  },
})

export const rename = mutation({
  args: {
    listId: v.id('taskLists'),
    groupSlug: v.string(),
    sectionId: v.string(),
    name: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const list = await requireLocalList(ctx, args.groupSlug, args.listId)
    const sections = list.sections ?? []
    if (!sections.some((section) => section.id === args.sectionId)) {
      throw new ConvexError('Section not found')
    }
    const name = checkedSectionName(args.name)
    await ctx.db.patch(list._id, {
      sections: sections.map((section) =>
        section.id === args.sectionId ? { ...section, name } : section,
      ),
    })
    return null
  },
})

/** Every section of the list, each once, in the order they should be drawn. */
export const reorder = mutation({
  args: {
    listId: v.id('taskLists'),
    groupSlug: v.string(),
    sectionIds: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const list = await requireLocalList(ctx, args.groupSlug, args.listId)
    const byId = new Map((list.sections ?? []).map((s) => [s.id, s]))
    if (
      args.sectionIds.length !== byId.size ||
      new Set(args.sectionIds).size !== byId.size ||
      args.sectionIds.some((id) => !byId.has(id))
    ) {
      throw new ConvexError('Reorder must contain every section exactly once')
    }
    await ctx.db.patch(list._id, {
      sections: args.sectionIds.map((id) => byId.get(id) as { id: string; name: string }),
    })
    return null
  },
})

/**
 * Deletes a section and keeps its tasks: they move to "No section", where they
 * keep their place in the list's order.
 */
export const remove = mutation({
  args: {
    listId: v.id('taskLists'),
    groupSlug: v.string(),
    sectionId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const list = await requireLocalList(ctx, args.groupSlug, args.listId)
    const sections = list.sections ?? []
    if (!sections.some((section) => section.id === args.sectionId)) {
      throw new ConvexError('Section not found')
    }
    await ctx.db.patch(list._id, {
      sections: sections.filter((section) => section.id !== args.sectionId),
    })
    const rows = await ctx.db
      .query('tasks')
      .withIndex('by_list', (q) => q.eq('listId', list._id))
      .collect()
    await Promise.all(
      rows
        .filter((task) => task.sectionId === args.sectionId)
        .map((task) => ctx.db.patch(task._id, { sectionId: undefined })),
    )
    return null
  },
})
