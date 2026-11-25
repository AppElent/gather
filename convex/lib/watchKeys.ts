/**
 * The key a paired watch calls with (APP-653): 256 random bits, as
 * `gw_` and 64 hex digits. Only its SHA-256 is stored, and only the hash leaves
 * the HTTP action, so the key is in no table, log or function argument.
 */

const KEY = /^gw_[0-9a-f]{64}$/

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function newWatchKey(): string {
  return `gw_${hex(crypto.getRandomValues(new Uint8Array(32)))}`
}

/** A fast hash is enough: the key is random, so there is nothing to guess. */
export async function hashWatchKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(key),
  )
  return hex(new Uint8Array(digest))
}

/** The key in an `Authorization` header, or null when there is none. */
export function bearerKey(header: string | null): string | null {
  const [scheme, key, ...rest] = (header ?? '').trim().split(/\s+/)
  if (scheme?.toLowerCase() !== 'bearer' || rest.length > 0) return null
  return key && KEY.test(key) ? key : null
}
