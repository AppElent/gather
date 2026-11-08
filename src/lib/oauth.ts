/**
 * The provider OAuth round trip, and what has to survive it.
 *
 * Connecting Notion or Todoist leaves the app entirely and comes back through
 * `/integrations/callback` on a fresh page load, so anything the callback needs
 * has to be written down before leaving. Two things are: where to return to,
 * and — since a connection belongs to a Group (ADR-0003) — which Group the
 * connection is being made for.
 *
 * The Group is written down rather than read from the Current Group on the way
 * back: the provider does not carry it, and the Current Group may have changed
 * in another tab while the provider's page was open. A round trip that comes
 * back without one fails visibly rather than picking one.
 */

import {
  EXTERNAL_PROVIDER_IDS,
  type ExternalProviderId,
} from '@gather/core/domain'
import { useAction } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { hrefTo } from './links'

export const PROVIDER_LABELS: Record<ExternalProviderId, string> = {
  notion: 'Notion',
  todoist: 'Todoist',
}

/**
 * Starts the provider OAuth flow for one Group; the caller picks where the round
 * trip returns to.
 *
 * The Group is written down before leaving, because the callback comes back on
 * a fresh page load with nothing but what `sessionStorage` kept for it.
 */
export function useConnectProvider(groupSlug: string, returnTo: string) {
  const getAuthorizeUrl = useAction(api.integrations.getAuthorizeUrl)
  return async (provider: ExternalProviderId) => {
    const url = await getAuthorizeUrl({
      provider,
      redirectUri: oauthRedirectUri(),
      state: newOAuthState(provider, groupSlug, returnTo),
    })
    window.location.href = url
  }
}

const STATE_KEY = 'gather.oauth.state'
const RETURN_KEY = 'gather.oauth.returnTo'
const GROUP_KEY = 'gather.oauth.groupSlug'

export function oauthRedirectUri(): string {
  return `${window.location.origin}/integrations/callback`
}

/**
 * Create and persist a CSRF state; remember the Group being connected for, and
 * where to return afterwards.
 */
export function newOAuthState(
  provider: ExternalProviderId,
  groupSlug: string,
  returnTo: string,
): string {
  const state = `${provider}.${crypto.randomUUID()}`
  sessionStorage.setItem(STATE_KEY, state)
  sessionStorage.setItem(RETURN_KEY, returnTo)
  sessionStorage.setItem(GROUP_KEY, groupSlug)
  return state
}

/**
 * Validate the returned state; yields the provider, the Group it was started
 * from and where to go next, or null on mismatch.
 *
 * `groupSlug` is null when the round trip started before this key existed, or
 * in another tab, or from a `sessionStorage` that has since been cleared. That
 * is a failure the callback shows, not something to paper over.
 */
export function consumeOAuthState(state: string | undefined): {
  provider: ExternalProviderId
  groupSlug: string | null
  returnTo: string
} | null {
  const stored = sessionStorage.getItem(STATE_KEY)
  const returnTo = sessionStorage.getItem(RETURN_KEY) ?? hrefTo('settings')
  const groupSlug = sessionStorage.getItem(GROUP_KEY)
  sessionStorage.removeItem(STATE_KEY)
  sessionStorage.removeItem(RETURN_KEY)
  sessionStorage.removeItem(GROUP_KEY)
  if (!state || !stored || state !== stored) return null
  const provider = EXTERNAL_PROVIDER_IDS.find(
    (id) => id === state.split('.')[0],
  )
  if (!provider) return null
  return { provider, groupSlug, returnTo }
}
