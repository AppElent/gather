/**
 * Reads Clerk user objects as the webhook (and the one-off backfill,
 * `scripts/backfill-apple-links.mjs`) deliver them. They are the trusted
 * source for which Apple account is linked to an AppElent login: the browser
 * knows too, but a caller could claim any Apple user, so server checks never
 * take it from there.
 *
 * Ported from Foundry (AppElent/workouts `convex/lib/clerkUsers.ts`, APP-242).
 */

type ClerkExternalAccount = {
  provider?: unknown
  provider_user_id?: unknown
  verification?: { status?: unknown } | null
}

/** The verified Sign in with Apple users (`sub`) of a Clerk user object. */
export function verifiedAppleUserIds(user: {
  external_accounts?: unknown
}): string[] {
  const accounts = Array.isArray(user.external_accounts)
    ? (user.external_accounts as (ClerkExternalAccount | null)[])
    : []
  const ids = accounts
    .filter(
      (account): account is ClerkExternalAccount =>
        typeof account === 'object' &&
        account !== null &&
        // Clerk says `oauth_apple`; accept the bare name too.
        typeof account.provider === 'string' &&
        account.provider.replace(/^oauth_/, '') === 'apple' &&
        typeof account.provider_user_id === 'string' &&
        account.provider_user_id !== '' &&
        // An unverified link never finished signing in with Apple.
        account.verification?.status === 'verified',
    )
    .map((account) => account.provider_user_id as string)
  return [...new Set(ids)]
}
