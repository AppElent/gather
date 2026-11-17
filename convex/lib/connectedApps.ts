/**
 * The boundary for connected apps: MCP clients holding a Clerk OAuth token.
 *
 * Convex trusts those tokens directly (`auth.config.ts`), so anything holding
 * one can call any public function, not only the ones the MCP endpoint wraps.
 * The read/write split therefore lives here, where every identity is resolved
 * (`lib/sharing.ts`), and not only in the Worker (ADR-0046).
 */
import type { Auth, UserIdentity } from 'convex/server'
import { ConvexError } from 'convex/values'

export const MCP_READ_SCOPE = 'gather:read'
export const MCP_WRITE_SCOPE = 'gather:write'

/** What a connected app is told when it has no Gather scope at all. */
export const CONNECTED_APP_NO_ACCESS =
  'This connected app has no access to Gather.'
/** What a read-only connected app is told when it tries to write. */
export const CONNECTED_APP_READ_ONLY =
  'This connected app has read-only access to Gather.'
/** What any connected app is told at the account and Group administration. */
export const CONNECTED_APP_REFUSED =
  'Connected apps cannot do this. Use the Gather app.'

/**
 * The scopes of a Clerk OAuth token, or null for the app's own session token.
 * OAuth access tokens carry `client_id`; the app's `convex` template does not.
 */
export function connectedAppScopes(identity: UserIdentity): Set<string> | null {
  if (typeof identity.client_id !== 'string') return null
  const scope = typeof identity.scope === 'string' ? identity.scope : ''
  return new Set(scope.split(' ').filter(Boolean))
}

/**
 * The caller's identity, with the connected-app rule applied: a connected app
 * needs a Gather scope, and without `gather:write` it may only read, so any
 * context that can write (a mutation or an action) refuses it.
 */
export async function getGatedIdentity(ctx: {
  auth: Auth
}): Promise<UserIdentity | null> {
  const identity = await ctx.auth.getUserIdentity()
  const scopes = identity && connectedAppScopes(identity)
  if (!scopes) return identity
  if (!scopes.has(MCP_READ_SCOPE) && !scopes.has(MCP_WRITE_SCOPE))
    throw new ConvexError(CONNECTED_APP_NO_ACCESS)
  if ('runMutation' in ctx && !scopes.has(MCP_WRITE_SCOPE))
    throw new ConvexError(CONNECTED_APP_READ_ONLY)
  return identity
}

/**
 * Refuse every connected app, whatever it was granted. For what stays in the
 * app: deleting the account or a Group, changing roles, leaving or joining a
 * Group, and reading the invite code.
 */
export async function rejectConnectedApps(ctx: { auth: Auth }) {
  const identity = await ctx.auth.getUserIdentity()
  if (identity && connectedAppScopes(identity))
    throw new ConvexError(CONNECTED_APP_REFUSED)
}
