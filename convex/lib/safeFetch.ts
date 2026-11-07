import type { Id } from '../_generated/dataModel'
import type { ActionCtx } from '../_generated/server'

const MAX_REDIRECTS = 5

/** Long enough for a picture, short enough not to hold up an import. */
const IMAGE_TIMEOUT_MS = 8_000

/** The largest picture worth keeping off somebody else's server. */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024

// Blocks the obvious SSRF targets (loopback, RFC1918 private ranges,
// link-local incl. cloud metadata IPs, IPv6 loopback/unique-local/link-local,
// and non-http(s) schemes). Checks only the URL given — redirect hops are
// re-validated separately by safeFetch. Not a general-purpose
// SSRF-proof resolver — e.g. it doesn't catch decimal/hex-obfuscated IP
// literals — just enough to reject the obvious internal-network cases.
export function isUrlSafeToFetch(url: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost')) return false

  // Only apply IPv6-literal checks to things that actually look like IPv6
  // (otherwise this wrongly rejects real hostnames like fcbarcelona.com).
  if (host.includes(':')) {
    // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1, or Node's normalized
    // ::ffff:7f00:1 hex form) can wrap a loopback/private IPv4 address —
    // reject the whole family outright rather than trying to unwrap it.
    if (host.includes('::ffff:')) return false
    // IPv6 loopback, unique-local (fc00::/7), and link-local (fe80::/10)
    if (host === '::1' || host === '::') return false
    if (
      host.startsWith('fe80:') ||
      host.startsWith('fc') ||
      host.startsWith('fd')
    ) {
      return false
    }
    return true
  }

  const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host)
  if (ipv4Match) {
    const a = Number(ipv4Match[1])
    const b = Number(ipv4Match[2])
    if (a === 127) return false // loopback
    if (a === 10) return false // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return false // 172.16.0.0/12
    if (a === 192 && b === 168) return false // 192.168.0.0/16
    if (a === 169 && b === 254) return false // link-local, incl. cloud metadata
    if (a === 0) return false // 0.0.0.0/8
  }

  return true
}

// Fetches a URL that has already passed isUrlSafeToFetch, re-validating the
// destination of every redirect hop before following it — otherwise a site
// could pass the initial check and then 30x to a private/loopback target,
// reopening the SSRF hole the guard exists to close.
export async function safeFetch(
  url: string,
  init?: RequestInit,
  fetchImpl: typeof fetch = fetch,
): Promise<Response | undefined> {
  let currentUrl = url
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    if (!isUrlSafeToFetch(currentUrl)) return undefined
    const response = await fetchImpl(currentUrl, {
      ...init,
      redirect: 'manual',
    })
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) return undefined
      currentUrl = new URL(location, currentUrl).toString()
      continue
    }
    return response
  }
  return undefined
}

/**
 * Copy a picture off the internet into our storage.
 *
 * Best effort in every direction: a URL that does not resolve, a server that is
 * down, a response that is not an image or is too big, a blob that will not
 * store. Each means a record with no picture, never a failed import.
 *
 * Two separate refusals: `safeFetch`'s redirect-revalidating host check (SSRF),
 * and the content-type and size checks (storage being filled with something that
 * is not a picture). A `content-length` that lies is caught by measuring the blob
 * after, before anything is stored.
 */
export async function storeRemoteImage(
  ctx: Pick<ActionCtx, 'storage'>,
  url: string,
): Promise<Id<'_storage'> | undefined> {
  try {
    const response = await safeFetch(url, {
      signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
    })
    if (!response?.ok) return undefined
    if (!response.headers.get('content-type')?.startsWith('image/')) {
      return undefined
    }
    const declared = Number(response.headers.get('content-length'))
    if (Number.isFinite(declared) && declared > MAX_IMAGE_BYTES) {
      return undefined
    }
    const blob = await response.blob()
    if (blob.size > MAX_IMAGE_BYTES) return undefined
    return await ctx.storage.store(blob)
  } catch {
    return undefined
  }
}
