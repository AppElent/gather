import type { ExternalProviderId } from '@gather/core/domain'
import { internal } from '../../_generated/api'
import type { MutationCtx } from '../../_generated/server'

/** The app's own OAuth client, which is what a provider revokes a token for. */
export interface OAuthClient {
  clientId: string
  clientSecret: string
}

/**
 * The version the Notion docs name for `POST /v1/oauth/revoke`; the rest of
 * the Notion adapter stays on its own versions.
 */
const NOTION_REVOKE_VERSION = '2026-03-11'

/**
 * Ask the provider to revoke an access token Gather is dropping (APP-909).
 *
 * Best effort: a token the provider no longer knows, a refusal and a network
 * failure all come back as `false` rather than a throw, because the row is
 * already gone and nothing can be retried from it. The token never appears in
 * what this returns or logs.
 */
export async function revokeProviderToken(
  provider: ExternalProviderId,
  accessToken: string,
  client: OAuthClient,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const basic = `Basic ${btoa(`${client.clientId}:${client.clientSecret}`)}`
  try {
    const res =
      provider === 'notion'
        ? await fetchImpl('https://api.notion.com/v1/oauth/revoke', {
            method: 'POST',
            headers: {
              Authorization: basic,
              'Content-Type': 'application/json',
              'Notion-Version': NOTION_REVOKE_VERSION,
            },
            body: JSON.stringify({ token: accessToken }),
          })
        : // Todoist's RFC 7009 endpoint.
          await fetchImpl('https://api.todoist.com/api/v1/revoke', {
            method: 'POST',
            headers: {
              Authorization: basic,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              token: accessToken,
              token_type_hint: 'access_token',
            }).toString(),
          })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Revoke a token that is leaving the database, once this transaction commits.
 *
 * A mutation cannot reach the provider, so the revoke runs as scheduled work
 * and goes only if the deletion does. Call it next to every write that drops or
 * replaces a stored token.
 */
export async function revokeAfterCommit(
  ctx: MutationCtx,
  provider: ExternalProviderId,
  accessToken: string,
) {
  await ctx.scheduler.runAfter(0, internal.integrations.revokeToken, {
    provider,
    accessToken,
  })
}
