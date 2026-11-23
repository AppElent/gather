import { useMutation } from 'convex/react'
import { api, type Id } from '../../convex/api'
import { useQuery } from '../../convex/queries'
import { useGroup } from '../../group/GroupProvider'

export interface Note {
  id: string
  title: string
  body: string
  pinned: boolean
  updatedAt: number
  /** The last editor's name; null when that account no longer exists. */
  updatedByName: string | null
  updatedByMe: boolean
}

/** The Current Group's notes; empty until the first answer. */
export function useNotes(): Note[] {
  const { group } = useGroup()
  const rows = useQuery(api.notes.list, { groupSlug: group.slug })
  return (rows ?? []).map((note) => ({
    id: note._id,
    title: note.title,
    body: note.body,
    pinned: note.pinned ?? false,
    updatedAt: note.updatedAt,
    updatedByName: note.updatedByName,
    updatedByMe: note.updatedByMe,
  }))
}

export function useNoteActions() {
  const { group } = useGroup()
  const groupSlug = group.slug
  const create = useMutation(api.notes.create)
  const update = useMutation(api.notes.update)
  const remove = useMutation(api.notes.remove)

  return {
    /**
     * A note from the composer (APP-588). `saveKey` is the draft's: a retry,
     * or a second Return, answers with the note already made.
     */
    addComposedNote: (
      note: { title: string; body: string; pinned: boolean },
      saveKey: string,
    ) =>
      create({
        groupSlug,
        title: note.title,
        body: note.body,
        // Sent only when set: a backend from before APP-588 refuses the field,
        // and an unpinned note is its default.
        ...(note.pinned ? { pinned: true } : {}),
        idempotencyKey: saveKey,
      }),
    editNote: (id: string, patch: { title?: string; body?: string }) =>
      update({ noteId: id as Id<'notes'>, groupSlug, ...patch }),
    togglePin: (note: Note) =>
      update({
        noteId: note.id as Id<'notes'>,
        groupSlug,
        pinned: !note.pinned,
      }),
    deleteNote: (id: string) =>
      remove({ noteId: id as Id<'notes'>, groupSlug }),
  }
}
