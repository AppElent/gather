import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router'
import { useConvexAuth, useMutation } from 'convex/react'
import { useEffect } from 'react'
import { api } from '../../convex/_generated/api'

export const Route = createFileRoute('/_app')({
  component: AppLayout,
})

function AppLayout() {
  const { isAuthenticated, isLoading } = useConvexAuth()
  const ensureUser = useMutation(api.users.ensureUser)
  const navigate = useNavigate()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      void navigate({ to: '/sign-in' })
    }
  }, [isLoading, isAuthenticated, navigate])

  useEffect(() => {
    if (isAuthenticated) void ensureUser({})
  }, [isAuthenticated, ensureUser])

  if (isLoading) {
    return (
      <div className="app-shell grid min-h-svh place-items-center text-sm text-[var(--app-muted)]">
        Loading...
      </div>
    )
  }
  if (!isAuthenticated) return null

  return <Outlet />
}
