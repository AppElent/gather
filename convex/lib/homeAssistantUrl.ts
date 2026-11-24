import { isUrlSafeToFetch } from './safeFetch'

/**
 * The address an admin typed, as the origin Gather connects to, or why it
 * cannot be one. Only `https`: the token travels over this connection. A host
 * that is plainly inside a home network is refused here in words; what a name
 * resolves to is checked again when connecting (`homeAssistantAddress.ts`).
 */
export function homeAssistantOrigin(
  typed: string,
):
  | { origin: string }
  | { problem: 'addressNotHttps' | 'addressInvalid' | 'addressPrivate' } {
  const trimmed = typed.trim()
  if (!trimmed || trimmed.length > 300) return { problem: 'addressInvalid' }
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`
  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    return { problem: 'addressInvalid' }
  }
  if (url.protocol !== 'https:') return { problem: 'addressNotHttps' }
  if (!url.hostname || url.username || url.password) {
    return { problem: 'addressInvalid' }
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, '')
  if (
    !isUrlSafeToFetch(url.origin) ||
    (!host.includes('.') && !host.includes(':')) ||
    /\.(local|localhost|internal|lan|home|home\.arpa)$/.test(host)
  ) {
    return { problem: 'addressPrivate' }
  }
  return { origin: url.origin }
}
