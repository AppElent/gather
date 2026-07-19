export type ExternalProvider = 'notion' | 'todoist'

const STATE_KEY = 'gather.oauth.state'
const RETURN_KEY = 'gather.oauth.returnTo'

export function oauthRedirectUri(): string {
  return `${window.location.origin}/integrations/callback`
}

/** Create and persist a CSRF state; remember where to return afterwards. */
export function newOAuthState(
  provider: ExternalProvider,
  returnTo: string,
): string {
  const state = `${provider}.${crypto.randomUUID()}`
  sessionStorage.setItem(STATE_KEY, state)
  sessionStorage.setItem(RETURN_KEY, returnTo)
  return state
}

/** Validate the returned state; yields the provider or null on mismatch. */
export function consumeOAuthState(
  state: string | undefined,
): { provider: ExternalProvider; returnTo: string } | null {
  const stored = sessionStorage.getItem(STATE_KEY)
  const returnTo = sessionStorage.getItem(RETURN_KEY) ?? '/settings'
  sessionStorage.removeItem(STATE_KEY)
  sessionStorage.removeItem(RETURN_KEY)
  if (!state || !stored || state !== stored) return null
  const provider = state.split('.')[0]
  if (provider !== 'notion' && provider !== 'todoist') return null
  return { provider, returnTo }
}
