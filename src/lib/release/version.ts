// What a deployed Worker is running, for `GET /version` (the release standard
// in docs/standards, ADR 0044). The build inlines the values (vite.config.ts);
// the hostname picks the environment, the same way Sentry does.
import { environmentFromHostname } from '../observability/config'

export const VERSION_PATH = '/version'

export type VersionInfo = {
  app: 'gather'
  /** SemVer from apps/mobile/app.json, the single source for web and phone. */
  version: string
  /** Full commit SHA of the build, or "unknown" for a build outside git. */
  commit: string
  environment: string
  /** When the bundle was built, which in CI is the deploy job, minutes before the Worker flips. */
  deployedAt: string
  /** The Sentry release, `gather@<version>+<short sha>`. */
  release: string
}

export function versionInfo(hostname: string): VersionInfo {
  return {
    app: 'gather',
    version: import.meta.env.VITE_APP_VERSION ?? 'unknown',
    commit: import.meta.env.VITE_GIT_COMMIT ?? 'unknown',
    environment: environmentFromHostname(hostname),
    deployedAt: import.meta.env.VITE_BUILT_AT ?? 'unknown',
    release: import.meta.env.VITE_SENTRY_RELEASE ?? 'unknown',
  }
}

/** Answers `/version` (GET or HEAD), or returns undefined for every other request. */
export function versionResponse(request: Request): Response | undefined {
  const url = new URL(request.url)
  if (url.pathname !== VERSION_PATH) return undefined
  if (request.method !== 'GET' && request.method !== 'HEAD') return undefined
  const body = JSON.stringify(versionInfo(url.hostname))
  return new Response(request.method === 'HEAD' ? null : body, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    },
  })
}
