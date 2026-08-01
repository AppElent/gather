import { createFileRoute } from '@tanstack/react-router'
import { LandingRedirect } from '../../components/app/LandingRedirect'

/**
 * Everything the app used to answer to, and no longer has a route for.
 *
 * A splat, so it catches whatever is left after every real route has had its
 * turn — exact matches win, which is what keeps `/g/<slug>/…`, `/settings`,
 * `/account` and `/groups` out of here entirely. What is left is bookmarks,
 * shared links and home-screen shortcuts written before the Group went into
 * the URL, and they land on the page they always named, in a Group the reader
 * is actually in.
 */
export const Route = createFileRoute('/_app/$')({
  component: LandingRedirect,
})
