/**
 * Revokes the Sign in with Apple grant before the whole AppElent account is
 * deleted on the web, as Apple requires (TN3194); the web counterpart of the
 * iOS native sheet (APP-213). An Apple JS popup for the web Services ID
 * supplies a fresh code that Convex exchanges and revokes
 * (`accounts.revokeAppleSignIn`, APP-388).
 *
 * Nothing is deleted unless this answers `continue`. Closing the popup is a
 * cancel; a blocked popup, an Apple JS that would not load, or an answer
 * without a code for this request stops the deletion as well, so the person
 * can retry. Once Convex has the code, a failure there (Apple refusing, the
 * key not configured) is reported and the deletion goes ahead, as on the
 * phone, so Apple can never block it.
 *
 * The popup signs in whoever owns the browser's Apple Account, which need not
 * be the person linked to this account. A code for anyone else is never sent,
 * and Convex checks the code's Apple user against the login's Clerk-mirrored
 * links again, so another person's grant is never revoked. Either check stops
 * the deletion as `appleMismatch`.
 *
 * Apple shows the popup only for a return URL registered on the Services ID.
 * From any other origin (local, previews, staging) the grant is not revoked,
 * as on Android.
 *
 * Ported from Foundry (AppElent/workouts `src/lib/auth/appleRevocation.ts`,
 * APP-242).
 */
import {
  APPLE_ACCOUNT_MISMATCH,
  APPLE_WEB_SERVICES_ID,
  appleWebReturnUrl,
} from '@gather/core/apple-sign-in'
import type { Locale } from '@gather/core/i18n'
import { ConvexError } from 'convex/values'
import { reportError } from '../observability/report'

/** Apple JS localises its popup per script URL. */
const APPLE_JS_LOCALES: Record<Locale, string> = { en: 'en_US', nl: 'nl_NL' }

/** The slice of Apple JS (`window.AppleID.auth`) this flow uses. */
export type AppleIdAuth = {
  init(config: {
    clientId: string
    scope: string
    redirectURI: string
    state: string
    usePopup: true
  }): void
  signIn(): Promise<{
    authorization: { code?: string; id_token?: string; state?: string }
  }>
}

export type AppleLinkedUser = {
  externalAccounts: readonly { provider: string; providerUserId: string }[]
}

/** `useAction(api.accounts.revokeAppleSignIn)`, for a web code. */
export type RevokeAppleSignIn = (args: {
  authorizationCode: string
  bundleId: string
  redirectUri: string
  expectedSubject: string
}) => Promise<unknown>

export type AppleRevocation =
  | 'continue'
  | 'cancelled'
  | 'popupBlocked'
  | 'appleMismatch'
  | 'failed'

let appleJs: Promise<AppleIdAuth> | null = null

/**
 * Loads Apple JS once per page. Load it before the person clicks: Safari blocks
 * a popup opened after awaiting a script load, because the click no longer
 * counts as the trigger.
 */
function loadAppleJs(locale: Locale): Promise<AppleIdAuth> {
  appleJs ??= new Promise<AppleIdAuth>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/${APPLE_JS_LOCALES[locale]}/appleid.auth.js`
    script.async = true
    script.onload = () => {
      const auth = (window as { AppleID?: { auth?: AppleIdAuth } }).AppleID
        ?.auth
      if (auth) return resolve(auth)
      appleJs = null
      reject(new Error('Apple JS loaded without AppleID.auth'))
    }
    script.onerror = () => {
      appleJs = null
      reject(new Error('Apple JS could not be loaded'))
    }
    document.head.appendChild(script)
  })
  return appleJs
}

function appleUserIds(user: AppleLinkedUser) {
  return user.externalAccounts
    .filter(({ provider }) => provider.replace(/^oauth_/, '') === 'apple')
    .map(({ providerUserId }) => providerUserId)
}

/**
 * The return URL to revoke with, when this account is Apple-linked and this
 * origin is registered with Apple; otherwise web revocation is skipped.
 */
export function appleRevocationReturnUrl(
  user: AppleLinkedUser,
  origin: string = window.location.origin,
  returnUrls?: readonly string[],
): string | null {
  return appleUserIds(user).length > 0
    ? appleWebReturnUrl(origin, returnUrls)
    : null
}

/** Starts loading Apple JS when deleting the whole account may need it. */
export function preloadAppleJs(user: AppleLinkedUser, locale: Locale) {
  if (appleRevocationReturnUrl(user))
    loadAppleJs(locale).catch(() => {
      // Said, and reported, when the deletion actually needs it.
    })
}

/** The `sub` of Apple's ID token: the Apple user the popup signed in. */
function idTokenSubject(idToken: string | undefined): string | null {
  const payload = idToken?.split('.')[1]
  if (!payload) return null
  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    const { sub } = JSON.parse(json) as { sub?: unknown }
    return typeof sub === 'string' ? sub : null
  } catch {
    return null
  }
}

/** Apple JS rejects with `{ error }`, not an `Error`. */
function popupError(error: unknown) {
  return (error as { error?: unknown } | null)?.error
}

export async function revokeAppleSignIn(
  user: AppleLinkedUser,
  revoke: RevokeAppleSignIn,
  {
    expectedSubject,
    locale = 'en',
    origin,
    returnUrls,
    loadApple = () => loadAppleJs(locale),
  }: {
    /** The Clerk user the person confirmed the deletion as. */
    expectedSubject: string
    locale?: Locale
    origin?: string
    returnUrls?: readonly string[]
    loadApple?: () => Promise<AppleIdAuth>
  },
): Promise<AppleRevocation> {
  const redirectUri = appleRevocationReturnUrl(user, origin, returnUrls)
  if (!redirectUri) return 'continue'
  const linked = appleUserIds(user)
  let authorizationCode: string
  try {
    const apple = await loadApple()
    const state = crypto.randomUUID()
    apple.init({
      clientId: APPLE_WEB_SERVICES_ID,
      scope: '',
      redirectURI: redirectUri,
      state,
      usePopup: true,
    })
    const { authorization } = await apple.signIn()
    if (authorization.state !== state)
      throw new Error('Apple popup returned a different state')
    const subject = idTokenSubject(authorization.id_token)
    if (!subject || !linked.includes(subject)) return 'appleMismatch'
    if (!authorization.code)
      throw new Error('Apple returned no authorization code')
    authorizationCode = authorization.code
  } catch (error) {
    const code = popupError(error)
    if (code === 'popup_closed_by_user' || code === 'user_cancelled_authorize')
      return 'cancelled'
    if (code === 'popup_blocked_by_browser') return 'popupBlocked'
    reportError(
      error instanceof Error
        ? error
        : new Error(`Apple popup failed: ${String(code ?? 'unknown')}`),
    )
    return 'failed'
  }
  try {
    await revoke({
      authorizationCode,
      bundleId: APPLE_WEB_SERVICES_ID,
      redirectUri,
      expectedSubject,
    })
  } catch (error) {
    if (error instanceof ConvexError && error.data === APPLE_ACCOUNT_MISMATCH)
      return 'appleMismatch'
    // Reported, and the deletion goes ahead: the purge that follows refuses
    // on its own when the account changed or is gone.
    reportError(error)
  }
  return 'continue'
}
