/**
 * Verifying a Svix-signed webhook, which is how Clerk signs its webhooks.
 *
 * Written out rather than taken from the `svix` package: it is one HMAC, and
 * Convex's default runtime has Web Crypto. The scheme
 * (https://docs.svix.com/receiving/verifying-payloads/how-manual):
 *
 * - The secret is `whsec_` followed by the base64 key.
 * - The signed content is `${svix-id}.${svix-timestamp}.${raw body}`, and the
 *   signature is its base64 HMAC-SHA256.
 * - `svix-signature` lists one or more space-separated `v1,<signature>`
 *   entries (more than one while a secret is being rotated); any one matching
 *   is enough.
 * - A timestamp more than five minutes from now is refused, so a captured
 *   request cannot be replayed later.
 *
 * The comparison is `crypto.subtle.verify`, which does not leak how much of a
 * guess matched.
 */

/** How far a signed timestamp may be from now, either way. */
export const SVIX_TOLERANCE_SECONDS = 5 * 60

export interface SvixHeaders {
  id: string | null
  timestamp: string | null
  signature: string | null
}

export function svixHeaders(headers: Headers): SvixHeaders {
  return {
    id: headers.get('svix-id'),
    timestamp: headers.get('svix-timestamp'),
    signature: headers.get('svix-signature'),
  }
}

const SECRET_PREFIX = 'whsec_'

function base64Bytes(value: string): Uint8Array<ArrayBuffer> | null {
  try {
    const binary = atob(value)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  } catch {
    return null
  }
}

/**
 * Whether `body` was signed with `secret`, as the headers say. Any missing
 * header, malformed value or stale timestamp is simply `false`.
 */
export async function verifySvix(
  secret: string,
  headers: SvixHeaders,
  body: string,
  nowMs: number = Date.now(),
): Promise<boolean> {
  const { id, timestamp, signature } = headers
  if (!id || !timestamp || !signature) return false
  if (!/^\d+$/.test(timestamp)) return false
  if (Math.abs(nowMs / 1000 - Number(timestamp)) > SVIX_TOLERANCE_SECONDS)
    return false

  const keyBytes = base64Bytes(
    secret.startsWith(SECRET_PREFIX)
      ? secret.slice(SECRET_PREFIX.length)
      : secret,
  )
  if (!keyBytes || keyBytes.length === 0) return false
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  )
  const signed = new TextEncoder().encode(`${id}.${timestamp}.${body}`)

  for (const entry of signature.split(' ')) {
    const [version, value] = entry.split(',', 2)
    if (version !== 'v1' || !value) continue
    const candidate = base64Bytes(value)
    if (!candidate) continue
    if (await crypto.subtle.verify('HMAC', key, candidate, signed)) return true
  }
  return false
}
