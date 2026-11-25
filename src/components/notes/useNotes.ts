import { useAuth } from '@clerk/react'
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { useEffect, useRef } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'
import { deleteWithDraft, type NoteFields } from './noteDrafts'

export type Note = NonNullable<FunctionReturnType<typeof api.notes.get>>

const PAGE = 50
/** The shortest search `notes.searchNotes` answers. */
export const MIN_QUERY = 2

/**
 * Pinned notes, and the rest a page at a time, as on the phone. A page stops at
 * a number of bytes (APP-805), so the pinned notes can take several, and a page
 * of the rest can be empty with more after it.
 */
export function useNotesList() {
  const { slug: groupSlug } = useRequiredCurrentGroup()
  const pinned = usePaginatedQuery(
    api.notes.listPage,
    { groupSlug, pinnedOnly: true },
    { initialNumItems: PAGE },
  )
  const morePinned = pinned.status === 'CanLoadMore'
  const loadPinned = pinned.loadMore
  useEffect(() => {
    if (morePinned) loadPinned(PAGE)
  }, [morePinned, loadPinned])
  const { results, status, loadMore } = usePaginatedQuery(
    api.notes.listPage,
    { groupSlug, unpinnedOnly: true },
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
    pinned: pinned.results,
    rest: results,
    hasMore: status === 'CanLoadMore' || status === 'LoadingMore',
    loadingMore: status === 'LoadingMore',
    loadMore: () => loadMore(PAGE),
  }
}

/** Undefined while it loads, null when the Group has no such note. */
export function useNote(noteId: string | undefined): Note | null | undefined {
  const { slug: groupSlug } = useRequiredCurrentGroup()
  return useQuery(api.notes.get, noteId ? { groupSlug, noteId } : 'skip')
}

/** The key of a note's draft: one account's text in one Group. */
export function useDraftKey() {
  const { userId } = useAuth()
  const { _id: groupId } = useRequiredCurrentGroup()
  return (noteId: string) => `${userId ?? ''}:${groupId}:${noteId}`
}

export function useNoteActions() {
  const { slug: groupSlug } = useRequiredCurrentGroup()
  const draftKey = useDraftKey()
  const create = useMutation(api.notes.create)
  const update = useMutation(api.notes.update)
  const remove = useMutation(api.notes.remove)
  // Kept until a create succeeds, so a retry answers with the same note.
  const createKey = useRef<string | null>(null)

  return {
    createEmpty: async (): Promise<Id<'notes'>> => {
      createKey.current ??= `web-note-${crypto.randomUUID()}`
      const id = await create({
        groupSlug,
        title: '',
        body: '',
        idempotencyKey: createKey.current,
      })
      createKey.current = null
      return id
    },
    save: (noteId: Id<'notes'>, fields: NoteFields) =>
      update({ noteId, groupSlug, ...fields }),
    togglePin: (note: Pick<Note, '_id' | 'pinned'>) =>
      update({ noteId: note._id, groupSlug, pinned: !note.pinned }),
    remove: (noteId: Id<'notes'>) =>
      deleteWithDraft(draftKey(noteId), () => remove({ noteId, groupSlug })),
  }
}
