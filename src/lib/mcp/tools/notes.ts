import { NOTE_MAX_CHARS } from '@gather/core/notes'
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

/** Shortest query `notes.searchNotes` searches for; shorter reads as no match. */
const MIN_QUERY = 2

const title = z.string().min(1).max(200)
// The cap is advertised, not enforced here: Convex counts title and body
// together and is the one that refuses, with `notes:too-long` (APP-827).
const body = z
  .string()
  .meta({ maxLength: NOTE_MAX_CHARS })
  .describe(
    `Plain text or Markdown. Title and body together hold at most ${NOTE_MAX_CHARS} characters.`,
  )

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
    // The older shape: the message is the error's name, "InvalidCursor: ...",
    // possibly after a prefix line. A message that only mentions the word is
    // some other failure.
    (error instanceof Error &&
      /(?:^|\n|Error: )InvalidCursor: /.test(error.message))
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
      query: z
        .string()
        .max(100)
        .optional()
        .describe(
          'Words to find, at least two characters. total counts at most 200 matches.',
        ),
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
        if (text.length < MIN_QUERY)
          throw new ToolInputError(
            `The query must be at least ${MIN_QUERY} characters. Use more of the word, or leave the query out to list notes.`,
          )
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
      "Change a note's title, body, or pinned state. The body you pass replaces the whole body. When someone else changed the note after the version you read, nothing is written and the error names their version: read it again and decide.",
    access: 'write',
    annotations: { idempotentHint: true },
    input: {
      groupId,
      noteId: z.string().min(1),
      // Required (APP-994): an edit without it overwrites a housemate's.
      baseUpdatedAt: z
        .iso.datetime()
        .describe(
          'The updatedAt of the note as you last read it from list_notes: the version your change is based on. Not checked for a change of pinned only.',
        ),
      title: title.optional(),
      body: body.optional(),
      pinned: z.boolean().optional(),
    },
    async run({ groupId, noteId, baseUpdatedAt, ...changes }, context) {
      const result = await context.backend.mutation(api.notes.update, {
        groupSlug: await groupSlug(context, groupId),
        noteId: asId<'notes'>(noteId),
        ...changes,
        baseUpdatedAt: Date.parse(baseUpdatedAt),
      })
      if (result.status === 'conflict') {
        const newer = isoDate(result.note.updatedAt)
        const who = result.note.updatedByName ?? 'Someone else'
        throw new ToolInputError(
          `Not saved: ${who} changed this note after the version you read. The note is now the version of ${newer}. Read it again with list_notes, then send your change with baseUpdatedAt ${newer} if it should still apply.`,
        )
      }
      return { noteId, updated: true, updatedAt: isoDate(result.updatedAt) }
    },
  }),
]
