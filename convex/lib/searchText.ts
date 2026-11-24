/** How the Group search compares text: trimmed and lowercased. */
export function normalized(value: string) {
  return value.trim().toLocaleLowerCase()
}

/** Convex searches on at most this many terms. */
const MAX_TERMS = 16

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
 * A search as Convex's search indexes see it: its words, the expression to
 * search with (empty when no word is searchable), and whether a text matches.
 * An index returns rows with *any* word; `matches` asks for every word, by the
 * index's own rule: a word matches whole, and the last one, still being typed,
 * from its start.
 */
export function indexSearch(text: string) {
  const words = wordsOf(text)
  const terms = termsOf(words)
  const whole = terms.slice(0, -1).map(lower)
  const typing = lower(terms[terms.length - 1] ?? '')
  return {
    words,
    search: terms.join(' '),
    matches(value: string) {
      if (terms.length === 0) return false
      const found = new Set(wordsOf(value).map(lower))
      return (
        whole.every((term) => found.has(term)) &&
        [...found].some((word) => word.startsWith(typing))
      )
    },
  }
}
