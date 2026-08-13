import { useAction, useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { errorMessage } from '../../lib/errorMessage'
import { groupHref } from '../../lib/groupPaths'
import { fmt, useMessages } from '../../lib/i18n'
import {
  type ExternalProvider,
  newOAuthState,
  oauthRedirectUri,
  PROVIDER_LABELS,
} from '../../lib/oauth'
import { useConfirmAction } from '../app/ConfirmAction'
import { SurfaceCard } from '../app/ShellPrimitives'

const PROVIDERS: Array<{ id: ExternalProvider; label: string }> = (
  ['notion', 'todoist'] as const
).map((id) => ({ id, label: PROVIDER_LABELS[id] }))

const buttonClass =
  'inline-flex min-h-9 items-center rounded-[var(--app-radius)] border border-[var(--app-border)] px-3 text-sm font-semibold'

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
 *
 * A provider is a heading with a list under it rather than a row with one
 * button, because a Group may hold several accounts at the same provider: the
 * shared household Todoist and somebody's own, two Notion workspaces. Each is
 * named by its account, and a disconnected one stays listed — it is still the
 * account a linked list is waiting on.
 */
export function ConnectionsSettings({
  groupSlug,
  groupName,
}: ConnectionsSettingsProps) {
  const connections = useQuery(api.integrations.listConnections, { groupSlug })
  const { connections: connectionsText } = useMessages().settings
  const disconnect = useMutation(api.integrations.disconnect)
  const connect = useConnectProvider(
    groupSlug,
    groupHref('settings', groupSlug),
  )
  const { confirm, dialog } = useConfirmAction()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<ExternalProvider | null>(null)

  async function onConnect(provider: ExternalProvider) {
    setError(null)
    setBusy(provider)
    try {
      await connect(provider)
    } catch (e) {
      setBusy(null)
      setError(errorMessage(e, connectionsText.startFailed))
    }
  }

  return (
    <SurfaceCard>
      <h2 className="m-0 mb-1 text-base font-semibold">
        {connectionsText.title}
      </h2>
      <p className="m-0 mb-3 text-sm text-[var(--app-muted)]">
        {fmt(connectionsText.intro, { group: groupName })}
      </p>
      {error && <p className="m-0 mb-2 text-sm text-red-600">{error}</p>}
      <div className="grid gap-3">
        {PROVIDERS.map((p) => {
          const forProvider = (connections ?? []).filter(
            (c) => c.provider === p.id,
          )
          return (
            <section key={p.id} className="grid gap-2">
              <h3 className="m-0 text-sm font-semibold">{p.label}</h3>
              {forProvider.length === 0 ? (
                <p className="m-0 text-xs text-[var(--app-muted)]">
                  {connectionsText.notConnected}
                </p>
              ) : (
                <ul className="m-0 grid list-none gap-2 p-0">
                  {forProvider.map((conn) => (
                    <li
                      key={conn._id}
                      className="flex items-center justify-between gap-3 rounded-[var(--app-radius)] border border-[var(--app-border)] px-3 py-2"
                    >
                      <p className="m-0 text-xs text-[var(--app-muted)]">
                        {conn.status === 'connected'
                          ? fmt(connectionsText.connectedBy, {
                              account: conn.accountLabel,
                              name: conn.connectedByName,
                            })
                          : fmt(connectionsText.disconnectedAccount, {
                              account: conn.accountLabel,
                            })}
                      </p>
                      {conn.status === 'connected' ? (
                        <button
                          type="button"
                          className={buttonClass}
                          onClick={() =>
                            confirm({
                              title: fmt(connectionsText.disconnectTitle, {
                                account: conn.accountLabel,
                                group: groupName,
                              }),
                              body: connectionsText.disconnectBody,
                              confirmLabel: connectionsText.disconnect,
                              errorFallback: fmt(
                                connectionsText.disconnectFailed,
                                { provider: p.label },
                              ),
                              run: () =>
                                disconnect({
                                  connectionId: conn._id,
                                  groupSlug,
                                }),
                            })
                          }
                        >
                          {connectionsText.disconnect}
                        </button>
                      ) : (
                        // Reconnecting is the same OAuth round trip as
                        // connecting: signing in as this account again lands
                        // back on this row, and every list linked to it works
                        // once more.
                        <button
                          type="button"
                          className={buttonClass}
                          disabled={busy === p.id}
                          onClick={() => void onConnect(p.id)}
                        >
                          {busy === p.id
                            ? connectionsText.opening
                            : connectionsText.reconnect}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                className={`${buttonClass} justify-self-start`}
                disabled={busy === p.id}
                onClick={() => void onConnect(p.id)}
              >
                {busy === p.id
                  ? connectionsText.opening
                  : forProvider.length === 0
                    ? connectionsText.connect
                    : connectionsText.connectAnother}
              </button>
            </section>
          )
        })}
      </div>

      {dialog}
    </SurfaceCard>
  )
}
