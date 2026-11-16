/**
 * Layer 2 of the `last-known` flavor: a disposable copy of a few query results
 * on this phone, in the one key-value store (`expo-sqlite/kv-store`, the same
 * synchronous store `prefs/localPreference.ts` uses). Standard:
 * `docs/standards/convex-query-caching.md`.
 *
 * It is a copy, never the data. Every key names the bundle, the account, the
 * function and its arguments, so new code never reads an old shape and one
 * account never reads another's. Every failure (no store, a throw, a value that
 * will not parse) is a miss: the caller waits for Convex exactly as it would
 * with no copy at all. There are no tables, schemas or migrations to keep.
 *
 * Beside the entries sits one marker: the account Convex last confirmed on
 * this phone. The auth gate's offline fallback only reads a copy for the
 * account Clerk restored locally when it matches that marker. Confirmed
 * sign-out deletes the marker and every entry together (`clearLastKnown`).
 *
 * The allowlists of what persists live in `queries.ts`, not here.
 */
import { convexToJson, jsonToConvex, type Value } from 'convex/values'

type KvStore = typeof import('expo-sqlite/kv-store').default

/**
 * The store, loaded on first use rather than imported: a missing native
 * module, or a Node test run, is then a cache miss like any other failure,
 * and the pure modules that import `queries.ts` still load in Node.
 */
function store(): KvStore {
  return testStore ?? require('expo-sqlite/kv-store').default
}

let testStore: KvStore | undefined
/** Tests only: an in-memory store in place of SQLite (`undefined` restores). */
export function setStoreForTests(fake: KvStore | undefined) {
  testStore = fake
}

const PREFIX = 'qc|'
const MARKER = `${PREFIX}confirmed-account`
/** Values above this are not written; recorded in `CODING_STANDARDS.md`. */
export const MAX_VALUE_LENGTH = 100_000
/** At most this many entries; recorded in `CODING_STANDARDS.md`. */
export const MAX_ENTRIES = 50

let bundle: string | undefined
/**
 * The JS bundle this code shipped in: the native runtime (a fingerprint, so a
 * new native build changes it) plus the over-the-air update id. A copy written
 * by any other bundle is never read. Fixed for the life of the bundle, so it
 * is read once.
 */
export function bundleVersion(): string {
  if (bundle === undefined) {
    try {
      const Updates: typeof import('expo-updates') = require('expo-updates')
      bundle = `${Updates.runtimeVersion ?? 'dev'}+${Updates.updateId ?? 'embedded'}`
    } catch {
      bundle = 'unknown'
    }
  }
  return bundle
}

/** The key prefix for one account's entries in this bundle. */
export function diskScope(account: string, bundle = bundleVersion()) {
  return `${PREFIX}${JSON.stringify([bundle, account])}|`
}

/** The entry key for one query in a scope, or undefined if it cannot be made. */
export function entryKey(scope: string, name: string, args: Value) {
  try {
    return `${scope}${name}|${JSON.stringify(convexToJson(args))}`
  } catch {
    return undefined
  }
}

function cacheKeys(): string[] {
  return store().getAllKeysSync().filter((key: string) =>
    key.startsWith(PREFIX),
  )
}

export function readEntry(key: string): Value | undefined {
  try {
    const raw = store().getItemSync(key)
    return raw === null ? undefined : jsonToConvex(JSON.parse(raw))
  } catch {
    return undefined
  }
}

export function writeEntry(key: string, value: Value) {
  try {
    const raw = JSON.stringify(convexToJson(value))
    if (raw.length > MAX_VALUE_LENGTH) {
      store().removeItemSync(key)
      return
    }
    const others = cacheKeys().filter((k) => k !== key && k !== MARKER)
    // Any eviction will do for a disposable copy; no LRU bookkeeping.
    for (const old of others.slice(0, Math.max(0, others.length - MAX_ENTRIES + 1)))
      store().removeItemSync(old)
    // A screen still mounted during sign-out can write after the clear. That
    // entry is unreadable offline (the marker is gone), and the clear on
    // confirmed sign-out, or the next account's confirmation, removes it.
    store().setItemSync(key, raw)
  } catch {
    // A miss next time, nothing worse.
  }
}

/**
 * Convex has confirmed `account` on this phone: remember it, and delete every
 * entry from another account or bundle.
 */
export function confirmAccount(account: string) {
  try {
    const keep = diskScope(account)
    for (const key of cacheKeys())
      if (key !== MARKER && !key.startsWith(keep)) store().removeItemSync(key)
    store().setItemSync(MARKER, account)
  } catch {
    // Without the marker the offline fallback shows nothing; that is allowed.
  }
}

/** The account Convex last confirmed here, or null. */
export function confirmedAccount(): string | null {
  try {
    return store().getItemSync(MARKER)
  } catch {
    return null
  }
}

/** Confirmed sign-out: delete the marker and every entry. */
export function clearLastKnown() {
  try {
    for (const key of cacheKeys()) store().removeItemSync(key)
  } catch {
    // Nothing more can be done; the next confirmation prunes again.
  }
}

/**
 * Every stored value of one function for an account in this bundle, for the
 * offline fallback. Only when `account` is the one Convex last confirmed here;
 * otherwise, and on any failure, an empty list.
 */
export function readOfflineEntries(account: string, name: string): Value[] {
  try {
    if (confirmedAccount() !== account) return []
    const prefix = `${diskScope(account)}${name}|`
    const values: Value[] = []
    for (const key of cacheKeys()) {
      if (!key.startsWith(prefix)) continue
      const value = readEntry(key)
      if (value !== undefined) values.push(value)
    }
    return values
  } catch {
    return []
  }
}
