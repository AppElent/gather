/** Anything on a loopback or wildcard host. Production bundles also run there. */
export function isLocalReportingUrl(url: string): boolean {
  let hostname: string
  try {
    hostname = new URL(url).hostname.toLowerCase()
  } catch {
    return false
  }
  return (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname === '[::1]' ||
    hostname === '0.0.0.0' ||
    /^127\.\d+\.\d+\.\d+$/.test(hostname)
  )
}

/**
 * The deployment a hostname belongs to. Worker names are the identity
 * (`wrangler.jsonc`, `preview.yml`): `gather-pr-<N>` previews, `gather-stg`,
 * `gather-dev`, and the bare `gather` Worker plus any custom domain, which is
 * production. Build mode says nothing here — staging ships the production bundle.
 */
export function environmentFromHostname(hostname: string): string {
  const name = hostname.toLowerCase().split('.')[0] ?? ''
  if (/^gather-pr-\d+$/.test(name)) return 'preview'
  if (name === 'gather-stg') return 'staging'
  if (name === 'gather-dev') return 'development'
  return 'production'
}

/**
 * Options shared by the browser and the Worker. `sendDefaultPii: false` stops
 * the SDK attaching IPs, cookies and headers; the hooks in `./privacy` remove
 * what is left. Tracing, replay, logs and profiling stay off: this is a
 * household app holding health, money and notes, and nothing here needs them.
 */
export const SENTRY_BASE_OPTIONS = {
  sendDefaultPii: false,
  attachStacktrace: true,
  maxBreadcrumbs: 30,
} as const
