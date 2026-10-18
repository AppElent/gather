// DOM-free, framework-free logic. No React, browser globals, or styling deps.

export interface TestLoginEnv {
  VITE_CLERK_PUBLISHABLE_KEY?: string
  VITE_TEST_USER_EMAIL?: string
  VITE_TEST_USER_PASSWORD?: string
}

/**
 * Show the dev test-login button only on a Clerk *test* instance with both
 * test credentials provided via env.
 *
 * Gather keeps the password flow the toolkit example replaced with a
 * `+clerk_test` email code: the shared test user (and `PREVIEW_TEST_USER` in
 * `convex/seed.ts`) is an ordinary email-and-password account on the Clerk
 * test instance. Both values are inlined into the bundle, which is why they
 * are never set for a production build (CODING_STANDARDS.md, "Test login").
 *
 * Takes a plain env object rather than reading `import.meta.env` itself, so
 * it is testable without stubbing Vite.
 */
export function shouldShowTestLogin(env: TestLoginEnv): boolean {
  const onTestInstance =
    !!env.VITE_CLERK_PUBLISHABLE_KEY?.startsWith('pk_test_')
  return (
    onTestInstance &&
    !!env.VITE_TEST_USER_EMAIL &&
    !!env.VITE_TEST_USER_PASSWORD
  )
}

/** Second-factor strategies the sign-in example can complete, in preference order. */
export const SECOND_FACTOR_STRATEGIES = [
  'totp',
  'phone_code',
  'email_code',
  'backup_code',
] as const
export type SecondFactorStrategy = (typeof SECOND_FACTOR_STRATEGIES)[number]

/** Pick the preferred supported second factor, or undefined when none is usable. */
export function pickSecondFactor<T extends { strategy: string }>(
  factors: readonly T[],
): (T & { strategy: SecondFactorStrategy }) | undefined {
  for (const strategy of SECOND_FACTOR_STRATEGIES) {
    const factor = factors.find((f) => f.strategy === strategy)
    if (factor) return factor as T & { strategy: SecondFactorStrategy }
  }
  return undefined
}

interface ClerkLikeError {
  errors?: { longMessage?: string; message?: string }[]
}

/** Extract a readable message from a thrown Clerk error (or any error). */
export function clerkErrorMessage(
  err: unknown,
  fallback = 'Something went wrong.',
): string {
  const e = err as ClerkLikeError
  const first = e?.errors?.[0]
  return first?.longMessage ?? first?.message ?? fallback
}
