import { useSignIn } from '@clerk/react'
import { useState } from 'react'
import { fmt, useMessages } from '../i18n'
import { AuthButton } from './AuthButton'
import { useAuthConfig } from './AuthConfigProvider'
import { AuthError } from './AuthError'
import { orThrow } from './clerkResult'
import { clerkErrorMessage } from './core'

/**
 * One "Continue with …" button per provider in `AuthConfig.socialProviders`,
 * then an "or" rule above the email form. Each button redirects to the
 * provider and back to `paths.ssoCallback`, where
 * `AuthenticateWithRedirectCallback` finishes the flow. Starting from a
 * sign-in is enough for a sign-up too: Clerk transfers an unknown account to a
 * sign-up on the callback, so both forms draw the same buttons.
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
      <AuthError message={error} />
      {socialProviders.map((provider) => (
        <AuthButton
          key={provider.strategy}
          type="button"
          variant="ghost"
          className="border-solid border-[var(--auth-border)]"
          loading={pending === provider.strategy}
          disabled={pending !== null}
          onClick={() => start(provider.strategy)}
        >
          {fmt(auth.continueWith, { provider: provider.label })}
        </AuthButton>
      ))}
      <div className="my-1 flex items-center gap-3 text-xs text-[var(--auth-muted)]">
        <span className="h-px flex-1 bg-[var(--auth-border)]" />
        {auth.or}
        <span className="h-px flex-1 bg-[var(--auth-border)]" />
      </div>
    </div>
  )
}
