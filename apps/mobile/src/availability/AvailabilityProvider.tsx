import { getClerkInstance, useAuth, useClerk, useSession } from '@clerk/expo'
import { useConvexAuth, useConvexConnectionState } from 'convex/react'
import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { publishableKey } from '../auth/config'
import { type AvailabilityMode, resolveAvailability } from './state'

export const SPLASH_TIMEOUT_MS = 4000

interface AvailabilityValue {
  mode: AvailabilityMode
  retrying: boolean
  serviceActionsEnabled: boolean
  retry: () => void
}

const AvailabilityContext = createContext<AvailabilityValue | null>(null)

export function AvailabilityProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const clerk = useClerk()
  const { session } = useSession()
  const { isAuthenticated } = useConvexAuth()
  const connection = useConvexConnectionState()
  const [splashExpired, setSplashExpired] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [retryAttempt, setRetryAttempt] = useState(0)

  const waitingForStartup =
    !auth.isLoaded || (auth.isSignedIn === true && !connection.hasEverConnected)
  const startupAttempt = waitingForStartup ? retryAttempt : -1

  useEffect(() => {
    if (!waitingForStartup || startupAttempt < 0) return

    const timeout = setTimeout(() => setSplashExpired(true), SPLASH_TIMEOUT_MS)
    return () => clearTimeout(timeout)
  }, [startupAttempt, waitingForStartup])

  const mode = resolveAvailability({
    clerkLoaded: auth.isLoaded,
    clerkStatus: clerk.status,
    signedIn: auth.isSignedIn,
    splashExpired,
    serviceConnected: connection.isWebSocketConnected && isAuthenticated,
    serviceEverConnected: connection.hasEverConnected,
  })
  // `retry` clears the expiry before asking Clerk to load again. Convex then
  // owns the automatic socket reconnect and updates this mode when it returns.

  const retry = useCallback(() => {
    if (retrying) return
    setRetrying(true)
    setSplashExpired(false)
    setRetryAttempt((attempt) => attempt + 1)
    const clerkInstance = getClerkInstance({ publishableKey })
    void clerkInstance
      .load()
      .then(async () => {
        if (session) await session.reload()
      })
      .catch(() => undefined)
      .finally(() => setRetrying(false))
  }, [retrying, session])

  const value = useMemo<AvailabilityValue>(
    () => ({
      mode,
      retrying,
      serviceActionsEnabled: mode === 'connected',
      retry,
    }),
    [mode, retrying, retry],
  )

  return <AvailabilityContext value={value}>{children}</AvailabilityContext>
}

export function useAvailability(): AvailabilityValue {
  const value = use(AvailabilityContext)
  if (!value) {
    throw new Error(
      'useAvailability must be used within an AvailabilityProvider',
    )
  }
  return value
}
