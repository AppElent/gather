import { useAuth } from '@clerk/react'
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { useRef } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'
import { deleteWithDraft, type NoteFields } from './noteDrafts'

export type Note = NonNullable<FunctionReturnType<typeof api.notes.get>>

const PAGE = 50
/** The shortest search `notes.searchNotes` answers. */
export const MIN_QUERY = 2

/** Pinned notes, and the rest a page at a time, as on the phone. */
export function useNotesList() {
  const { slug: groupSlug } = useRequiredCurrentGroup()
  const pinned = useQuery(api.notes.listPinned, { groupSlug })
  const { results, status, loadMore } = usePaginatedQuery(
    api.notes.listPage,
    { groupSlug, unpinnedOnly: true },
    { initialNumItems: PAGE },
  )
  return {
    loading: pinned === undefined || status === 'LoadingFirstPage',
    pinned: pinned ?? [],
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
