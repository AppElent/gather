import { useEffect, useState } from 'react'

const SEARCH_DELAY_MS = 200

/** A search field's text once typing pauses, so a query is not asked per key. */
export function useDebouncedQuery(query: string) {
  const [debounced, setDebounced] = useState(query)
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(query), SEARCH_DELAY_MS)
    return () => clearTimeout(timeout)
  }, [query])
  return debounced
}
