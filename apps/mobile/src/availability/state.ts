export type ClerkStatus = 'degraded' | 'error' | 'loading' | 'ready'

export type AvailabilityMode =
  | 'splash'
  | 'unavailable'
  | 'signed-out'
  | 'connected'
  | 'connection-lost'

export interface AvailabilityInput {
  clerkLoaded: boolean
  clerkStatus: ClerkStatus
  signedIn: boolean | undefined
  splashExpired: boolean
  serviceConnected: boolean
  serviceEverConnected: boolean
}

/**
 * Resolve the outer app state without conflating a connection failure with a
 * confirmed signed-out identity.
 */
export function resolveAvailability({
  clerkLoaded,
  clerkStatus,
  signedIn,
  splashExpired,
  serviceConnected,
  serviceEverConnected,
}: AvailabilityInput): AvailabilityMode {
  if (!clerkLoaded || signedIn === undefined) {
    return splashExpired ? 'unavailable' : 'splash'
  }

  if (!signedIn) return clerkStatus === 'error' ? 'unavailable' : 'signed-out'

  if (clerkStatus === 'error') {
    if (serviceEverConnected) return 'connection-lost'
    return splashExpired ? 'unavailable' : 'splash'
  }

  const connected = clerkStatus === 'ready' && serviceConnected
  if (connected) return 'connected'
  if (serviceEverConnected) return 'connection-lost'

  return splashExpired ? 'unavailable' : 'splash'
}
