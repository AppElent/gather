import { useAuth } from '@clerk/clerk-react'
import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router'
import { useConvexAuth, useMutation } from 'convex/react'
import { useEffect } from 'react'
import { api } from '../../convex/_generated/api'
import { AppShell } from '../components/app/AppShell'
import { useConvexAuthStalled } from '../integrations/convex/useConvexAuthStalled'

export const Route = createFileRoute('/_app')({
  component: AppLayout,
})

export function AppLayout() {
  // Clerk is the source of truth for "should we be on this route at all" -
  // sign-in.tsx navigates here on the same signal, so the two routes never
  // disagree. Convex's own isAuthenticated can lag behind (or, rarely, hang)
  // right after a fresh sign-in; treat that as still-loading rather than
  // bouncing back to /sign-in, which previously caused an infinite redirect
  // loop between the two routes.
  const { isLoaded: isClerkLoaded, isSignedIn } = useAuth()
  const { isAuthenticated } = useConvexAuth()
  // ...but only up to a point: Convex never retries a handshake it has given up
  // on, so waiting on isAuthenticated alone used to leave the dashboard on
  // "Loading..." until the user reloaded by hand. Offer that reload instead.
  const authStalled = useConvexAuthStalled()
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

  if (isClerkLoaded && !isSignedIn) return null

  if (!isClerkLoaded || !isAuthenticated) {
    if (!authStalled) {
      return (
        <div className="app-shell grid min-h-svh place-items-center text-sm text-[var(--app-muted)]">
          Loading...
        </div>
      )
    }

    return (
      <div className="app-shell grid min-h-svh place-items-center px-6 text-sm text-[var(--app-muted)]">
        <div className="grid max-w-sm justify-items-center gap-3 text-center">
          <p className="m-0 text-base font-semibold text-[var(--app-fg)]">
            Could not finish signing in
          </p>
          <p className="m-0 leading-6">
            Gather could not connect your session to the backend. Reloading
            usually fixes it.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex min-h-10 items-center justify-center rounded-[var(--app-radius)] border border-[var(--app-fg)] bg-[var(--app-fg)] px-3 text-sm font-semibold text-[var(--app-surface)]"
          >
            Reload
          </button>
        </div>
      </div>
    )
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}
