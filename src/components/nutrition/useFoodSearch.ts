import { useAction, useQuery } from 'convex/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Doc } from '../../../convex/_generated/dataModel'
import type { OffSearchResult } from '../../../convex/lib/offMapping'

// Open Food Facts documents a 10 search requests/minute cap on its legacy
// search API; search-a-licious (the full-text search service this fallback
// actually calls, see offFetch.ts) doesn't publish its own separate limit,
// so treat 10/min as the conservative ceiling. 6.5s keeps a single tab under
// ~9/min, leaving headroom for the barcode-scan path's OFF calls too.
export const OFF_SEARCH_MIN_INTERVAL_MS = 6500

/** How long the term sits still before either search runs. */
export const SEARCH_DEBOUNCE_MS = 250

/**
 * Open Food Facts is worth querying once local search has definitively
 * resolved to zero results for a term long enough to mean something (3+
 * chars — avoids a network round-trip on every 1-2 character keystroke).
 * `undefined` local results mean the local query has not resolved yet, which
 * is not the same as "no local match".
 */
export function shouldSearchOff(
  term: string,
  localResults: readonly unknown[] | undefined,
): boolean {
  return (
    term.trim().length >= 3 &&
    localResults !== undefined &&
    localResults.length === 0
  )
}

/**
 * Milliseconds to wait before the next OFF call so two never land closer
 * together than OFF_SEARCH_MIN_INTERVAL_MS. A call that arrives too soon is
 * deferred rather than dropped, so the last thing typed is always searched.
 */
export function offSearchWait(now: number, lastCallAt: number): number {
  return Math.max(0, OFF_SEARCH_MIN_INTERVAL_MS - (now - lastCallAt))
}

export interface FoodSearch {
  /** What is in the search box, unthrottled. */
  term: string
  setTerm: (term: string) => void
  /** Local `foods` rows for the debounced term; `undefined` while loading. */
  results: Doc<'foods'>[] | undefined
  /** Open Food Facts matches, or `null` when OFF was not queried at all. */
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
 * Searching for a food: your own rows and Open Food Facts, with the debounce,
 * the per-term cache, the minimum-interval deferral and the discarding of
 * responses for a term you have moved on from. Owns no notion of *choosing*
 * one — that is the caller's, and is why this is reusable between the add
 * dialog and whatever replaces it.
 */
export function useFoodSearch(): FoodSearch {
  const [term, setTerm] = useState('')
  const [debouncedTerm, setDebouncedTerm] = useState('')
  useEffect(() => {
    const id = setTimeout(() => setDebouncedTerm(term), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [term])
  const results = useQuery(api.foods.search, { term: debouncedTerm })

  const [offResults, setOffResults] = useState<OffSearchResult[] | null>(null)
  const [offSearching, setOffSearching] = useState(false)
  const [offError, setOffError] = useState<'searchFailed' | null>(null)
  const offSearchedTermRef = useRef<string | null>(null)
  // Cache each term's OFF results for the hook's lifetime (retyping the same
  // term costs nothing) and never fire two OFF calls closer together than
  // OFF_SEARCH_MIN_INTERVAL_MS — see `offSearchWait`.
  const offSearchCacheRef = useRef<Map<string, OffSearchResult[]>>(new Map())
  const offLastCallAtRef = useRef(0)
  const offSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const searchByName = useAction(api.foodsLookup.searchByName)

  useEffect(() => {
    const searchTerm = debouncedTerm.trim()
    if (!shouldSearchOff(debouncedTerm, results)) {
      setOffResults(null)
      setOffSearching(false)
      offSearchedTermRef.current = null
      return
    }
    if (offSearchedTermRef.current === searchTerm) return
    offSearchedTermRef.current = searchTerm

    const cached = offSearchCacheRef.current.get(searchTerm)
    if (cached) {
      setOffSearching(false)
      setOffError(null)
      setOffResults(cached)
      return
    }

    const runSearch = () => {
      offLastCallAtRef.current = Date.now()
      setOffSearching(true)
      setOffError(null)
      searchByName({ term: searchTerm })
        .then((found) => {
          if (offSearchedTermRef.current !== searchTerm) return
          offSearchCacheRef.current.set(searchTerm, found)
          setOffResults(found)
        })
        .catch(() => {
          if (offSearchedTermRef.current !== searchTerm) return
          setOffError('searchFailed')
        })
        .finally(() => {
          if (offSearchedTermRef.current !== searchTerm) return
          setOffSearching(false)
        })
    }

    const wait = offSearchWait(Date.now(), offLastCallAtRef.current)
    if (wait <= 0) {
      runSearch()
    } else {
      setOffSearching(true)
      offSearchTimeoutRef.current = setTimeout(runSearch, wait)
    }
    return () => {
      if (offSearchTimeoutRef.current) clearTimeout(offSearchTimeoutRef.current)
    }
  }, [debouncedTerm, results, searchByName])

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
