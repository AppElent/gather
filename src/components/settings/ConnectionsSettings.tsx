import { useAction, useMutation, useQuery } from 'convex/react'
import { ConvexError } from 'convex/values'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { groupHref } from '../../lib/groupPaths'
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

/**
 * Starts the provider OAuth flow for one Group; shared with the Tasks add-list
 * flow, which connects from inside the Group it is adding a list to.
 *
 * The Group is written down before leaving, because the callback comes back on
 * a fresh page load with nothing but what `sessionStorage` kept for it.
 */
export function useConnectProvider(groupSlug: string, returnTo: string) {
  const getAuthorizeUrl = useAction(api.integrations.getAuthorizeUrl)
  return async (provider: ExternalProvider) => {
    const url = await getAuthorizeUrl({
      provider,
      redirectUri: oauthRedirectUri(),
      state: newOAuthState(provider, groupSlug, returnTo),
    })
    window.location.href = url
  }
}

export interface ConnectionsSettingsProps {
  /** The Group these connections belong to. */
  groupSlug: string
  /** Its name, so the page says whose Notion it is about to disconnect. */
  groupName: string
}

/**
 * One Group's connections to Notion and Todoist.
 *
 * A connection is Group-scoped content — the token belongs to the household
 * that authorised it, not to whoever clicked Connect — so this names the Group
 * it is acting on rather than saying "your group" and leaving it to be guessed.
 */
export function ConnectionsSettings({
  groupSlug,
  groupName,
}: ConnectionsSettingsProps) {
  const connections = useQuery(api.integrations.listConnections, { groupSlug })
  const disconnect = useMutation(api.integrations.disconnect)
  const connect = useConnectProvider(
    groupSlug,
    groupHref('settings', groupSlug),
  )
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
        Connect an external app for {groupName}. Every member of {groupName} can
        use it — Tasks can mirror a list from it — and nobody outside can.
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
                        `Disconnect ${p.label} from ${groupName}? Linked lists will stop loading until it is reconnected.`,
                      )
                    ) {
                      void disconnect({ connectionId: conn._id, groupSlug })
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
