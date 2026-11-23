import type { Doc, Id } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'

/** Convex searches on at most this many terms. */
const MAX_TERMS = 16
/**
 * How many matches are read from each index. The two together are at most the
 * 200 notes `search.group` read when it scanned the table.
 */
const MATCHES_PER_INDEX = 100
const MIN_QUERY = 2

/** The words of a search, split where Convex's own tokenizer splits. */
function termsOf(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .slice(0, MAX_TERMS)
}

/**
 * The notes of one Group that contain every word of `text`, in the title, the
 * body, or across the two. The caller has already authorised the Group.
 *
 * A Convex search index covers one field, so there is one for the title and
 * one for the body; a combined field would need a backfill of every note.
 * Both filter on `groupId`. The indexes match notes with *any* word, so that
 * every word is there is checked here. Words match from their start: "kaart"
 * does not find "wijnkaart".
 */
export async function findNotes(
  ctx: QueryCtx,
  groupId: Id<'groups'>,
  text: string,
): Promise<Doc<'notes'>[]> {
  if (text.trim().length < MIN_QUERY) return []
  const terms = termsOf(text)
  if (terms.length === 0) return []
  const search = terms.join(' ')
  const [byTitle, byBody] = await Promise.all([
    ctx.db
      .query('notes')
      .withSearchIndex('search_title', (q) =>
        q.search('title', search).eq('groupId', groupId),
      )
      .take(MATCHES_PER_INDEX),
    ctx.db
      .query('notes')
      .withSearchIndex('search_body', (q) =>
        q.search('body', search).eq('groupId', groupId),
      )
      .take(MATCHES_PER_INDEX),
  ])
  // Title matches first, each part in the index's relevance order.
  const notes = new Map(
    [...byTitle, ...byBody].map((note) => [note._id, note] as const),
  )
  return [...notes.values()].filter((note) => {
    const haystack = `${note.title}\n${note.body}`.toLowerCase()
    return terms.every((term) => haystack.includes(term))
  })
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
