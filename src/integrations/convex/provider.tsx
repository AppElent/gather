import { useAuth } from '@clerk/clerk-react'
import { ConvexReactClient } from 'convex/react'
import { ConvexProviderWithClerk } from 'convex/react-clerk'

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL
if (!CONVEX_URL) {
  throw new Error('Missing VITE_CONVEX_URL')
}

const convex = new ConvexReactClient(CONVEX_URL)

export default function AppConvexProvider({
  children,
}: {
  children: React.ReactNode
}) {
  // ConvexProviderWithClerk rebuilds its token fetcher when orgId/orgRole change
  // but not when the Clerk session itself is replaced, so signing out and back
  // in without a reload leaves Convex holding the dead session and permanently
  // unauthenticated (get-convex/convex-js#156). Keying the provider on the
  // session id remounts the auth state machine on exactly those transitions.
  const { sessionId } = useAuth()

  return (
    <ConvexProviderWithClerk
      key={sessionId ?? 'signed-out'}
      client={convex}
      useAuth={useAuth}
    >
      {children}
    </ConvexProviderWithClerk>
  )
}
