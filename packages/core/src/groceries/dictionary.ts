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

/**
 * Words under four letters that are whole products. Any other word needs
 * four letters to end a compound or stand for a whole name: shorter pieces
 * are mostly accidents ("tandpasat" is not "saté", "runderlappen" is not
 * "peen", "wit" in "druiven wit" is not a beer).
 */
const SHORT_WORDS = new Set([
  'ui', 'ei', 'sap', 'jam', 'ham', 'ijs', 'mie', 'vis', 'kip', 'bes', 'rum',
  'gin', 'ale', 'tea', 'oat', 'sla', 'cod', 'fig', 'yam', 'deo',
])

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
    const word = plain(raw)
    // The head of a Dutch compound is its last part: "appelsap" is juice.
    for (let start = 1; start <= word.length - 2; start++) {
      const part = word.slice(start)
      if (part.length < 4 && !SHORT_WORDS.has(part)) continue
      const key = stemGroceryWord(part)
      if (key.length < 3 && !SHORT_WORDS.has(key)) continue
      if (start >= 3 && terms.has(key)) return key
    }
    // Then its first part: "kipdij" in "kipdijfilet" if "filet" is unknown.
    // Four letters at least: shorter first parts are mostly accidents.
    for (let end = word.length - 2; end >= 4; end--) {
      const key = stemGroceryWord(word.slice(0, end))
      if (terms.has(key)) return key
    }
    return undefined
  }

  function typo(stem: string, most = 2): string | undefined {
    const allowed = Math.min(most, stem.length >= 8 ? 2 : stem.length >= 5 ? 1 : 0)
    if (allowed === 0) return undefined
    let best: string | undefined
    let bestDistance = allowed + 1
    for (let length = stem.length - allowed; length <= stem.length + allowed; length++) {
      for (const candidate of byLength.get(length) ?? []) {
        // A slip rarely hits the first letter, and a different first letter
        // is most often a different word ("Fairy" is not "dairy").
        if (candidate[0] !== stem[0] || candidate.length < 5) continue
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

  // Part of a longer name only counts when it is a real word on its own:
  // "wit" in "druiven wit" is not a beer. Measured on the typed words, since
  // stems drop letters ("kaas" → "kas").
  function partHit(stems: string[], raw: string[], from: number, to: number) {
    if (to - from === 1 && raw[from].length < 4 && !SHORT_WORDS.has(raw[from]))
      return null
    return hit(phrase(stems.slice(from, to)), 'phrase')
  }

  function lookup(name: string): DictionaryHit | null {
    const found = find(name)
    // Ground, powdered or flaked produce is a spice: "paprika powder",
    // "laurierblaadjes" and "chilivlokken" sit with the jars, not the fresh.
    if (found?.aisle === 'produce' && groceryNameParts(name).some(isDryWord))
      return { ...found, aisle: 'tins_sauces' }
    return found
  }

  function find(name: string): DictionaryHit | null {
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
    // A name that starts with a frozen brand or product is sold frozen:
    // "Iglo spinazie", "ijs aardbei".
    if (stems.length > 1 && exact(stems[0]) === 'frozen')
      return { aisle: 'frozen', match: 'frozen', term: stems[0] }

    // The product is named before "in", "met" and the like.
    const cut = stems.findIndex(
      (stem, index) => index > 0 && PREPOSITIONS.has(stem),
    )
    const ends = cut > 0 ? [cut, stems.length] : [stems.length]
    for (const length of ends) {
      if (length !== stems.length) {
        const found = partHit(stems, rawWords, 0, length)
        if (found) return found
      }
      // A modifier comes first in Dutch and English: try dropping from the
      // left ("halfvolle melk"), then from the right ("melk halfvol").
      for (let start = 1; start < length; start++) {
        const found = partHit(stems, rawWords, start, length)
        if (found) return found
      }
      // Dutch puts the product last, so a compound there names it better
      // than the words before it ("Knorr wereldpasta" is pasta).
      if (length > 1) {
        const last = hit(compound(rawWords[length - 1]), 'compound')
        if (last) return last
      }
      for (let end = length - 1; end >= 1; end--) {
        const found = partHit(stems, rawWords, 0, end)
        if (found) return found
      }
    }

    for (let index = rawWords.length - 1; index >= 0; index--) {
      // A word one slip from a whole term is that term, before any piece of
      // it is: "chocola" is chocolate, not cola.
      const near = typo(stems[index], 1)
      const found =
        (near && near.length >= stems[index].length ? hit(near, 'typo') : null) ??
        hit(compound(rawWords[index]), 'compound')
      if (found) return found
    }
    for (let index = stems.length - 1; index >= 0; index--) {
      // The stem of a misspelt word can lose more than the slip ("koffe" →
      // "kof"), so the word as typed gets a try against the terms too.
      const found =
        hit(typo(stems[index]), 'typo') ?? hit(typo(plain(rawWords[index])), 'typo')
      if (found) return found
    }
    return null
  }

  return { size: terms.size, exact, lookup }
}

/** Words that say a herb or vegetable is sold dry, as a spice. */
const DRY_WORDS = new Set(['poeder', 'powder', 'gemalen', 'ground', 'vlokken', 'flakes'])
const DRY_ENDINGS = ['poeder', 'vlokken', 'blaadjes']

function isDryWord(raw: string): boolean {
  const word = plain(raw)
  return DRY_WORDS.has(word) || DRY_ENDINGS.some((ending) => word.endsWith(ending))
}

/** A typed word in lower case without accents or apostrophes. */
function plain(word: string): string {
  return word
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ']/g, '')
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
