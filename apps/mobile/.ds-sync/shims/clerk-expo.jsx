/**
 * Browser shim for `@clerk/expo`.
 *
 * Only `AvailabilityProvider` reaches for Clerk, and only to decide whether the
 * app is usable. A preview is always the "connected" case: signed in, loaded,
 * nothing degraded. Returning that steadily is what lets the *real*
 * `AvailabilityProvider` run in a preview instead of being stubbed out, so
 * `ConnectionLostBanner` and `NoGroup` read their state through the same code
 * path they use on a phone.
 */
const SESSION = { reload: async () => {} }

export function useAuth() {
  return { isLoaded: true, isSignedIn: true, userId: 'preview-user' }
}

export function useClerk() {
  return { status: 'active', signOut: async () => {} }
}

export function useSession() {
  return { isLoaded: true, session: SESSION }
}

export function useUser() {
  return {
    isLoaded: true,
    isSignedIn: true,
    user: { firstName: 'Sam', primaryEmailAddress: { emailAddress: 'sam@example.com' } },
  }
}

export function getClerkInstance() {
  return { load: async () => {} }
}

export function ClerkProvider({ children }) {
  return children
}

/**
 * Clerk **Core 3** shapes, not Core 2 (ADR-0014 — the phone is a generation
 * ahead of the web).
 *
 * `errors` is not optional. `usePasswordSignIn` calls `pickError(errors, …)`
 * during render, which reads `errors.fields` unconditionally — a shim without
 * it throws on first render and `WelcomeActions` renders as a blank card.
 * Empty-but-present is the signed-out, nothing-attempted state a preview wants.
 */
const NO_ERRORS = { fields: {}, global: null }

export const useSignIn = () => ({
  isLoaded: true,
  errors: NO_ERRORS,
  signIn: {
    status: 'complete',
    password: async () => ({ error: null }),
    finalize: async () => ({ error: null }),
    create: async () => ({ error: null }),
  },
  setActive: async () => {},
})

export const useSignUp = () => ({
  isLoaded: true,
  errors: NO_ERRORS,
  signUp: {
    status: 'complete',
    create: async () => ({ error: null }),
    finalize: async () => ({ error: null }),
    prepareVerification: async () => ({ error: null }),
    attemptVerification: async () => ({ error: null }),
  },
  setActive: async () => {},
})
