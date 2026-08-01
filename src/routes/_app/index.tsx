import { createFileRoute } from '@tanstack/react-router'
import { LandingRedirect } from '../../components/app/LandingRedirect'

/**
 * `/` — signed in, and nothing said yet about which Group.
 *
 * Under `_app`, so it is behind the same sign-in check as everything else: this
 * is the address people land on after signing in, and it has to ask Convex who
 * they are before it can say where they are going.
 */
export const Route = createFileRoute('/_app/')({
  component: LandingRedirect,
})
