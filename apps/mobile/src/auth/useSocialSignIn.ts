/**
 * Apple and Microsoft, all the way to an active session.
 *
 * Apple on iOS goes through the system sheet (`@clerk/expo/apple`): App Review
 * guideline 4.8 asks for it once any other social login is offered, and it is
 * the one flow that never leaves the app. Everything else, Apple on Android
 * included, opens the provider in an in-app browser via Core 3's experimental
 * `useSSO()`, which also turns an unknown account into a sign-up and activates
 * the session itself.
 *
 * That browser returns to `<scheme>://sso-callback`, one scheme per install
 * variant (`app.config.ts`), and Clerk only hands the session back to a URL on
 * the instance's allowlist. All three variants' callbacks and bundle IDs are
 * registered on both Clerk instances (APP-208).
 *
 * Backing out of the sheet or the browser is not an error and shows nothing.
 * Nothing here navigates either: once the session is active, `isSignedIn`
 * flips and the `(auth)` layout redirects, the same as a password sign-in.
 *
 * Ported from Foundry's `use-social-sign-in.ts`, with one difference: Clerk's
 * Apple hook returns a null session both when the person cancels and when the
 * sign-up still misses a field, so only `missing_requirements` is treated as
 * "incomplete" here; Foundry shows that message on a plain cancel too.
 */

import { useSignInWithApple } from '@clerk/expo/apple'
import { useSSO } from '@clerk/expo/experimental'
import { useCallback, useState } from 'react'
import { Platform } from 'react-native'
import { useI18n } from '../i18n'
import { readThrown } from './clerkErrors'

export const SOCIAL_PROVIDERS = ['apple', 'microsoft'] as const
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number]

/** The code Clerk and expo-apple-authentication use for "the person backed out". */
const CANCELED = 'ERR_REQUEST_CANCELED'

function isCanceled(cause: unknown): boolean {
  return (
    typeof cause === 'object' &&
    cause !== null &&
    (cause as { code?: unknown }).code === CANCELED
  )
}

type Failure = { kind: 'incomplete' } | { kind: 'thrown'; cause: unknown }

export function useSocialSignIn() {
  const { t } = useI18n()
  const { startSSOFlow } = useSSO()
  const { startAppleAuthenticationFlow } = useSignInWithApple()
  const [pending, setPending] = useState<SocialProvider | null>(null)
  const [failure, setFailure] = useState<Failure | null>(null)

  const start = useCallback(
    async (provider: SocialProvider) => {
      setPending(provider)
      setFailure(null)
      try {
        if (provider === 'apple' && Platform.OS === 'ios') {
          const { createdSessionId, setActive, signUp } =
            await startAppleAuthenticationFlow()
          if (createdSessionId && setActive) {
            await setActive({ session: createdSessionId })
            return
          }
          if (signUp?.status === 'missing_requirements') {
            setFailure({ kind: 'incomplete' })
          }
        } else {
          const { createdSessionId, signIn, authSessionResult } =
            await startSSOFlow({ strategy: `oauth_${provider}` })
          if (authSessionResult?.type !== 'success') {
            setPending(null)
            return
          }
          if (createdSessionId || signIn?.existingSession) return
          setFailure({ kind: 'incomplete' })
        }
      } catch (cause) {
        if (!isCanceled(cause)) setFailure({ kind: 'thrown', cause })
      }
      setPending(null)
    },
    [startSSOFlow, startAppleAuthenticationFlow],
  )

  // Words are picked at render, so a language switch re-translates them.
  const error = !failure
    ? null
    : failure.kind === 'incomplete'
      ? t.social.incomplete
      : readThrown(failure.cause, t)

  return { start, pending, error }
}
