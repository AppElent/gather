import type { Doc, Id } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { indexSearch, normalized } from './searchText'

/**
 * How many notes one search reads: this many from each index and
 * `RECENT_NOTES` of the newest, 200 in all, what `search.group` read when it
 * scanned the table.
 */
const MATCHES_PER_INDEX = 50
const RECENT_NOTES = 100
const MIN_QUERY = 2

/**
 * The notes of one Group that contain every word of `text`, in the title, the
 * body, or across the two. The caller has already authorised the Group.
 *
 * Two passes, merged, the first first:
 *
 * 1. The search indexes. A Convex search index covers one field, so there is
 *    one for the title and one for the body; a combined field would need a
 *    backfill of every note. Both filter on `groupId`. They match notes with
 *    *any* word, so that every word is there is checked here, by their own
 *    rule: a word matches whole, and the last one, still being typed, from its
 *    start. They rank best first, and find a note however old it is.
 * 2. A substring check, as every other type on the search screen does
 *    (`search.group`), over the Group's newest `RECENT_NOTES` notes and the
 *    index's other candidates: every word must be somewhere in the text, so
 *    "kaart" finds "wijnkaart". An index cannot do this, so older notes are
 *    reachable only by whole word or prefix. This pass also takes the words
 *    the indexes drop (past the 16th, 32 bytes or more) and a search with no
 *    word in it, such as an emoji.
 *
 * The index check runs on each index's best `MATCHES_PER_INDEX`. A note with
 * one word in its title and another in its body can be missed when more than
 * that many notes match one word as well; that is the read budget, not a page
 * size.
 */
export async function findNotes(
  ctx: QueryCtx,
  groupId: Id<'groups'>,
  text: string,
): Promise<Doc<'notes'>[]> {
  if (text.trim().length < MIN_QUERY) return []
  const { words, search, matches } = indexSearch(text)
  // Every word, or the whole search when it has none (an emoji, "--").
  const needles = (words.length > 0 ? words : [text]).map(normalized)
  const [byTitle, byBody, recent] = await Promise.all([
    search === ''
      ? []
      : ctx.db
          .query('notes')
          .withSearchIndex('search_title', (q) =>
            q.search('title', search).eq('groupId', groupId),
          )
          .take(MATCHES_PER_INDEX),
    search === ''
      ? []
      : ctx.db
          .query('notes')
          .withSearchIndex('search_body', (q) =>
            q.search('body', search).eq('groupId', groupId),
          )
          .take(MATCHES_PER_INDEX),
    ctx.db
      .query('notes')
      .withIndex('by_group_and_updatedAt', (q) => q.eq('groupId', groupId))
      .order('desc')
      .take(RECENT_NOTES),
  ])
  // Title matches first, each part in the index's relevance order.
  const candidates = [...byTitle, ...byBody]
  const byIndex = candidates.filter((note) =>
    matches(`${note.title}\n${note.body}`),
  )
  const found = new Map(byIndex.map((note) => [note._id, note] as const))
  for (const note of [...candidates, ...recent]) {
    if (found.has(note._id)) continue
    const haystack = normalized(`${note.title}\n${note.body}`)
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
