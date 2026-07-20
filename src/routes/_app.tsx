import { useAuth } from '@clerk/clerk-react'
import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router'
import { useConvexAuth, useMutation } from 'convex/react'
import { useEffect } from 'react'
import { api } from '../../convex/_generated/api'

export const Route = createFileRoute('/_app')({
  component: AppLayout,
})

function AppLayout() {
  // Clerk is the source of truth for "should we be on this route at all" -
  // sign-in.tsx navigates here on the same signal, so the two routes never
  // disagree. Convex's own isAuthenticated can lag behind (or, rarely, hang)
  // right after a fresh sign-in; treat that as still-loading rather than
  // bouncing back to /sign-in, which previously caused an infinite redirect
  // loop between the two routes.
  const { isLoaded: isClerkLoaded, isSignedIn } = useAuth()
  const { isAuthenticated } = useConvexAuth()
  const ensureUser = useMutation(api.users.ensureUser)
  const navigate = useNavigate()

  useEffect(() => {
    if (isClerkLoaded && !isSignedIn) {
      void navigate({ to: '/sign-in' })
    }
  }, [isClerkLoaded, isSignedIn, navigate])

  useEffect(() => {
    if (isAuthenticated) void ensureUser({})
  }, [isAuthenticated, ensureUser])

  if (!isClerkLoaded || (isSignedIn && !isAuthenticated)) {
    return (
      <div className="app-shell grid min-h-svh place-items-center text-sm text-[var(--app-muted)]">
        Loading...
      </div>
    )
  }
  if (!isSignedIn) return null

  return <Outlet />
}
