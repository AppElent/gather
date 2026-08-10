/**
 * The provider OAuth round trip, and what has to survive it.
 *
 * Connecting Notion or Todoist leaves the app entirely and comes back through
 * `/integrations/callback` on a fresh page load, so anything the callback needs
 * has to be written down before leaving. Two things are: where to return to,
 * and — since a connection belongs to a Group (ADR-0003) — which Group the
 * connection is being made for.
 *
 * The Group cannot be recovered any other way. The callback is not a Group
 * route, the provider does not carry it, and falling back to "a Group you are
 * in" is exactly the caller-wide guess the rebuild removes. A round trip that
 * comes back without one therefore fails visibly rather than picking one.
 */

export type ExternalProvider = 'notion' | 'todoist'

/**
 * What each provider calls itself. A proper noun rather than a display string,
 * so it is not in the message tree (ADR-0011) — and one table rather than the
 * three that had drifted apart across the settings page, the add-list flow and
 * the list card.
 */
export const PROVIDER_LABELS: Record<ExternalProvider, string> = {
  notion: 'Notion',
  todoist: 'Todoist',
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
  provider: ExternalProvider,
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
  provider: ExternalProvider
  groupSlug: string | null
  returnTo: string
} | null {
  const stored = sessionStorage.getItem(STATE_KEY)
  const returnTo = sessionStorage.getItem(RETURN_KEY) ?? '/settings'
  const groupSlug = sessionStorage.getItem(GROUP_KEY)
  sessionStorage.removeItem(STATE_KEY)
  sessionStorage.removeItem(RETURN_KEY)
  sessionStorage.removeItem(GROUP_KEY)
  if (!state || !stored || state !== stored) return null
  const provider = state.split('.')[0]
  if (provider !== 'notion' && provider !== 'todoist') return null
  return { provider, groupSlug, returnTo }
}
