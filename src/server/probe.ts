// Scanner probes (`/.ssh/id_ed25519`, `/.env`, `/.git/config`, `/wp-login.php`)
// never match a Gather page. The Worker answers them with a plain 404 before
// TanStack Start renders the app shell, so a probe costs no SSR and can never
// surface as a 500 in Sentry (APP-466, Sentry GATHER-4).

/** File extensions of server stacks Gather does not run. */
const FOREIGN_EXTENSIONS = /\.(php\d?|aspx?|asp|jsp|cgi|pl|env|ini|sql|bak|old|swp)$/i

/**
 * True for a path no Gather route serves: a dot segment such as `/.ssh/…` or
 * `/.env` (except `/.well-known/…`, which serves the MCP OAuth discovery), or a
 * file of a server stack Gather does not run.
 */
export function isProbePath(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean)
  const dotSegments = segments.filter((segment) => segment.startsWith('.'))
  if (dotSegments.length > 0) {
    return !(dotSegments.length === 1 && segments[0] === '.well-known')
  }
  return FOREIGN_EXTENSIONS.test(pathname)
}

/** A plain 404 for a scanner probe, or undefined for every other request. */
export function probeResponse(request: Request): Response | undefined {
  if (!isProbePath(new URL(request.url).pathname)) return undefined
  return new Response(request.method === 'HEAD' ? null : 'Not Found', {
    status: 404,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  })
}
