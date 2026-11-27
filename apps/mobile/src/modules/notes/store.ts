import { useMutation } from 'convex/react'
import { useEffect } from 'react'
import { api, type Id } from '../../convex/api'
import { usePaginatedQuery, useQuery } from '../../convex/queries'
import { useGroup } from '../../group/GroupProvider'
import { newSaveKey } from '../../ui/composer-drafts'

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
 * changed first: every pinned note, and the rest a page at a time. A page stops
 * at a number of bytes (APP-805), so the pinned notes can take several, and a
 * page of the rest can be empty with more after it.
 */
export function useNotesList() {
  const { group } = useGroup()
  const pinned = usePaginatedQuery(
    api.notes.listPage,
    { groupSlug: group.slug, pinnedOnly: true },
    { initialNumItems: PAGE },
  )
  const morePinned = pinned.status === 'CanLoadMore'
  const loadPinned = pinned.loadMore
  useEffect(() => {
    if (morePinned) loadPinned(PAGE)
  }, [morePinned, loadPinned])
  const { results, status, loadMore } = usePaginatedQuery(
    api.notes.listPage,
    { groupSlug: group.slug, unpinnedOnly: true },
    { initialNumItems: PAGE },
  )
  const restEmpty = results.length === 0 && status === 'CanLoadMore'
  useEffect(() => {
    if (restEmpty) loadMore(PAGE)
  }, [restEmpty, loadMore])
  // Nothing to show is only "no notes" once both halves have been looked through.
  const searching =
    pinned.results.length + results.length === 0 &&
    !(pinned.status === 'Exhausted' && status === 'Exhausted')
  return {
    loading:
      pinned.status === 'LoadingFirstPage' ||
      status === 'LoadingFirstPage' ||
      searching,
    pinned: pinned.results.map(toNote),
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
    /**
     * `baseUpdatedAt` is the version the edit started from (APP-347): when
     * another Member saved since, nothing is written and the answer is
     * `conflict`, with their version.
     */
    editNote: (
      id: string,
      patch: { title?: string; body?: string },
      baseUpdatedAt: number,
    ) => update({ noteId: id as Id<'notes'>, groupSlug, ...patch, baseUpdatedAt }),
    /** A copy of this person's text, as a note of its own. */
    copyNote: (note: { title: string; body: string }) =>
      create({
        groupSlug,
        title: note.title,
        body: note.body,
        idempotencyKey: newSaveKey(),
      }),
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
