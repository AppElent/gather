/** The shortest search `notes.searchNotes` answers. */
export const MINIMUM_NOTE_QUERY = 2

export interface PickableNote {
  _id: string
  title: string
  body: string
}

/**
 * The notes to offer for a search: the recent ones whose title contains it, at
 * once, then the server's matches from the whole Group. `undefined` while there
 * is nothing to show yet and an answer is still coming.
 */
export function pickableNotes(
  query: string,
  recent: PickableNote[] | undefined,
  found: PickableNote[] | undefined,
  untitled: string,
): PickableNote[] | undefined {
  const needle = query.trim().toLowerCase()
  if (!needle) return recent
  const searching = needle.length >= MINIMUM_NOTE_QUERY
  const local = (recent ?? []).filter((note) =>
    (note.title || untitled).toLowerCase().includes(needle),
  )
  if (local.length === 0 && (recent === undefined || (searching && !found)))
    return undefined
  const notes = new Map(local.map((note) => [note._id, note]))
  if (searching) for (const note of found ?? []) notes.set(note._id, note)
  return [...notes.values()]
}
