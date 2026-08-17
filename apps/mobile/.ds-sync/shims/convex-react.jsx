/**
 * Browser shim for `convex/react`.
 *
 * Two jobs. `AvailabilityProvider` asks whether the service is reachable — a
 * preview says yes, steadily, so the real provider can run (see clerk-expo.jsx).
 * `GroupForms` asks for mutations; a preview has no backend, so they resolve
 * without doing anything. The form still exercises its own busy/disabled/
 * validation states, which is the part a design agent needs to see.
 */
export function useConvexAuth() {
  return { isLoading: false, isAuthenticated: true }
}

export function useConvexConnectionState() {
  return {
    isWebSocketConnected: true,
    hasEverConnected: true,
    hasInflightRequests: false,
    timeOfOldestInflightRequest: null,
  }
}

export function useMutation() {
  return async () => undefined
}

export function useQuery() {
  return undefined
}

export function useAction() {
  return async () => undefined
}

export function ConvexProvider({ children }) {
  return children
}

export class ConvexReactClient {
  setAuth() {}
  clearAuth() {}
}
