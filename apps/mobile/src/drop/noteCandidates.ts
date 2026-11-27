/** The shortest search `notes.searchNotes` answers. */
const MINIMUM_QUERY = 2

/**
 * Whether the server is asked. Counted before lowercasing, as the server does:
 * "İ" lowercases to two characters.
 */
export function asksServer(query: string): boolean {
  return query.trim().length >= MINIMUM_QUERY
}

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
export function pickableNotes<Note extends PickableNote>(
  query: string,
  recent: Note[] | undefined,
  found: Note[] | undefined,
  untitled: string,
): Note[] | undefined {
  const needle = query.trim().toLowerCase()
  if (!needle) return recent
  const searching = asksServer(query)
  const local = (recent ?? []).filter((note) =>
    (note.title || untitled).toLowerCase().includes(needle),
  )
  if (local.length === 0 && (recent === undefined || (searching && !found)))
    return undefined
  const notes = new Map(local.map((note) => [note._id, note]))
  if (searching) for (const note of found ?? []) notes.set(note._id, note)
  return [...notes.values()]
}

/** How many letters of the body an excerpt shows, and how many come before the hit. */
const EXCERPT_LENGTH = 80
const EXCERPT_LEAD = 20

/** The words of a search, split as the server splits them. */
function needlesOf(query: string): string[] {
  const text = query.trim().toLocaleLowerCase()
  const words = text.split(/[^\p{Alphabetic}\p{N}]+/u).filter(Boolean)
  return words.length > 0 ? words : text ? [text] : []
}

/**
 * A short piece of a note's body around what the search found, for the row of a
 * note that matched by its body: the title alone does not explain it. Null when
 * the title holds every word, or the body holds none of the rest.
 *
 * Lowercased letter by letter so a letter that lowercases to two ("İ") cannot
 * shift where the excerpt starts; whitespace runs read as one space.
 */
export function bodyExcerpt(
  note: PickableNote,
  query: string,
  untitled: string,
): string | null {
  const title = (note.title || untitled).toLocaleLowerCase()
  const missing = needlesOf(query).filter((needle) => !title.includes(needle))
  if (missing.length === 0) return null

  const letters = Array.from(note.body.replace(/\s+/g, ' ').trim())
  let lowered = ''
  const starts: number[] = []
  letters.forEach((letter, index) => {
    const lower = letter.toLowerCase()
    for (let at = 0; at < lower.length; at += 1) starts.push(index)
    lowered += lower
  })
  const hits = missing
    .map((needle) => lowered.indexOf(needle))
    .filter((at) => at >= 0)
  if (hits.length === 0) return null

  let from = Math.max(0, starts[Math.min(...hits)] - EXCERPT_LEAD)
  // Begin on a word rather than in the middle of one.
  if (from > 0) {
    const space = letters.indexOf(' ', from)
    if (space >= 0 && space < starts[Math.min(...hits)]) from = space + 1
  }
  const to = Math.min(letters.length, from + EXCERPT_LENGTH)
  return `${from > 0 ? '…' : ''}${letters.slice(from, to).join('').trim()}${
    to < letters.length ? '…' : ''
  }`
}
