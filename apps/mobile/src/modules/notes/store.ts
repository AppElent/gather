import { useMutation } from 'convex/react'
import { api, type Id } from '../../convex/api'
import { usePaginatedQuery, useQuery } from '../../convex/queries'
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

const PAGE = 50

function toNote({
  _id,
  ...note
}: Omit<Note, 'id'> & { _id: Id<'notes'> }): Note {
  return { id: _id, ...note }
}

/**
 * The Current Group's notes as the list shows them, each half most recently
 * changed first: every pinned note, and the rest a page at a time.
 */
export function useNotesList() {
  const { group } = useGroup()
  const pinned = useQuery(api.notes.listPinned, { groupSlug: group.slug })
  const { results, status, loadMore } = usePaginatedQuery(
    api.notes.listPage,
    { groupSlug: group.slug, unpinnedOnly: true },
    { initialNumItems: PAGE },
  )
  return {
    loading: pinned === undefined || status === 'LoadingFirstPage',
    pinned: (pinned ?? []).map(toNote),
    rest: results.map(toNote),
    hasMore: status === 'CanLoadMore' || status === 'LoadingMore',
    loadingMore: status === 'LoadingMore',
    loadMore: () => loadMore(PAGE),
  }
}

/** One note; undefined while it loads, null when the Group has no such note. */
export function useNote(noteId: string): Note | null | undefined {
  const { group } = useGroup()
  const note = useQuery(api.notes.get, { groupSlug: group.slug, noteId })
  return note && toNote(note)
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
