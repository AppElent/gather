import { isNoteTooLong } from '@gather/core/notes'
import { noteRefusal } from '@gather/core/refusals'
import type { WithoutSystemFields } from 'convex/server'
import { ConvexError, getDocumentSize } from 'convex/values'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { indexSearch, normalized } from './searchText'

/** Of the notes `search_text` matches without the title, a search answers this many. */
const MAX_MATCHES = 100
/** In all, with the title hits, the unfilled notes and the substring matches. */
const MAX_ANSWER = 2 * MAX_MATCHES
/**
 * How far one search reads in `search_text`, whatever it finds on the way:
 * Convex refuses to read past 1024 search results.
 */
const MAX_CANDIDATES = 1000
/**
 * The bytes one search reads of notes (APP-805): of `search_text`, of the
 * newest, and of each of the two old indexes. Each read ends with the note that
 * crosses its bound, at most 1 MiB, so a search stays under 13 MiB of a query's
 * 16; `search.group` reads its other types from what is left.
 */
const CANDIDATE_BYTES = 4 * 1024 * 1024
const RECENT_BYTES = 3 * 1024 * 1024
const FALLBACK_BYTES = 1024 * 1024
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

/**
 * The notes a query answers, in its order, until there are `count` of them or
 * they come to `bytes` as stored: the note that crosses the bound is the last.
 */
export async function takeNotes(
  notes: AsyncIterable<Doc<'notes'>>,
  { count = Number.POSITIVE_INFINITY, bytes }: { count?: number; bytes: number },
): Promise<Doc<'notes'>[]> {
  const taken: Doc<'notes'>[] = []
  let read = 0
  for await (const note of notes) {
    taken.push(note)
    read += getDocumentSize(note)
    if (taken.length >= count || read >= bytes) break
  }
  return taken
}

function refuseTooLong(note: NoteText) {
  if (isNoteTooLong(note)) throw new ConvexError(noteRefusal('too-long'))
}

type NoteFields = Omit<WithoutSystemFields<Doc<'notes'>>, 'searchText'>

/**
 * Adds a note, unless it is too long. The caller has already authorised the
 * Group.
 */
export async function insertNote(ctx: MutationCtx, note: NoteFields) {
  refuseTooLong(note)
  return ctx.db.insert('notes', { ...note, searchText: noteSearchText(note) })
}

/**
 * Changes a note, unless its text changes and is too long. The caller has
 * already authorised it.
 *
 * A note from before the limit (APP-805) can be over it. Its text may stay as
 * it is, so it can be pinned; `searchText` is then left alone, because with it
 * the note may not fit in a document.
 */
export async function patchNote(
  ctx: MutationCtx,
  note: Doc<'notes'>,
  patch: Partial<NoteFields>,
) {
  const next = { ...note, ...patch }
  if (next.title !== note.title || next.body !== note.body) refuseTooLong(next)
  return ctx.db.patch(note._id, {
    ...patch,
    ...(isNoteTooLong(next) ? {} : { searchText: noteSearchText(next) }),
  })
}

/**
 * `search_text`'s notes for a search, best first, until the candidate or
 * byte budget is spent. The index ranks notes with *any* word and does not
 * promise that one with all of them, or one with them in its title, comes
 * first, so it is read on past the first matches, not cut off at a page or at
 * `MAX_MATCHES` of them (APP-806).
 */
async function textCandidates(
  ctx: QueryCtx,
  groupId: Id<'groups'>,
  { search }: ReturnType<typeof indexSearch>,
): Promise<Doc<'notes'>[]> {
  const candidates: Doc<'notes'>[] = []
  if (search === '') return candidates
  let bytes = 0
  for await (const note of ctx.db
    .query('notes')
    .withSearchIndex('search_text', (q) =>
      q.search('searchText', search).eq('groupId', groupId),
    )) {
    candidates.push(note)
    bytes += getDocumentSize(note)
    if (candidates.length >= MAX_CANDIDATES || bytes >= CANDIDATE_BYTES)
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
    takeNotes(
      ctx.db
        .query('notes')
        .withSearchIndex('search_title', (q) =>
          q.search('title', search).eq('groupId', groupId),
        ),
      { count: FALLBACK_MATCHES, bytes: FALLBACK_BYTES },
    ),
    takeNotes(
      ctx.db
        .query('notes')
        .withSearchIndex('search_body', (q) =>
          q.search('body', search).eq('groupId', groupId),
        ),
      { count: FALLBACK_MATCHES, bytes: FALLBACK_BYTES },
    ),
  ])
  return [...byTitle, ...byBody].filter((note) => note.searchText === undefined)
}

/**
 * The notes of one Group that contain every word of `text`, in the title, the
 * body, or across the two. The caller has already authorised the Group. Notes
 * whose title has every word come first, then the rest, each in the order
 * found, then the answer is cut at `MAX_ANSWER`, so a title hit is cut only
 * when that many have one. Behind the title hits the cut falls last on what
 * only the old indexes and the newest notes find (unfilled notes, and index
 * matches among the newest notes), then on the other `search_text` matches
 * (`MAX_MATCHES` of them stay), then on the substring matches (APP-806).
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
    takeNotes(
      ctx.db
        .query('notes')
        .withIndex('by_group_and_updatedAt', (q) => q.eq('groupId', groupId))
        .order('desc'),
      { count: RECENT_NOTES, bytes: RECENT_BYTES },
    ),
  ])
  // One unfilled note can come from both of the old indexes.
  const candidates = [
    ...new Map(
      [...byText, ...unfilled].map((note) => [note._id, note] as const),
    ).values(),
  ]
  const titled = new Map<Id<'notes'>, boolean>()
  const inTitle = (note: Doc<'notes'>) => {
    let known = titled.get(note._id)
    if (known === undefined) {
      const title = normalized(note.title)
      known =
        matches(note.title) || needles.every((needle) => title.includes(needle))
      titled.set(note._id, known)
    }
    return known
  }
  const contains = (note: Doc<'notes'>) => {
    const haystack = normalized(noteSearchText(note))
    return needles.every((needle) => haystack.includes(needle))
  }
  // Every answer is placed twice: `cut`, what survives the cap, and `show`, the
  // order it is listed in. Both are tiers, and within a tier notes keep the
  // order they were found in.
  //
  //   tier  cut                     show
  //   0     title hits              title hits
  //   1     unfilled index matches  unfilled index matches
  //   2     the newest notes        the newest notes the index matched
  //   3     `search_text` matches   `search_text` matches (`MAX_MATCHES`)
  //   4     substring matches       substring matches, the newest included
  //
  // The newest notes are cut late because `search.group` filters on Who and When
  // after this, so one cut here cannot be found with them; the index ranks
  // above a substring match when listed, as it always did.
  const placed = new Map<Id<'notes'>, { note: Doc<'notes'>; cut: number; show: number }>()
  const place = (note: Doc<'notes'>, cut: number, show: number) => {
    if (!placed.has(note._id)) placed.set(note._id, { note, cut, show })
  }
  const byIndex = candidates.filter((note) => matches(noteSearchText(note)))
  const indexed = new Set(byIndex.map((note) => note._id))
  for (const note of byIndex) if (inTitle(note)) place(note, 0, 0)
  const bodyHits = byIndex.filter((note) => !inTitle(note))
  for (const note of bodyHits)
    if (note.searchText === undefined) place(note, 1, 1)
  for (const note of bodyHits
    .filter((note) => note.searchText !== undefined)
    .slice(0, MAX_MATCHES))
    place(note, 3, 3)
  // The substring pass: the newest notes, then the candidates the index did not
  // match. An index match cut above is not read back in, but a recent one is.
  for (const note of recent) {
    if (placed.has(note._id)) continue
    const index = indexed.has(note._id) || matches(noteSearchText(note))
    if (!index && !contains(note)) continue
    if (inTitle(note)) place(note, 0, 0)
    else place(note, 2, index ? 2 : 4)
  }
  for (const note of candidates)
    if (!indexed.has(note._id) && contains(note))
      inTitle(note) ? place(note, 0, 0) : place(note, 4, 4)
  const kept = [...placed.values()]
    .sort((a, b) => a.cut - b.cut)
    .slice(0, MAX_ANSWER)
  return kept.sort((a, b) => a.show - b.show).map(({ note }) => note)
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
