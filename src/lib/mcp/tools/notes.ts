import { z } from 'zod'
import { api } from '../../../../convex/_generated/api'
import { asId, defineTool, groupSlug, isoDate, publicDoc } from './define'
import { groupId, idempotencyKey, matches } from './shared'

const title = z.string().min(1).max(200)
const body = z.string().max(20_000).describe('Plain text or Markdown')

export const noteTools = [
  defineTool({
    name: 'list_notes',
    title: 'List notes',
    description:
      "List a Group's notes, most recently changed first, with their full text. Filter by text in the title or body.",
    access: 'read',
    input: {
      groupId,
      query: z.string().max(100).optional(),
      limit: z.number().int().min(1).max(100).default(30),
    },
    async run({ groupId, query, limit }, context) {
      const notes = await context.backend.query(api.notes.list, {
        groupSlug: await groupSlug(context, groupId),
      })
      const found = notes.filter((n) => matches(query, n.title, n.body))
      return {
        notes: found.slice(0, limit).map((n) =>
          publicDoc({
            _id: n._id,
            title: n.title,
            body: n.body,
            pinned: n.pinned,
            updatedAt: isoDate(n.updatedAt),
            updatedByName: n.updatedByName ?? undefined,
          }),
        ),
        total: found.length,
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
