import { useAction, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
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
  const results = useQuery(api.foods.search, { term: debouncedTerm })

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

  useEffect(() => {
    if (!shouldSearchOff(offTerm)) {
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

    // A Convex action cannot be recalled once sent, so "cancelling" the
    // in-flight request means refusing its answer: this flips on cleanup, and
    // every branch below checks it before touching state. Without it a slow
    // response for a term you have moved on from arrives last and wins.
    let abandoned = false
    setOffSearching(true)
    setOffError(null)
    searchByName({ term: offTerm, locale })
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
  }, [offTerm, locale, searchByName])

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
