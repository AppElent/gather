/**
 * A short, deterministic fingerprint of a stored value, for comparing the same
 * data before and after a migration.
 *
 * The point is *stability*, not secrecy: two runs over unchanged rows must
 * print the same string, and a changed payload must print a different one, so
 * that an operator can diff two verification outputs by eye. That rules out
 * `JSON.stringify` on its own — its output follows insertion order, so the same
 * object read twice can serialise two ways — and it rules out anything async,
 * because the digest is computed inside a query over every sampled row.
 *
 * Not a cryptographic hash and not used as one. It is FNV-1a run twice with
 * different offsets and concatenated, giving 64 bits — enough that an
 * accidental collision between two payloads in one sample is not a thing that
 * happens, and short enough to read in a terminal.
 */

/**
 * JSON with object keys in sorted order, so key order cannot change the text.
 * Arrays keep their order, because in an array the order *is* the data.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`
  }
  const entries = Object.entries(value as Record<string, unknown>)
    // `undefined` is absent rather than present-and-empty, exactly as
    // JSON.stringify treats it, so an optional field left unset digests the
    // same as one that was never there.
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  const body = entries
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`)
    .join(',')
  return `{${body}}`
}

const FNV_PRIME = 0x01000193

function fnv1a(text: string, offset: number): string {
  let hash = offset
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, FNV_PRIME)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/** Sixteen hex characters standing for the value, whatever its key order. */
export function stableDigest(value: unknown): string {
  const text = canonicalJson(value)
  return fnv1a(text, 0x811c9dc5) + fnv1a(text, 0x0d1c9dc5)
}
