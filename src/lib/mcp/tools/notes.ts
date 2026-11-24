import { ConvexError } from 'convex/values'
import { z } from 'zod'
import { api } from '../../../../convex/_generated/api'
import {
  asId,
  defineTool,
  groupSlug,
  isoDate,
  publicDoc,
  ToolInputError,
} from './define'
import { groupId, idempotencyKey } from './shared'

const title = z.string().min(1).max(200)
const body = z.string().max(20_000).describe('Plain text or Markdown')

function publicNote(note: {
  _id: string
  title: string
  body: string
  pinned: boolean
  updatedAt: number
  updatedByName: string | null
}) {
  return publicDoc({
    _id: note._id,
    title: note.title,
    body: note.body,
    pinned: note.pinned,
    updatedAt: isoDate(note.updatedAt),
    updatedByName: note.updatedByName ?? undefined,
  })
}

/** Convex refuses a cursor it did not make, or made for another query. */
function isInvalidCursor(error: unknown) {
  return (
    (error instanceof ConvexError &&
      (error.data as { paginationError?: unknown } | null)?.paginationError ===
        'InvalidCursor') ||
    (error instanceof Error && error.message.includes('InvalidCursor'))
  )
}

export const noteTools = [
  defineTool({
    name: 'list_notes',
    title: 'List notes',
    description:
      "List a Group's notes with their full text, most recently changed first, a page at a time. With a query: the notes that contain every word of it in the title or body, best match first.",
    access: 'read',
    input: {
      groupId,
      query: z.string().max(100).optional(),
      limit: z.number().int().min(1).max(100).default(30),
      cursor: z
        .string()
        .max(2000)
        .optional()
        .describe(
          'nextCursor from the previous call, for the next page. Not used with a query.',
        ),
    },
    async run({ groupId, query, limit, cursor }, context) {
      const slug = await groupSlug(context, groupId)
      const text = query?.trim()
      if (text) {
        const found = await context.backend.query(api.notes.searchNotes, {
          groupSlug: slug,
          query: text,
        })
        return {
          notes: found.slice(0, limit).map(publicNote),
          total: found.length,
        }
      }
      const result = await context.backend
        .query(api.notes.listPage, {
          groupSlug: slug,
          paginationOpts: { numItems: limit, cursor: cursor ?? null },
        })
        .catch((error: unknown) => {
          if (cursor && isInvalidCursor(error))
            throw new ToolInputError(
              'The cursor is no longer valid. Call again without it.',
            )
          throw error
        })
      return {
        notes: result.page.map(publicNote),
        nextCursor: result.isDone ? undefined : result.continueCursor,
      }
    },
  }),
  defineTool({
    name: 'create_note',
    title: 'Create note',
    description: 'Add a note to a Group.',
    access: 'write',
    input: { groupId, idempotencyKey, title, body },
    async run({ groupId, ...input }, context) {
      const id = await context.backend.mutation(api.notes.create, {
        groupSlug: await groupSlug(context, groupId),
        ...input,
      })
      return { noteId: id }
    },
  }),
  defineTool({
    name: 'update_note',
    title: 'Update note',
    description:
      "Change a note's title, body, or pinned state. The body you pass replaces the whole body.",
    access: 'write',
    annotations: { idempotentHint: true },
    input: {
      groupId,
      noteId: z.string().min(1),
      title: title.optional(),
      body: body.optional(),
      pinned: z.boolean().optional(),
    },
    async run({ groupId, noteId, ...changes }, context) {
      await context.backend.mutation(api.notes.update, {
        groupSlug: await groupSlug(context, groupId),
        noteId: asId<'notes'>(noteId),
        ...changes,
      })
      return { noteId, updated: true }
    },
  }),
]
