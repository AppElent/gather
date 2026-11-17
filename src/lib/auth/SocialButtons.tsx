import { useSignIn } from '@clerk/react'
import { useEffect, useState } from 'react'
import { fmt, useMessages } from '../i18n'
import { AuthButton } from './AuthButton'
import { useAuthConfig } from './AuthConfigProvider'
import { AuthError } from './AuthError'
import { AppleMark, MicrosoftMark } from './BrandMarks'
import { orThrow } from './clerkResult'
import { clerkErrorMessage } from './core'

/**
 * An "or" rule, then one "Continue with …" button per provider in
 * `AuthConfig.socialProviders`, under the email form: the same order as the
 * phone app. Each button redirects to the
 * provider and back to `paths.ssoCallback`, where
 * `AuthenticateWithRedirectCallback` finishes the flow. Starting from a
 * sign-in is enough for a sign-up too: Clerk transfers an unknown account to a
 * sign-up on the callback, so both forms draw the same buttons.
 *
 * Apple and Microsoft carry their own marks, as their sign-in guidelines ask:
 * Apple's button is solid black on a light page and white on a dark one
 * (`--auth-apple-*` in `styles.css`), Microsoft's is the outlined button with
 * the four squares. Any other provider is a plain outlined button.
 *
 * Ported from Foundry's `SocialButtons` (APP-208). Draws nothing when the
 * config lists no providers.
 */
export function SocialButtons() {
  const { signIn } = useSignIn()
  const { paths, socialProviders } = useAuthConfig()
  const { auth } = useMessages()
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Coming back with the browser's back button can restore this page from the
  // back/forward cache with `pending` still set; free the buttons again.
  useEffect(() => {
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) setPending(null)
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])

  if (socialProviders.length === 0) return null

  async function start(strategy: `oauth_${string}`) {
    setError(null)
    setPending(strategy)
    try {
      await orThrow(
        signIn.sso({
          strategy: strategy as Parameters<typeof signIn.sso>[0]['strategy'],
          redirectCallbackUrl: paths.ssoCallback,
          redirectUrl: paths.afterAuth,
        }),
      )
      // Success leaves the page for the provider; `pending` stays set so the
      // buttons stay inert until the browser navigates away.
    } catch (err) {
      setError(clerkErrorMessage(err, auth.errors.generic))
      setPending(null)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="mt-1 flex items-center gap-3 text-xs text-[var(--auth-muted)]">
        <span className="h-px flex-1 bg-[var(--auth-border)]" />
        {auth.or}
        <span className="h-px flex-1 bg-[var(--auth-border)]" />
      </div>
      <AuthError message={error} />
      {socialProviders.map((provider) => (
        <AuthButton
          key={provider.strategy}
          type="button"
          variant="ghost"
          className={
            provider.id === 'apple'
              ? 'border-solid border-transparent bg-[var(--auth-apple-bg)] text-[var(--auth-apple-fg)] hover:bg-[var(--auth-apple-bg)] hover:opacity-90'
              : 'border-solid border-[var(--auth-border)]'
          }
          loading={pending === provider.strategy}
          disabled={pending !== null}
          onClick={() => start(provider.strategy)}
        >
          {provider.id === 'apple' ? (
            <AppleMark className="size-4 shrink-0" />
          ) : provider.id === 'microsoft' ? (
            <MicrosoftMark className="size-4 shrink-0" />
          ) : null}
          {fmt(auth.continueWith, { provider: provider.label })}
        </AuthButton>
      ))}
    </div>
  )
}
