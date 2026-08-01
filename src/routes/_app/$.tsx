import { createFileRoute, notFound } from '@tanstack/react-router'
import { LandingRedirect } from '../../components/app/LandingRedirect'
import { groupSlugOf } from '../../lib/groupPaths'

/**
 * Everything the app used to answer to, and no longer has a route for.
 *
 * A splat, so it catches whatever is left after every real route has had its
 * turn — exact matches win, which is what keeps `/g/<slug>/…`, `/settings`,
 * `/account` and `/groups` out of here entirely. What is left is bookmarks,
 * shared links and home-screen shortcuts written before the Group went into
 * the URL, and they land on the page they always named, in a Group the reader
 * is actually in.
 *
 * With one exception, and it is the important one: an address that already
 * names a Group but no page inside it — a typo, a page that has been removed —
 * is not a legacy address and must not be redirected. Sending it to Home would
 * mean moving the reader into a *different* Group, quietly, because the Group
 * this resolves is theirs rather than the one they were reading. That is
 * precisely what putting the Group in the URL exists to prevent (ADR-0002), so
 * it is a missing page instead.
 */
export const Route = createFileRoute('/_app/$')({
  beforeLoad: ({ location }) => {
    if (groupSlugOf(location.pathname)) throw notFound()
  },
  component: LandingRedirect,
})
