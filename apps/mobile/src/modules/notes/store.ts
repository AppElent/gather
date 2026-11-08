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
    addNote: () => create({ groupSlug, title: '', body: '' }),
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
