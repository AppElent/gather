/**
 * The phone's one query module: the `last-known` flavor of the Convex query
 * caching standard (`docs/standards/convex-query-caching.md`), adapted from its
 * starters. Screens import `useQuery`, `useQueries` and `usePaginatedQuery`
 * (and `useLiveQuery`/`useLiveQueries`) from here and never from
 * `convex/react`; Biome refuses the direct import everywhere but the query
 * boundary files.
 *
 * **Layer 1, retention.** After the last screen reading a query unmounts, its
 * subscription stays open for `EXPIRATION_MS`, at most `MAX_IDLE_ENTRIES` of
 * them, so going back to a tab answers from the socket's copy instead of a
 * loading state. One provider (`QueryCacheProvider.tsx`) applies them to every
 * query; there are no per-query lifetimes. `usePaginatedQuery` passes through
 * unretained.
 *
 * **Layer 2, last-known copy.** For the functions in `PERSISTED`, `useQuery`
 * and `useQueries` also keep a disposable copy on disk (`lastKnown.ts`) and
 * show it while authenticated and connected until the live answer replaces
 * it. Only what the screen draws is kept. Everything else reads live only.
 *
 * **Offline-readable copy.** `OFFLINE_READABLE` names the modules whose copy
 * the auth gate's offline fallback may show, without Convex, for the account
 * Convex last confirmed on this phone (`features/loyalty-cards/offline`).
 *
 * The values and allowlists are recorded in `CODING_STANDARDS.md`. The
 * provider lives in its own file because it needs React Native's `AppState`.
 */
import type { OptionalRestArgsOrSkip, RequestForQueries } from 'convex/react'
import { useConvexAuth } from 'convex/react'
import type { FunctionReference, FunctionReturnType } from 'convex/server'
import { getFunctionName } from 'convex/server'
import type { Value } from 'convex/values'
import {
  useQueries as useRetainedQueries,
  useQuery as useRetainedQuery,
} from 'convex-helpers/react/cache'
import { createContext, useContext, useEffect, useMemo, useRef } from 'react'

import { entryKey, readEntry, writeEntry } from './lastKnown'

export { usePaginatedQuery } from 'convex/react'

export const EXPIRATION_MS = 5 * 60_000
export const MAX_IDLE_ENTRIES = 20

type Shape = (value: Value) => Value

/** The fields a Loyalty card screen draws, and nothing else: no photos, no
 * note, no usage. The logo and barcode are derived on the phone. */
export const DRAWN_CARD_FIELDS = [
  '_id',
  'storeName',
  'catalogKey',
  'brandColor',
  'cardNumber',
  'barcodeFormat',
  'holder',
] as const

function pick(fields: readonly string[]): Shape {
  return (value) => {
    if (!Array.isArray(value)) return []
    return value.map((item) => {
      if (typeof item !== 'object' || item === null) return null
      const row = item as Record<string, Value>
      const kept: Record<string, Value> = {}
      for (const field of fields)
        if (row[field] !== undefined) kept[field] = row[field]
      return kept
    })
  }
}

/**
 * The persisted functions, each with what its screen draws. A function not
 * named here never touches disk. `loyaltyCards:get` is left out on purpose:
 * it carries photo URLs, and the list already holds every card's drawn fields.
 *
 * Until the live answer arrives, `useQuery` returns this trimmed copy under
 * the function's full return type: every field not kept here (a card's
 * `lastUsedAt`, `note`, `hasPhotos`) is briefly `undefined`. A screen that
 * must not draw without such a field reads it with `useLiveQuery`, or the
 * field is added here.
 */
export const PERSISTED: Record<string, Shape> = {
  'loyaltyCards:list': pick(DRAWN_CARD_FIELDS),
}

/** Backend modules the offline fallback may read. Each is also persisted. */
export const OFFLINE_READABLE = new Set(['loyaltyCards'])

/** Whether the offline fallback may read this function's copy. */
export function isOfflineReadable(name: string) {
  return Boolean(PERSISTED[name]) && OFFLINE_READABLE.has(name.split(':')[0])
}

/** The disk scope of the confirmed account, set by `QueryCacheProvider` only
 * while the socket is connected; `undefined` otherwise. */
export const DiskScopeContext = createContext<string | undefined>(undefined)

function cacheKey(
  scope: string | undefined,
  query: FunctionReference<'query'>,
  args: unknown,
) {
  if (!scope || args === 'skip') return undefined
  try {
    const name = getFunctionName(query)
    if (!PERSISTED[name]) return undefined
    const key = entryKey(scope, name, args as Value)
    return key ? { key, shape: PERSISTED[name] } : undefined
  } catch {
    return undefined
  }
}

/** Disk is read only while Convex is authenticated and connected. The
 * provider follows the connection, so a screen does not re-render on every
 * request count the connection state carries. */
function useDiskScope() {
  const scope = useContext(DiskScopeContext)
  const { isAuthenticated } = useConvexAuth()
  return isAuthenticated ? scope : undefined
}

/** Live-only: retained subscriptions, never disk values. For forms, and for
 * state that must be current. */
export const useLiveQueries = useRetainedQueries
export function useLiveQuery<Q extends FunctionReference<'query'>>(
  query: Q,
  ...args: OptionalRestArgsOrSkip<Q>
) {
  return useRetainedQuery(query, ...args) as FunctionReturnType<Q> | undefined
}

/** Display reads: the live value, or the last-known copy until it arrives. */
export function useQuery<Q extends FunctionReference<'query'>>(
  query: Q,
  ...args: OptionalRestArgsOrSkip<Q>
) {
  const live = useLiveQuery(query, ...args)
  const entry = cacheKey(useDiskScope(), query, args[0] ?? {})
  const key = entry?.key
  const shape = entry?.shape
  const cached = useMemo(() => (key ? readEntry(key) : undefined), [key])
  useEffect(() => {
    if (key && shape && live !== undefined) writeEntry(key, shape(live as Value))
  }, [key, shape, live])
  return (live === undefined ? cached : live) as
    | FunctionReturnType<Q>
    | undefined
}

/** Batched display reads; `undefined` and errors per request stay as they are. */
export function useQueries(
  queries: RequestForQueries,
): ReturnType<typeof useRetainedQueries> {
  const live = useLiveQueries(queries)
  const scope = useDiskScope()
  // `queries` is a new object every render. The keys, and which of them still
  // wait for a live answer, are reduced to JSON strings so the memos below
  // re-read disk only when one of those actually changes.
  const keySignature = JSON.stringify(
    Object.entries(queries).map(([id, { query, args }]) => [
      id,
      cacheKey(scope, query, args)?.key ?? null,
      getFunctionName(query),
    ]),
  )
  const keys = useMemo(
    () => JSON.parse(keySignature) as [string, string | null, string][],
    [keySignature],
  )
  const pendingSignature = JSON.stringify(
    keys.filter(([id, key]) => key && live[id] === undefined),
  )
  const cached = useMemo(
    () =>
      new Map(
        (JSON.parse(pendingSignature) as [string, string][]).map(
          ([id, key]) => [id, readEntry(key)],
        ),
      ),
    [pendingSignature],
  )
  const lastWritten = useRef(new Map<string, unknown>())
  useEffect(() => {
    const next = new Map<string, unknown>()
    for (const [id, key, name] of keys) {
      const value = live[id]
      if (!key || value === undefined || value instanceof Error) continue
      if (!next.has(key) && !Object.is(lastWritten.current.get(key), value))
        writeEntry(key, PERSISTED[name](value as Value))
      next.set(key, value)
    }
    lastWritten.current = next
  }, [keys, live])
  return Object.fromEntries(
    Object.keys(queries).map((id) => [
      id,
      live[id] === undefined ? cached.get(id) : live[id],
    ]),
  )
}
