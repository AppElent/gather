/**
 * Which Group a client opens in, when nothing has said which one yet.
 *
 * Both clients ask this and they must answer it the same way — the web from a
 * URL that named no Group (`/`, or a link written before ADR-0002), the phone
 * from a slug it retained across a launch (ADR-0015). Neither reads a stored
 * *active* Group off the `users` row: that is the model ADR-0002 exists to
 * delete, and it is still deleted here. What the phone retains is a local
 * memory of where its one foreground session was, validated against the
 * Member's Groups on every read and never written anywhere the web can see.
 */

/** Enough of a Group to choose one and address it. */
export interface LandingGroup {
  _id: string
}

/**
 * Which Group to send someone to when the address they arrived at names none —
 * `/`, or a link written before ADR-0002.
 *
 * Their Personal group, because everybody has one and it is the Group whose
 * content is certainly theirs; failing that, the first Group they belong to.
 * Null when they belong to none, which means there is nowhere to land and
 * `/groups` is the only honest answer.
 *
 * This is not the stored active Group coming back through the side door.
 * Nothing is written, nothing is remembered, and the next request resolves it
 * again from scratch. It decides one redirect, and the address that redirect
 * lands on says the Group out loud — so two tabs can still sit in two different
 * Groups, and the URL is still the only thing that says which one you are
 * reading (ADR-0002).
 */
export function landingGroupId(
  groups: readonly LandingGroup[],
): string | null {
  return groups[0]?._id ?? null
}

/**
 * The Group a phone reopens in: what it retained, if that is still a Group the
 * Member is in, and the landing Group otherwise.
 *
 * Three answers and no fourth, because the caller genuinely has three different
 * screens to draw:
 *
 * - `pending` — the Groups have not arrived. An unanswered query is not an
 *   empty list, and choosing here means opening one Group and swapping it for
 *   another a round-trip later.
 * - `none` — the Member is in no Group. On a first-ever launch this is usually
 *   "not yet" rather than "none" (`ensureUser` inserts the Personal group on the
 *   same mount), so the caller holds it for a grace period before believing it.
 * - `ready` — a slug to open, and whether it was retained or fallen back to.
 *   `source` is what lets a caller notice that the retained Group went away —
 *   being removed from a Group is a real event — without having to compare
 *   slugs itself.
 *
 * Validation is the point. A retained slug is a guess about a membership that
 * may have ended while the app was closed, so it is never handed back unchecked.
 */
export type GroupSelection =
  | { status: 'pending' }
  | { status: 'none' }
  | { status: 'ready'; groupId: string; source: 'retained' | 'landing' }

export function selectGroup(
  retained: string | null | undefined,
  groups: readonly LandingGroup[] | undefined,
): GroupSelection {
  if (groups === undefined) return { status: 'pending' }

  const groupId = retained?.trim()
  if (groupId && groups.some((group) => group._id === groupId)) {
    return { status: 'ready', groupId, source: 'retained' }
  }

  const landing = landingGroupId(groups)
  if (landing === null) return { status: 'none' }

  return { status: 'ready', groupId: landing, source: 'landing' }
}
