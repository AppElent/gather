import type { LinkProps } from '@tanstack/react-router'

/**
 * One destination, built by a route shim and handed to a shared page.
 *
 * A page component rendered under both `/recipes/…` and `/g/<slug>/recipes/…`
 * cannot know which tree it is in, and must not go looking: reading the current
 * URL to guess would put the answer back in hidden state, which is the thing
 * ADR-0002 exists to remove. So the shim — which does know, because it *is* the
 * route — builds every destination the page can reach and passes them down.
 *
 * `to` keeps its full router type, so a destination that is not a real route is
 * a compile error wherever it is built. `params` and `search` stay as the router
 * types them; the Group side gets its params checked by `groupLink` instead.
 */
export type AppLink = Pick<LinkProps, 'to' | 'params' | 'search'>
