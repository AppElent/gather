import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useAction } from 'convex/react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { SurfaceCard } from '../../components/app/ShellPrimitives'
import { errorMessage } from '../../lib/errorMessage'
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
    // A connection belongs to a Group, and this page is not inside one: the
    // only Group it can know about is the one the flow set out from. Without
    // it there is nowhere to store the token, and picking a Group on the
    // caller's behalf is the guess ADR-0002 exists to stop — so this fails.
    if (!consumed.groupSlug) {
      setFailure(
        'That connection came back without a group — start it again from the group’s settings page.',
      )
      return
    }
    completeOAuth({
      provider: consumed.provider,
      groupSlug: consumed.groupSlug,
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
