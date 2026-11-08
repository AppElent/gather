import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { reportError } from './lib/observability/report'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  return createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    // The router's own error boundaries swallow errors before React sees them.
    defaultOnCatch: (error) => reportError(error),
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
