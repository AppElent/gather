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

/** Convex leaves longer words (in UTF-8 bytes) out of its search indexes. */
const MAX_TERM_BYTES = 31

/**
 * The words of a text, split where Convex's own tokenizer splits. Split before
 * lowercasing, as it does: "İ" lowercases to a letter and a mark.
 */
function wordsOf(text: string): string[] {
  return text.split(/[^\p{L}\p{N}]+/u).filter(Boolean)
}

/** Lowercase letter by letter, as Convex does: a final "Σ" becomes "σ". */
function lower(word: string): string {
  return Array.from(word, (letter) => letter.toLowerCase()).join('')
}

/** The words of a search that the indexes can match. */
function termsOf(text: string): string[] {
  const encoder = new TextEncoder()
  return wordsOf(text)
    .filter((word) => encoder.encode(word).length <= MAX_TERM_BYTES)
    .slice(0, MAX_TERMS)
}

/**
 * The notes of one Group that contain every word of `text`, in the title, the
 * body, or across the two. The caller has already authorised the Group.
 *
 * A Convex search index covers one field, so there is one for the title and
 * one for the body; a combined field would need a backfill of every note.
 * Both filter on `groupId`. The indexes match notes with *any* word, so that
 * every word is there is checked here, by their own rule: a word matches
 * whole, and the last one, still being typed, from its start. So "kaart" does
 * not find "wijnkaart".
 *
 * The check runs on each index's best `MATCHES_PER_INDEX`. A note with one
 * word in its title and another in its body can be missed when more than that
 * many notes match one word as well; that is the read budget, not a page size.
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
  const whole = terms.slice(0, -1).map(lower)
  const typing = lower(terms[terms.length - 1])
  return [...notes.values()].filter((note) => {
    const words = new Set(
      wordsOf(`${note.title}\n${note.body}`).map(lower),
    )
    return (
      whole.every((term) => words.has(term)) &&
      [...words].some((word) => word.startsWith(typing))
    )
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
