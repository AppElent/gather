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
  // Requires convex >= 1.42.2: earlier versions rebuilt the token fetcher for
  // orgId/orgRole but not for a replaced Clerk session, so signing out and back
  // in without a reload left Convex holding the dead session and permanently
  // unauthenticated (get-convex/convex-js#156, fixed upstream).
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  )
}
