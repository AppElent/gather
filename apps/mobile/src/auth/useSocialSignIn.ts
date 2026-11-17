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
 * sign-up still misses a field, so only a verified Apple sign-up at
 * `missing_requirements` is "incomplete" here; Foundry shows that message on a
 * plain cancel too.
 */

import { useClerk } from '@clerk/expo'
import { useSignInWithApple } from '@clerk/expo/apple'
import { useSSO } from '@clerk/expo/experimental'
import { useCallback, useRef, useState } from 'react'
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
  const clerk = useClerk()
  const [pending, setPending] = useState<SocialProvider | null>(null)
  const [failure, setFailure] = useState<Failure | null>(null)
  // A synchronous lock: two taps in the same frame both see `pending` null.
  const running = useRef(false)

  const start = useCallback(
    async (provider: SocialProvider) => {
      if (running.current) return
      running.current = true
      setPending(provider)
      setFailure(null)
      // `true` once a session is active: the screen is about to unmount, so
      // the buttons stay busy until it does.
      let signedIn = false
      try {
        if (provider === 'apple' && Platform.OS === 'ios') {
          // What the client held before: a cancel hands these same attempts
          // back, so only a new one says anything about this flow.
          const before = {
            signIn: clerk.client?.signIn?.id,
            signUp: clerk.client?.signUp?.id,
          }
          const { createdSessionId, setActive, signIn, signUp } =
            await startAppleAuthenticationFlow()
          if (createdSessionId && setActive) {
            await setActive({ session: createdSessionId })
            signedIn = true
          } else if (!signUp) {
            // Clerk had not loaded yet: say so rather than nothing.
            setFailure({ kind: 'thrown', cause: null })
          } else if (
            // A cancel also lands here, with whatever the client last held, so
            // only an attempt this Apple flow made counts: a verified Apple
            // sign-up missing a field, or an Apple sign-in at a second factor
            // this app has no screen for.
            (signUp.id !== before.signUp &&
              signUp.status === 'missing_requirements' &&
              signUp.verifications?.externalAccount?.status === 'verified') ||
            (signIn?.id !== before.signIn &&
              signIn?.firstFactorVerification?.strategy === 'oauth_token_apple' &&
              (signIn.status === 'needs_second_factor' ||
                signIn.status === 'needs_client_trust'))
          ) {
            setFailure({ kind: 'incomplete' })
          }
        } else {
          const { createdSessionId, signIn, authSessionResult } =
            await startSSOFlow({ strategy: `oauth_${provider}` })
          if (authSessionResult?.type === 'success') {
            signedIn = Boolean(createdSessionId || signIn?.existingSession)
            if (!signedIn) setFailure({ kind: 'incomplete' })
          }
        }
      } catch (cause) {
        if (!isCanceled(cause)) setFailure({ kind: 'thrown', cause })
      } finally {
        running.current = false
        if (!signedIn) setPending(null)
      }
    },
    [startSSOFlow, startAppleAuthenticationFlow, clerk],
  )

  // Words are picked at render, so a language switch re-translates them.
  const error = !failure
    ? null
    : failure.kind === 'incomplete'
      ? t.social.incomplete
      : readThrown(failure.cause, t)

  return { start, pending, error }
}
