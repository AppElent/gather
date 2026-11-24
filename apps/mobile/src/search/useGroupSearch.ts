import type { FunctionArgs } from 'convex/server'
import { useEffect, useMemo, useRef } from 'react'

import { api } from '../convex/api'
import { useQueries } from '../convex/queries'
import { reportError } from '../observability/report'
import type { serverFilters } from './searchFilters'
import type { QueryResult } from './searchResults'

type SearchArgs = FunctionArgs<typeof api.search.group>
type Answer = QueryResult[] | Error | undefined
type Held = {
  key: string
  plain: QueryResult[] | undefined
  last: QueryResult[] | undefined
}

/**
 * An older server from before APP-633 rejects unknown filter arguments with
 * Convex's `ArgumentValidationError`. That fallback is expected and stays
 * quiet; any other error is reported so a real failure is not swallowed.
 */
function isArgumentValidationError(error: Error): boolean {
  return (
    error.name === 'ArgumentValidationError' ||
    /ArgumentValidationError/.test(error.message)
  )
}

/**
 * Stable key for deduplicating repeated failures within one mount: Convex
 * embeds a fresh request id in every server error message, which must not turn
 * one broken filter into a new Sentry report on every query change.
 */
function errorKey(error: Error): string {
  const message = error.message.replace(/\s*\[Request ID: [^\]]+\]/g, '')
  return `${error.name}:${message}`
}

/** One search as a batched request, so its error is a value and not a throw. */
function useSearch(args: SearchArgs | null): Answer {
  const key = args ? JSON.stringify(args) : null
  const requests = useMemo(
    () =>
      key === null
        ? {}
        : {
            rows: {
              query: api.search.group,
              args: JSON.parse(key) as SearchArgs,
            },
          },
    [key],
  )
  return useQueries(requests as Parameters<typeof useQueries>[0]).rows as Answer
}

/**
 * The rows for one search, narrowed by the server where it can (APP-633).
 *
 * When the filtered search has no rows to give, the plain one answers and the
 * screen filters it, as it did before the server could. That is the case when:
 *
 * - it failed: a server from before APP-633 refuses unknown filter arguments
 *   with an `ArgumentValidationError`, which is expected and falls back
 *   quietly (retire this compatibility fallback once no pre-APP-633 server
 *   remains). Any other failure (for example `Invalid time zone`,
 *   `Invalid date`, or a bug in the server filter) still falls back to the
 *   plain search so the member is not blocked, and is reported to Sentry once
 *   per distinct error message per mount (APP-760) because the plain search
 *   can still succeed and hide it. If the plain search fails as well, that
 *   throws to the screen's error boundary.
 * - it found nothing: the plain rows tell "nothing with these filters" from
 *   "nothing at all", which offer different ways back.
 *
 * While a new query for the same search (`args`) is loading — or offline and
 * unable to answer — this returns the last plain rows seen for that search
 * when available, or otherwise the previous rows seen for it (APP-759). The
 * screen filters those locally instead of flashing a loading skeleton, without
 * keeping a second plain subscription open.
 */
export function useGroupSearch(
  args: SearchArgs | null,
  filters: ReturnType<typeof serverFilters>,
): QueryResult[] | undefined {
  const argsKey = args ? JSON.stringify(args) : null
  const narrowed = useSearch(args && filters ? { ...args, ...filters } : null)
  const usePlain =
    !filters ||
    narrowed instanceof Error ||
    (narrowed !== undefined && narrowed.length === 0)
  const plain = useSearch(args && usePlain ? args : null)

  const reportedErrors = useRef<Set<string> | null>(null)
  useEffect(() => {
    if (!(narrowed instanceof Error) || isArgumentValidationError(narrowed)) {
      return
    }
    if (reportedErrors.current === null) {
      reportedErrors.current = new Set()
    }
    const key = errorKey(narrowed)
    if (reportedErrors.current.has(key)) return
    reportedErrors.current.add(key)
    reportError(narrowed)
  }, [narrowed])

  const held = useRef<Held | null>(null)
  const same =
    argsKey !== null && held.current?.key === argsKey ? held.current : null
  const livePlain = plain instanceof Error ? undefined : plain
  const liveNarrowed = narrowed instanceof Error ? undefined : narrowed
  const live = usePlain ? livePlain : liveNarrowed
  const nextPlain = livePlain ?? same?.plain
  const nextLast = live ?? same?.last

  useEffect(() => {
    if (
      argsKey === null ||
      (nextPlain === undefined && nextLast === undefined)
    ) {
      held.current = null
    } else {
      held.current = { key: argsKey, plain: nextPlain, last: nextLast }
    }
  }, [argsKey, nextPlain, nextLast])

  if (usePlain && plain instanceof Error) throw plain
  if (argsKey === null) return undefined
  if (live !== undefined) return live
  return nextPlain ?? nextLast
}
