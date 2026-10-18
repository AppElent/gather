import type { Breadcrumb, Event } from '@sentry/react'

const FILTERED = '[Filtered]'

/** Keys a breadcrumb may keep: structure only, never bodies, params or values. */
const BREADCRUMB_DATA_KEYS = new Set([
  'url',
  'method',
  'status_code',
  'from',
  'to',
])

/** A URL without its query string or fragment. Both carry codes and tokens. */
export function stripUrl(url: string): string {
  return url.split(/[?#]/)[0] ?? ''
}

/** Redact credentials and identifiers that survive with default PII disabled. */
export function sanitizeText(value: string): string {
  return (
    value
      .replace(/Bearer\s+[^\s"']+/gi, `Bearer ${FILTERED}`)
      // JWTs: Clerk session tokens and Convex auth tokens.
      .replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+/g, FILTERED)
      .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, FILTERED)
      .replace(
        /((?:^|[?&\s,;])(?:token|key|password|secret|email|code|authorization|__clerk\w*)=)[^&#\s"']*/gi,
        `$1${FILTERED}`,
      )
      // Convex echoes the rejected argument: "Path: .title\nValue: "<user text>"".
      .replace(/(\bValue:\s*)[\s\S]*?(?=\n\s*Validator:|$)/g, `$1${FILTERED}`)
  )
}

/** Drops console output and input events; keeps only structural data. */
export function sanitizeBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  // Console output can carry whole Convex arguments; input events carry text.
  if (breadcrumb.category === 'console' || breadcrumb.category === 'ui.input') {
    return null
  }
  const data = breadcrumb.data
    ? Object.fromEntries(
        Object.entries(breadcrumb.data)
          .filter(([key]) => BREADCRUMB_DATA_KEYS.has(key))
          .map(([key, value]) => [
            key,
            typeof value === 'string' ? sanitizeText(stripUrl(value)) : value,
          ]),
      )
    : undefined
  return {
    ...breadcrumb,
    message: breadcrumb.message ? sanitizeText(breadcrumb.message) : undefined,
    data,
  }
}

/**
 * Last stop before delivery. Removes everything a caller could have attached —
 * request bodies, headers, cookies, query strings, `extra`, stack-frame
 * locals — and scrubs the text that remains.
 */
export function sanitizeEvent<T extends Event>(event: T): T {
  // The opaque id is allowed; email, name and IP are not.
  event.user = event.user?.id ? { id: event.user.id } : undefined
  if (event.request) {
    event.request = {
      method: event.request.method,
      url: event.request.url
        ? sanitizeText(stripUrl(event.request.url))
        : undefined,
    }
  }
  delete event.extra
  if (event.contexts) delete event.contexts.request
  if (event.message) event.message = sanitizeText(event.message)
  if (event.logentry?.message) {
    event.logentry = { message: sanitizeText(event.logentry.message) }
  }
  if (event.transaction)
    event.transaction = sanitizeText(stripUrl(event.transaction))
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = sanitizeText(exception.value)
    for (const frame of exception.stacktrace?.frames ?? []) delete frame.vars
  }
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs
      .map(sanitizeBreadcrumb)
      .filter((breadcrumb): breadcrumb is Breadcrumb => breadcrumb !== null)
  }
  return event
}
