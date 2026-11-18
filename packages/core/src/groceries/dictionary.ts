import type { GroceryAisle } from './aisles'
import { GROCERY_AISLES } from './aisles'
import { groceryNameParts, stemGroceryWord } from './normalise'

/**
 * Where a dictionary term came from, as bits, so the eval can score each
 * source on its own and the generator can drop one without a rebuild of the
 * others (`scripts/groceries/build-dictionary.ts`).
 */
export const DICTIONARY_SOURCES = {
  /** Open Food Facts, Open Beauty Facts and Open Products Facts (ODbL). */
  openFacts: 1,
  /** NEVO online 2025/9.0, RIVM (names and food groups only). */
  nevo: 2,
  /** Written by hand for Gather. */
  curated: 4,
} as const

export const ALL_DICTIONARY_SOURCES = 7

/**
 * The bundled terms: per aisle, `key:sources` pairs joined by `|`, where a key
 * is a `groceryKey` and sources is the bit mask above. A key may appear under
 * two aisles when two sources disagree; the earlier source in
 * `SOURCE_PRIORITY` wins.
 */
export type DictionaryData = Partial<Record<GroceryAisle, string>>

/** Which source wins when two disagree about a term. */
const SOURCE_PRIORITY = [
  DICTIONARY_SOURCES.curated,
  DICTIONARY_SOURCES.openFacts,
  DICTIONARY_SOURCES.nevo,
]

export type DictionaryMatch =
  /** The whole name is a term. */
  | 'exact'
  /** The name says it is frozen. */
  | 'frozen'
  /** A run of its words is a term ("halfvolle melk" → "melk"). */
  | 'phrase'
  /** Part of a compound word is a term ("kipdijfilet" → "filet"). */
  | 'compound'
  /** A term one or two typing slips away ("komkommr"). */
  | 'typo'

export interface DictionaryHit {
  aisle: GroceryAisle
  match: DictionaryMatch
  /** The term that matched. */
  term: string
}

export interface GroceryDictionary {
  /** Number of distinct terms. */
  readonly size: number
  /** The aisle of a whole key, exactly; no partial matching. */
  exact(key: string): GroceryAisle | undefined
  /** The aisle of a name, trying the whole name, its parts, then typos. */
  lookup(name: string): DictionaryHit | null
}

const FROZEN_WORDS = new Set(['bevroren', 'frozen', 'diepgevroren', 'diepvries'])

/** Prepositions after which a name stops being about the product. */
const PREPOSITIONS = new Set(['in', 'met', 'with', 'uit', 'zonder', 'voor', 'op'])

/** Two-letter words that are whole products and may end a compound. */
const SHORT_HEADS = new Set(['ui', 'ei'])

export function createGroceryDictionary(
  data: DictionaryData,
  sources: number = ALL_DICTIONARY_SOURCES,
): GroceryDictionary {
  const terms = new Map<string, { aisle: GroceryAisle; rank: number }>()
  for (const aisle of GROCERY_AISLES) {
    const packed = data[aisle]
    if (!packed) continue
    for (const pair of packed.split('|')) {
      const separator = pair.lastIndexOf(':')
      const key = pair.slice(0, separator)
      const mask = Number(pair.slice(separator + 1)) & sources
      if (!key || !mask) continue
      const rank = SOURCE_PRIORITY.findIndex((source) => mask & source)
      const known = terms.get(key)
      if (!known || rank < known.rank) terms.set(key, { aisle, rank })
    }
  }

  const byLength = new Map<number, string[]>()
  for (const key of terms.keys()) {
    if (key.includes(' ')) continue
    const bucket = byLength.get(key.length) ?? []
    bucket.push(key)
    byLength.set(key.length, bucket)
  }

  const exact = (key: string) => terms.get(key)?.aisle

  function phrase(stems: string[]): string | undefined {
    const spaced = stems.join(' ')
    if (terms.has(spaced)) return spaced
    if (stems.length > 1) {
      const joined = stems.join('')
      if (terms.has(joined)) return joined
    }
    return undefined
  }

  function compound(raw: string): string | undefined {
    const word = raw
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ']/g, '')
    // The head of a Dutch compound is its last part: "appelsap" is juice.
    for (let start = 1; start <= word.length - 2; start++) {
      const part = word.slice(start)
      if (part.length < 3 && !SHORT_HEADS.has(part)) continue
      const key = stemGroceryWord(part)
      if (start >= 2 && terms.has(key)) return key
    }
    // Then its first part: "kipdij" in "kipdijfilet" if "filet" is unknown.
    // Four letters at least: shorter first parts are mostly accidents.
    for (let end = word.length - 2; end >= 4; end--) {
      const key = stemGroceryWord(word.slice(0, end))
      if (terms.has(key)) return key
    }
    return undefined
  }

  function typo(stem: string): string | undefined {
    const allowed = stem.length >= 8 ? 2 : stem.length >= 5 ? 1 : 0
    if (allowed === 0) return undefined
    let best: string | undefined
    let bestDistance = allowed + 1
    for (let length = stem.length - allowed; length <= stem.length + allowed; length++) {
      for (const candidate of byLength.get(length) ?? []) {
        const distance = editDistance(stem, candidate, bestDistance)
        if (distance < bestDistance) {
          best = candidate
          bestDistance = distance
        }
      }
    }
    return best
  }

  function hit(term: string | undefined, match: DictionaryMatch) {
    const aisle = term === undefined ? undefined : exact(term)
    return aisle && term !== undefined ? { aisle, match, term } : null
  }

  function lookup(name: string): DictionaryHit | null {
    const rawWords = groceryNameParts(name)
    const stems = rawWords.map(stemGroceryWord)
    if (stems.length === 0) return null

    const whole = hit(phrase(stems), 'exact')
    if (whole) return whole

    if (
      rawWords.some(
        (word) => FROZEN_WORDS.has(word) || word.startsWith('diepvries'),
      )
    )
      return { aisle: 'frozen', match: 'frozen', term: 'diepvries' }

    // The product is named before "in", "met" and the like.
    const cut = stems.findIndex(
      (stem, index) => index > 0 && PREPOSITIONS.has(stem),
    )
    const heads = cut > 0 ? [stems.slice(0, cut), stems] : [stems]
    for (const words of heads) {
      if (words !== stems) {
        const found = hit(phrase(words), 'phrase')
        if (found) return found
      }
      // A modifier comes first in Dutch and English: try dropping from the
      // left ("halfvolle melk"), then from the right ("melk halfvol").
      for (let start = 1; start < words.length; start++) {
        const found = hit(phrase(words.slice(start)), 'phrase')
        if (found) return found
      }
      for (let end = words.length - 1; end >= 1; end--) {
        const found = hit(phrase(words.slice(0, end)), 'phrase')
        if (found) return found
      }
    }

    for (let index = rawWords.length - 1; index >= 0; index--) {
      const found = hit(compound(rawWords[index]), 'compound')
      if (found) return found
    }
    for (let index = stems.length - 1; index >= 0; index--) {
      const found = hit(typo(stems[index]), 'typo')
      if (found) return found
    }
    return null
  }

  return { size: terms.size, exact, lookup }
}

/**
 * Damerau–Levenshtein distance (adjacent swaps count once), giving up as soon
 * as it cannot come in under `limit`.
 */
export function editDistance(a: string, b: string, limit = Infinity): number {
  if (Math.abs(a.length - b.length) >= limit) return limit
  const rows: number[][] = []
  for (let i = 0; i <= a.length; i++) {
    rows.push([i])
    for (let j = 1; j <= b.length; j++) rows[i][j] = i === 0 ? j : 0
  }
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let value = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + cost,
      )
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        value = Math.min(value, rows[i - 2][j - 2] + 1)
      rows[i][j] = value
      rowMin = Math.min(rowMin, value)
    }
    if (rowMin >= limit) return limit
  }
  return rows[a.length][b.length]
}
