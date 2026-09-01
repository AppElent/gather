/**
 * The two things read out of the environment, and the gate on the second.
 *
 * **Static dot access is load-bearing.** Metro inlines `EXPO_PUBLIC_*` by
 * textually substituting `process.env.EXPO_PUBLIC_NAME` at build time. It is not
 * an object at runtime: `process.env[name]`, destructuring, or a helper that
 * takes the name as an argument all yield `undefined` in a release build while
 * appearing to work in dev. Every read below is spelled out in full for that
 * reason and must stay that way.
 *
 * **The dev-login gate is the key's prefix, not `__DEV__`.** A release build
 * pointed at the test instance — which is exactly what a PR preview is — should
 * offer the shortcut; a dev build someone has pointed at production must not.
 * `__DEV__` gets both of those backwards. This mirrors the web's rule, where the
 * test-login button appears when the key is `pk_test_…` and both credentials are
 * present, and the credentials are inlined into the client bundle either way —
 * so the account they name must never be one that exists on the live instance.
 */
const PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY
const TEST_USER_EMAIL = process.env.EXPO_PUBLIC_TEST_USER_EMAIL
const TEST_USER_PASSWORD = process.env.EXPO_PUBLIC_TEST_USER_PASSWORD

if (!PUBLISHABLE_KEY) {
  throw new Error(
    'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is not set. Add it to apps/mobile/.env.local (see .env.example).',
  )
}

export const publishableKey: string = PUBLISHABLE_KEY

/** The credentials for the one-tap shortcut, or `null` when it must not exist. */
export const devLogin: { email: string; password: string } | null =
  PUBLISHABLE_KEY.startsWith('pk_test_') &&
  TEST_USER_EMAIL &&
  TEST_USER_PASSWORD
    ? { email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD }
    : null

/**
 * Is this the shared test account?
 *
 * Every PR preview and every CI run signs in as it, so renaming it, changing
 * its password or — worst — deleting it would break them all, silently and for
 * everybody. Account disables its own mutating controls rather than trusting
 * whoever is holding the phone to remember that.
 *
 * `devLogin` is null wherever the credentials are absent, which is every EAS
 * environment, so this answers `false` on a real build and costs a real person
 * nothing.
 */
export function isTestAccount(email: string | null | undefined): boolean {
  if (!devLogin || !email) return false
  return email.toLowerCase() === devLogin.email.toLowerCase()
}
