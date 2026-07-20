import { useAction, useMutation, useQuery } from 'convex/react'
import { ConvexError } from 'convex/values'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import {
  type ExternalProvider,
  newOAuthState,
  oauthRedirectUri,
} from '../../lib/oauth'
import { SurfaceCard } from '../app/ShellPrimitives'

const PROVIDERS: Array<{ id: ExternalProvider; label: string }> = [
  { id: 'notion', label: 'Notion' },
  { id: 'todoist', label: 'Todoist' },
]

const buttonClass =
  'inline-flex min-h-9 items-center rounded-[var(--app-radius)] border border-[var(--app-border)] px-3 text-sm font-semibold'

export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ConvexError && typeof error.data === 'string') {
    return error.data
  }
  return fallback
}

/** Starts the provider OAuth flow; shared with the Tasks add-list flow. */
export function useConnectProvider(returnTo: string) {
  const getAuthorizeUrl = useAction(api.integrations.getAuthorizeUrl)
  return async (provider: ExternalProvider) => {
    const url = await getAuthorizeUrl({
      provider,
      redirectUri: oauthRedirectUri(),
      state: newOAuthState(provider, returnTo),
    })
    window.location.href = url
  }
}

export function ConnectionsSettings() {
  const connections = useQuery(api.integrations.listConnections)
  const disconnect = useMutation(api.integrations.disconnect)
  const connect = useConnectProvider('/settings')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<ExternalProvider | null>(null)

  async function onConnect(provider: ExternalProvider) {
    setError(null)
    setBusy(provider)
    try {
      await connect(provider)
    } catch (e) {
      setBusy(null)
      setError(errorMessage(e, 'Could not start the connection — try again.'))
    }
  }

  return (
    <SurfaceCard>
      <h2 className="m-0 mb-1 text-base font-semibold">Connections</h2>
      <p className="m-0 mb-3 text-sm text-[var(--app-muted)]">
        Connect external apps for your whole group. Modules like Tasks can link
        lists to a connected app.
      </p>
      {error && <p className="m-0 mb-2 text-sm text-red-600">{error}</p>}
      <ul className="m-0 grid list-none gap-2 p-0">
        {PROVIDERS.map((p) => {
          const conn = connections?.find((c) => c.provider === p.id)
          return (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3 rounded-[var(--app-radius)] border border-[var(--app-border)] px-3 py-2"
            >
              <div>
                <span className="text-sm font-semibold">{p.label}</span>
                <p className="m-0 text-xs text-[var(--app-muted)]">
                  {conn
                    ? `${conn.accountLabel} — connected by ${conn.connectedByName}`
                    : 'Not connected'}
                </p>
              </div>
              {conn ? (
                <button
                  type="button"
                  className={buttonClass}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Disconnect ${p.label}? Linked lists will stop loading until it is reconnected.`,
                      )
                    ) {
                      void disconnect({ connectionId: conn._id })
                    }
                  }}
                >
                  Disconnect
                </button>
              ) : (
                <button
                  type="button"
                  className={buttonClass}
                  disabled={busy === p.id}
                  onClick={() => void onConnect(p.id)}
                >
                  {busy === p.id ? 'Opening…' : 'Connect'}
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </SurfaceCard>
  )
}
