import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useAction } from 'convex/react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { SurfaceCard } from '../../components/app/ShellPrimitives'
import { errorMessage } from '../../lib/errorMessage'
import { useMessages } from '../../lib/i18n'
import { consumeOAuthState, oauthRedirectUri } from '../../lib/oauth'

export const Route = createFileRoute('/_app/integrations/callback')({
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search.code === 'string' ? search.code : undefined,
    state: typeof search.state === 'string' ? search.state : undefined,
    error: typeof search.error === 'string' ? search.error : undefined,
  }),
  component: OAuthCallback,
})

/**
 * Why the round-trip failed, as a key — except for a server error, which
 * carries its own sentence. This effect must run exactly once (it consumes the
 * one-time OAuth state), so it cannot depend on the message tree; the words are
 * chosen at render instead (ADR-0011).
 */
type Failure =
  | { kind: 'cancelled' | 'invalid' | 'noGroup' }
  | { kind: 'error'; message: string }

function OAuthCallback() {
  const { code, state, error } = Route.useSearch()
  const completeOAuth = useAction(api.integrations.completeOAuth)
  const navigate = useNavigate()
  const [failure, setFailure] = useState<Failure | null>(null)
  const { oauthCallback } = useMessages().shell
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const consumed = consumeOAuthState(state)
    if (error) {
      setFailure({ kind: 'cancelled' })
      return
    }
    if (!code || !consumed) {
      setFailure({ kind: 'invalid' })
      return
    }
    // A connection belongs to a Group, and this page is not inside one: the
    // only Group it can know about is the one the flow set out from. Without
    // it there is nowhere to store the token, and picking a Group on the
    // caller's behalf is the guess ADR-0002 exists to stop — so this fails.
    if (!consumed.groupSlug) {
      setFailure({ kind: 'noGroup' })
      return
    }
    completeOAuth({
      provider: consumed.provider,
      groupSlug: consumed.groupSlug,
      code,
      redirectUri: oauthRedirectUri(),
    })
      .then(() => navigate({ to: consumed.returnTo as '/settings' }))
      .catch((e) => setFailure({ kind: 'error', message: errorMessage(e, '') }))
  }, [code, state, error, completeOAuth, navigate])

  return (
    <div className="mx-auto max-w-md">
      <SurfaceCard>
        {failure ? (
          <div className="grid gap-2">
            <h2 className="m-0 text-base font-semibold">
              {oauthCallback.failedTitle}
            </h2>
            <p className="m-0 text-sm text-[var(--app-muted)]">
              {failure.kind === 'error'
                ? failure.message || oauthCallback.failed
                : oauthCallback[failure.kind]}
            </p>
            <Link to="/settings" className="text-sm font-semibold">
              {oauthCallback.backToSettings}
            </Link>
          </div>
        ) : (
          <p className="m-0 text-sm text-[var(--app-muted)]">
            {oauthCallback.finishing}
          </p>
        )}
      </SurfaceCard>
    </div>
  )
}
