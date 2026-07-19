import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useAction } from 'convex/react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { SurfaceCard } from '../../components/app/ShellPrimitives'
import { errorMessage } from '../../components/settings/ConnectionsSettings'
import { consumeOAuthState, oauthRedirectUri } from '../../lib/oauth'

export const Route = createFileRoute('/_app/integrations/callback')({
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search.code === 'string' ? search.code : undefined,
    state: typeof search.state === 'string' ? search.state : undefined,
    error: typeof search.error === 'string' ? search.error : undefined,
  }),
  component: OAuthCallback,
})

function OAuthCallback() {
  const { code, state, error } = Route.useSearch()
  const completeOAuth = useAction(api.integrations.completeOAuth)
  const navigate = useNavigate()
  const [failure, setFailure] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const consumed = consumeOAuthState(state)
    if (error) {
      setFailure('The connection was cancelled or refused.')
      return
    }
    if (!code || !consumed) {
      setFailure('Invalid connection response — try connecting again.')
      return
    }
    completeOAuth({
      provider: consumed.provider,
      code,
      redirectUri: oauthRedirectUri(),
    })
      .then(() => navigate({ to: consumed.returnTo as '/settings' }))
      .catch((e) =>
        setFailure(errorMessage(e, 'Connecting failed — try again.')),
      )
  }, [code, state, error, completeOAuth, navigate])

  return (
    <div className="mx-auto max-w-md">
      <SurfaceCard>
        {failure ? (
          <div className="grid gap-2">
            <h2 className="m-0 text-base font-semibold">Connection failed</h2>
            <p className="m-0 text-sm text-[var(--app-muted)]">{failure}</p>
            <Link to="/settings" className="text-sm font-semibold">
              Back to settings
            </Link>
          </div>
        ) : (
          <p className="m-0 text-sm text-[var(--app-muted)]">
            Finishing the connection…
          </p>
        )}
      </SurfaceCard>
    </div>
  )
}
