/**
 * The name a person goes by in their Groups, from the claims on their Clerk
 * token (APP-663).
 *
 * Clerk's Convex template sets `name` from the full name, which is empty when
 * the account has only a first name, or came from Sign in with Apple without
 * one. Saving the literal fallback then showed everyone as "Member", for good,
 * so the other name claims come first. Never the email address: a Member list
 * shows a name and a standing, and nothing else (`convex/groups.ts`).
 */
export const FALLBACK_MEMBER_NAME = 'Member'

interface NameClaims {
  name?: string
  givenName?: string
  familyName?: string
  nickname?: string
  preferredUsername?: string
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
}

/** The best name the claims hold, or null when they hold none. */
export function nameFromIdentity(identity: NameClaims): string | null {
  const full = clean(identity.name)
  if (full) return full
  const parts = [clean(identity.givenName), clean(identity.familyName)]
    .filter(Boolean)
    .join(' ')
  if (parts) return parts
  return clean(identity.nickname) || clean(identity.preferredUsername) || null
}

/** The most characters of a name the app may send. */
export const MAX_NAME_LENGTH = 80

/**
 * The name to store: the claims' name when they have one, else the name the
 * app read from Clerk, else what is stored already, else the fallback. A
 * stored name only changes when one of those says something, so a token and
 * app without names never erase a real one.
 */
export function storedName(
  identity: NameClaims,
  existing?: string,
  fromApp?: string,
): string {
  const sent = clean(fromApp).slice(0, MAX_NAME_LENGTH).trim()
  return (
    nameFromIdentity(identity) || sent || existing || FALLBACK_MEMBER_NAME
  )
}

