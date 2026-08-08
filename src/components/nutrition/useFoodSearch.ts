import { useAction, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { barcodeTerm } from '../../../convex/lib/offFetch'
import type { OffSearchResult } from '../../../convex/lib/offMapping'
import { useI18n } from '../../lib/i18n'

/** How long the term sits still before the local search runs. */
export const SEARCH_DEBOUNCE_MS = 250

/**
 * How long it sits still before Open Food Facts is asked.
 *
 * Open Food Facts documents a 10 search requests/minute cap on its legacy
 * search API; search-a-licious (the service this actually calls, see
 * offFetch.ts) publishes no separate limit, so treat 10/min as the ceiling.
 *
 * This used to be a 6.5s *minimum interval between calls*, which kept the
 * volume down by making the second thing you searched for sit there doing
 * nothing. A debounce spends the same budget without the stall: continuous
 * typing produces one request per pause rather than one per keystroke, the
 * three-character floor drops the first keystrokes of every term, and the
 * per-term cache means backspacing and retyping costs nothing. Naming a
 * product is a handful of requests, well inside the ceiling.
 */
export const OFF_SEARCH_DEBOUNCE_MS = 400

/**
 * Whether the term is a barcode, and so resolves by lookup rather than by
 * search. Re-exported from `convex/lib/offFetch` rather than restated: the
 * pattern that decides what a lookup will accept is the one that decides
 * whether to make one.
 */
export { barcodeTerm }

/**
 * Whether a term is worth asking Open Food Facts about at all.
 *
 * Three characters, because a one- or two-character term is somebody still
 * typing and matches half the catalogue. Deliberately *not* conditioned on the
 * local results: local and external now run concurrently and both sections
 * render, where the external search used to be gated on local returning
 * exactly zero rows — one poor local match suppressed the whole catalogue.
 */
export function shouldSearchOff(term: string): boolean {
  return term.trim().length >= 3
}

/** What the per-term cache is keyed by: the same term in another language is another search. */
export function offCacheKey(term: string, locale: string): string {
  return `${locale}:${term}`
}

/**
 * A local match, as the query hands it over: the row plus a URL for its
 * picture. Read off the function rather than restated, so a field the query
 * starts or stops returning is a compile error here.
 */
export type FoodSearchResult = FunctionReturnType<
  typeof api.foods.search
>[number]

export interface FoodSearch {
  /** What is in the search box, unthrottled. */
  term: string
  setTerm: (term: string) => void
  /** Local `foods` rows for the debounced term; `undefined` while loading. */
  results: FoodSearchResult[] | undefined
  /** Open Food Facts matches, or `null` when OFF was not asked at all. */
  offResults: OffSearchResult[] | null
  offSearching: boolean
  /**
   * A key, not a sentence — a message read inside the search effect would
   * make the effect depend on the locale (ADR-0011).
   */
  offError: 'searchFailed' | null
  clearOffError: () => void
}

/**
 * Searching for a food: your own rows and Open Food Facts, concurrently, with
 * the debounce, the per-term cache and the discarding of responses for a term
 * you have moved on from. Owns no notion of *choosing* one — that is the
 * caller's, and is why this is reusable between the add dialog and whatever
 * replaces it.
 */
export function useFoodSearch(): FoodSearch {
  const { locale } = useI18n()
  const [term, setTerm] = useState('')

  const [debouncedTerm, setDebouncedTerm] = useState('')
  useEffect(() => {
    const id = setTimeout(() => setDebouncedTerm(term), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [term])

  // Read off the *debounced* term, so the mode is only ever decided about a
  // term somebody has stopped typing: the digits of a barcode arriving one at a
  // time never flip the list between a text search and a lookup on the way.
  const localBarcode = barcodeTerm(debouncedTerm)
  // The full-text index is built from name and brand (`foodSearchText.ts`), so
  // a barcode put through it matches nothing. The row is found by its barcode
  // instead — and found rather than imported, which is what keeps a product you
  // already have from being overwritten by Open Food Facts' version of it.
  const textMatches = useQuery(
    api.foods.search,
    localBarcode ? 'skip' : { term: debouncedTerm },
  )
  const barcodeMatch = useQuery(
    api.foods.getByBarcode,
    localBarcode ? { barcode: localBarcode } : 'skip',
  )
  const results: FoodSearchResult[] | undefined = localBarcode
    ? barcodeMatch === undefined
      ? undefined
      : barcodeMatch
        ? [barcodeMatch]
        : []
    : textMatches

  const [offTerm, setOffTerm] = useState('')
  useEffect(() => {
    const id = setTimeout(() => setOffTerm(term.trim()), OFF_SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [term])

  const [offResults, setOffResults] = useState<OffSearchResult[] | null>(null)
  const [offSearching, setOffSearching] = useState(false)
  const [offError, setOffError] = useState<'searchFailed' | null>(null)
  // Cache each term's OFF results for the hook's lifetime — retyping a term,
  // or backspacing back into one, costs nothing.
  const offCacheRef = useRef<Map<string, OffSearchResult[]>>(new Map())

  const searchByName = useAction(api.foodsLookup.searchByName)
  const lookupBarcode = useAction(api.foodsLookup.lookupBarcode)

  useEffect(() => {
    const barcode = barcodeTerm(offTerm)
    if (!barcode && !shouldSearchOff(offTerm)) {
      setOffResults(null)
      setOffSearching(false)
      return
    }

    const cached = offCacheRef.current.get(offCacheKey(offTerm, locale))
    if (cached) {
      setOffSearching(false)
      setOffError(null)
      setOffResults(cached)
      return
    }

    // Nothing is known about this term yet, and what is on screen answers the
    // last one. Leaving it there would show results for a search somebody has
    // moved on from — and let them import one — under the term they are now
    // looking at.
    setOffResults(null)
    // A Convex action cannot be recalled once sent, so "cancelling" the
    // in-flight request means refusing its answer: this flips on cleanup, and
    // every branch below checks it before touching state. Without it a slow
    // response for a term you have moved on from arrives last and wins.
    let abandoned = false
    setOffSearching(true)
    setOffError(null)
    // A barcode is a lookup, not a search — but it goes through the same
    // debounce, the same cache and the same abandonment as a name, because the
    // rate ceiling is about how often this hook reaches Open Food Facts, not
    // about which endpoint it reaches it by. A product the lookup has is one
    // result; a barcode nobody has is none, which is the empty result the
    // caller already turns into "not found — add it yourself".
    const ask: Promise<OffSearchResult[]> = barcode
      ? lookupBarcode({ barcode }).then((mapped) =>
          mapped ? [{ ...mapped, barcode }] : [],
        )
      : searchByName({ term: offTerm, locale })
    ask
      .then((found) => {
        if (abandoned) return
        offCacheRef.current.set(offCacheKey(offTerm, locale), found)
        setOffResults(found)
      })
      .catch(() => {
        if (abandoned) return
        setOffError('searchFailed')
      })
      .finally(() => {
        if (abandoned) return
        setOffSearching(false)
      })

    return () => {
      abandoned = true
    }
  }, [offTerm, locale, searchByName, lookupBarcode])

  const clearOffError = useCallback(() => setOffError(null), [])

  return {
    term,
    setTerm,
    results,
    offResults,
    offSearching,
    offError,
    clearOffError,
  }
}
