import type { WithoutSystemFields } from 'convex/server'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { indexSearch, normalized } from './searchText'

/** A search stops at this many index matches, the most it answered before. */
const MAX_MATCHES = 100
/**
 * How far one search looks for them in `search_text`: Convex refuses to read
 * past 1024 search results, and `MAX_CANDIDATE_CHARS` of text (1-3 bytes each,
 * stored twice) keeps long notes well inside a query's 16 MiB.
 */
const MAX_CANDIDATES = 1000
const MAX_CANDIDATE_CHARS = 1_000_000
/** Read from each of the two old indexes until the narrow step (APP-701). */
const FALLBACK_MATCHES = 50
const RECENT_NOTES = 100
const MIN_QUERY = 2

type NoteText = Pick<Doc<'notes'>, 'title' | 'body'>

/**
 * What `notes.searchText` holds: the text `search_text` indexes. Derived from
 * title and body, so every write of either goes through `insertNote` or
 * `patchNote`, which keep it in step (`noteWrites.test.ts`).
 */
export function noteSearchText({ title, body }: NoteText): string {
  return `${title}\n${body}`
}

type NoteFields = Omit<WithoutSystemFields<Doc<'notes'>>, 'searchText'>

/** Adds a note. The caller has already authorised the Group. */
export function insertNote(ctx: MutationCtx, note: NoteFields) {
  return ctx.db.insert('notes', { ...note, searchText: noteSearchText(note) })
}

/** Changes a note. The caller has already authorised it. */
export function patchNote(
  ctx: MutationCtx,
  note: Doc<'notes'>,
  patch: Partial<NoteFields>,
) {
  return ctx.db.patch(note._id, {
    ...patch,
    searchText: noteSearchText({ ...note, ...patch }),
  })
}

/**
 * `search_text`'s notes for a search, best first, until `MAX_MATCHES` of them
 * have every word. The index ranks notes with *any* word and does not promise
 * that one with all of them comes first, so the rest are read past, not cut
 * off at a page.
 */
async function textCandidates(
  ctx: QueryCtx,
  groupId: Id<'groups'>,
  { search, matches }: ReturnType<typeof indexSearch>,
): Promise<Doc<'notes'>[]> {
  const candidates: Doc<'notes'>[] = []
  if (search === '') return candidates
  let found = 0
  let chars = 0
  for await (const note of ctx.db
    .query('notes')
    .withSearchIndex('search_text', (q) =>
      q.search('searchText', search).eq('groupId', groupId),
    )) {
    candidates.push(note)
    const text = noteSearchText(note)
    if (matches(text)) found += 1
    chars += text.length
    if (
      found >= MAX_MATCHES ||
      candidates.length >= MAX_CANDIDATES ||
      chars >= MAX_CANDIDATE_CHARS
    )
      break
  }
  return candidates
}

/**
 * The old path, for notes the backfill has not reached: they are not in
 * `search_text`. Goes with the narrow step that makes `searchText` required.
 */
async function unfilledCandidates(
  ctx: QueryCtx,
  groupId: Id<'groups'>,
  search: string,
): Promise<Doc<'notes'>[]> {
  if (search === '') return []
  const [byTitle, byBody] = await Promise.all([
    ctx.db
      .query('notes')
      .withSearchIndex('search_title', (q) =>
        q.search('title', search).eq('groupId', groupId),
      )
      .take(FALLBACK_MATCHES),
    ctx.db
      .query('notes')
      .withSearchIndex('search_body', (q) =>
        q.search('body', search).eq('groupId', groupId),
      )
      .take(FALLBACK_MATCHES),
  ])
  return [...byTitle, ...byBody].filter((note) => note.searchText === undefined)
}

/**
 * The notes of one Group that contain every word of `text`, in the title, the
 * body, or across the two. The caller has already authorised the Group.
 *
 * Two passes, merged, the first first:
 *
 * 1. The `search_text` index over title and body together, filtered on
 *    `groupId`. It matches notes with *any* word, so that every word is there
 *    is checked here, by its own rule: a word matches whole, and the last one,
 *    still being typed, from its start. It ranks best first, and finds a note
 *    however old it is.
 * 2. A substring check, as every other type on the search screen does
 *    (`search.group`), over the Group's newest `RECENT_NOTES` notes and the
 *    index's other candidates: every word must be somewhere in the text, so
 *    "kaart" finds "wijnkaart". An index cannot do this, so older notes are
 *    reachable only by whole word or prefix. This pass also takes the words
 *    the indexes drop (past the 16th, 32 bytes or more) and a search with no
 *    word in it, such as an emoji.
 */
export async function findNotes(
  ctx: QueryCtx,
  groupId: Id<'groups'>,
  text: string,
): Promise<Doc<'notes'>[]> {
  if (text.trim().length < MIN_QUERY) return []
  const asked = indexSearch(text)
  const { words, search, matches } = asked
  // Every word, or the whole search when it has none (an emoji, "--").
  const needles = (words.length > 0 ? words : [text]).map(normalized)
  const [byText, unfilled, recent] = await Promise.all([
    textCandidates(ctx, groupId, asked),
    unfilledCandidates(ctx, groupId, search),
    ctx.db
      .query('notes')
      .withIndex('by_group_and_updatedAt', (q) => q.eq('groupId', groupId))
      .order('desc')
      .take(RECENT_NOTES),
  ])
  const candidates = [...byText, ...unfilled]
  const byIndex = candidates.filter((note) => matches(noteSearchText(note)))
  const found = new Map(byIndex.map((note) => [note._id, note] as const))
  for (const note of [...candidates, ...recent]) {
    if (found.has(note._id)) continue
    const haystack = normalized(noteSearchText(note))
    if (needles.every((needle) => haystack.includes(needle)))
      found.set(note._id, note)
  }
  return [...found.values()]
}

/** The first line with anything on it: what a result row shows under the title. */
export function noteExcerpt(body: string): string {
  return (
    body
      .split('\n')
      .find((line) => line.trim())
      ?.trim() ?? ''
  )
}
