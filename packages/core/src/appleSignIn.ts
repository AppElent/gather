/**
 * Sign in with Apple on the web, shared by the web app and Convex (APP-388).
 *
 * The web deletes a whole AppElent account only after revoking its Apple
 * grant, as the iOS app does (APP-213): an Apple JS popup supplies a fresh
 * code, and Convex exchanges and revokes it (`accounts.revokeAppleSignIn`).
 * Ported from Foundry (AppElent/workouts `packages/core/src/auth.ts`, APP-242).
 */

/**
 * The Sign in with Apple Services ID of every AppElent web app. Clerk's web
 * Apple sign-in and Apple JS both use it, so a web authorization code is
 * issued to it.
 */
export const APPLE_WEB_SERVICES_ID = 'nl.appelent.web'

/**
 * The web Account page URLs registered as Return URLs on the Services ID.
 * Apple JS shows its popup only for a registered URL, so web Apple revocation
 * runs only from these; local, previews and staging delete unrevoked, as
 * Android does. Add one only after it is listed in Apple Developer
 * (docs/contracts/account-deletion.md, "Web Apple revocation").
 */
export const APPLE_WEB_RETURN_URLS: readonly string[] = [
  'https://gather.appelent.nl/account',
]

/** The registered Apple JS return URL for a web origin, if it has one. */
export function appleWebReturnUrl(
  origin: string,
  registered: readonly string[] = APPLE_WEB_RETURN_URLS,
): string | null {
  const url = `${origin}/account`
  return registered.includes(url) ? url : null
}

/**
 * What `accounts.revokeAppleSignIn` refuses with when the code's Apple account
 * is not one linked to the signed-in login, or no link is known for it. The
 * web compares the refusal's data to it, so it never changes.
 */
export const APPLE_ACCOUNT_MISMATCH = 'Apple account mismatch'
