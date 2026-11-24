import type { Doc, Id } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { normalized } from './searchText'

/** Convex searches on at most this many terms. */
const MAX_TERMS = 16
/**
 * How many notes one search reads: this many from each index and
 * `RECENT_NOTES` of the newest, 200 in all, what `search.group` read when it
 * scanned the table.
 */
const MATCHES_PER_INDEX = 50
const RECENT_NOTES = 100
const MIN_QUERY = 2

/** Convex leaves longer words (in UTF-8 bytes) out of its search indexes. */
const MAX_TERM_BYTES = 31

/**
 * The words of a text, split where Convex's own tokenizer splits: only letters,
 * combining marks that belong to a word (Thai, Hindi, pointed Arabic and
 * Hebrew) and digits stay in one. Split before lowercasing, as it does: "İ"
 * lowercases to a letter and a mark.
 */
function wordsOf(text: string): string[] {
  return text.split(/[^\p{Alphabetic}\p{N}]+/u).filter(Boolean)
}

/** Lowercase letter by letter, as Convex does: a final "Σ" becomes "σ". */
function lower(word: string): string {
  return Array.from(word, (letter) => letter.toLowerCase()).join('')
}

/** The words of a search that the indexes can match. */
function termsOf(words: string[]): string[] {
  const encoder = new TextEncoder()
  return words
    .filter((word) => encoder.encode(word).length <= MAX_TERM_BYTES)
    .slice(0, MAX_TERMS)
}

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
  const words = wordsOf(text)
  const terms = termsOf(words)
  // Every word, or the whole search when it has none (an emoji, "--").
  const needles = (words.length > 0 ? words : [text]).map(normalized)
  const search = terms.join(' ')
  const [byTitle, byBody, recent] = await Promise.all([
    terms.length === 0
      ? []
      : ctx.db
          .query('notes')
          .withSearchIndex('search_title', (q) =>
            q.search('title', search).eq('groupId', groupId),
          )
          .take(MATCHES_PER_INDEX),
    terms.length === 0
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
  const whole = terms.slice(0, -1).map(lower)
  const typing = lower(terms[terms.length - 1] ?? '')
  const byIndex = candidates.filter((note) => {
    const noteWords = new Set(
      wordsOf(`${note.title}\n${note.body}`).map(lower),
    )
    return (
      whole.every((term) => noteWords.has(term)) &&
      [...noteWords].some((word) => word.startsWith(typing))
    )
  })
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
