/**
 * A deep link can reach the app before Clerk has established a session.
 *
 * This is intentionally only a transient handoff, not a second source of
 * truth for the ambient Group: the link is held long enough to cross the auth
 * gate, then `deep-link.tsx` validates it against the Member's live Groups and
 * replaces itself with an ambient native destination.
 */
export interface PendingGroupLink {
  groupSlug: string
  segments: string[]
}

let pending: PendingGroupLink | null = null

export function rememberGroupLink(link: PendingGroupLink) {
  pending = link
}

export function pendingGroupLink(): PendingGroupLink | null {
  return pending
}

export function clearPendingGroupLink() {
  pending = null
}
