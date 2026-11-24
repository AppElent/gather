import type { WithoutSystemFields } from 'convex/server'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { indexSearch, normalized } from './searchText'

/** Of the notes `search_text` matches without the title, a search answers this many. */
const MAX_MATCHES = 100
/** In all, with the title hits, the unfilled notes and the substring matches. */
const MAX_ANSWER = 2 * MAX_MATCHES
/**
 * How far one search reads in `search_text`, whatever it finds on the way:
 * Convex refuses to read past 1024 search results, and `MAX_CANDIDATE_CHARS`
 * of text (1-3 bytes each, stored twice) keeps long notes well inside a
 * query's 16 MiB.
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
 * `search_text`'s notes for a search, best first, until the candidate or
 * character budget is spent. The index ranks notes with *any* word and does not
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
  let chars = 0
  for await (const note of ctx.db
    .query('notes')
    .withSearchIndex('search_text', (q) =>
      q.search('searchText', search).eq('groupId', groupId),
    )) {
    candidates.push(note)
    chars += noteSearchText(note).length
    if (candidates.length >= MAX_CANDIDATES || chars >= MAX_CANDIDATE_CHARS)
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
 * body, or across the two. The caller has already authorised the Group. Notes
 * whose title has every word come first, then the rest, each in the order
 * found, then the answer is cut at `MAX_ANSWER`, so a title hit is cut only
 * when that many have one. Of the other `search_text` matches, `MAX_MATCHES`
 * stay; the newest notes and the substring matches below fill the rest
 * (APP-806).
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
  const titleFirst = (notes: Doc<'notes'>[]) => [
    ...notes.filter(inTitle),
    ...notes.filter((note) => !inTitle(note)),
  ]
  // The index's matches. Title hits all stay, up to the answer cap. Of the
  // others, `MAX_MATCHES` of `search_text`'s stay, and every unfilled one, which
  // the old indexes bound (`FALLBACK_MATCHES`) and only they can find.
  const byIndex = candidates.filter((note) => matches(noteSearchText(note)))
  const indexed = new Set(byIndex.map((note) => note._id))
  let filledBody = 0
  const inBudget = titleFirst(byIndex).filter(
    (note) =>
      inTitle(note) ||
      note.searchText === undefined ||
      (filledBody += 1) <= MAX_MATCHES,
  )
  const taken = new Set(inBudget.map((note) => note._id))
  // The substring pass: the newest notes first, then the candidates the index
  // did not match. An index match cut above is not read back in here, but a
  // recent one is, as it was before the cap.
  const contains = (note: Doc<'notes'>) => {
    const haystack = normalized(noteSearchText(note))
    return needles.every((needle) => haystack.includes(needle))
  }
  const recentIds = new Set(recent.map((note) => note._id))
  const extra = new Map<Id<'notes'>, Doc<'notes'>>()
  for (const note of [...recent, ...candidates])
    if (
      !taken.has(note._id) &&
      !extra.has(note._id) &&
      (!indexed.has(note._id) || recentIds.has(note._id)) &&
      contains(note)
    )
      extra.set(note._id, note)
  return titleFirst([...inBudget, ...titleFirst([...extra.values()])]).slice(
    0,
    MAX_ANSWER,
  )
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
