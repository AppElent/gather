/**
 * Which Group a client opens in.
 *
 * The Current Group is ambient on both clients (ADR-0031): each retains the id
 * of the Group it was last in, locally, and both ask this function whether
 * that id is still good, so they answer it the same way. Neither reads a
 * stored *active* Group off the `users` row — there is no server-side default.
 * What a client retains is a local memory of where it was, validated against
 * the Member's Groups on every read and never written anywhere another client
 * can see.
 */

/** The Sample household's Group. Its name is how the seed finds it again. */
export const SAMPLE_GROUP_NAME = 'Willow Street'

/** Enough of a Group to choose one. */
export interface LandingGroup {
  _id: string
}

/**
 * Which Group to open when nothing was retained, or what was retained is no
 * longer the Member's.
 *
 * Their Personal group, because everybody has one and it is the Group whose
 * content is certainly theirs; failing that, the first Group they belong to.
 * Null when they belong to none, which means there is nowhere to land and the
 * join-or-create flow is the only honest answer.
 *
 * This is not a stored active Group coming back through the side door: it is
 * resolved from the membership list alone, and the client that asks retains
 * the answer locally.
 */
export function landingGroupId(groups: readonly LandingGroup[]): string | null {
  return groups[0]?._id ?? null
}

/**
 * The Group a client opens in: the id it retained, if that is still a Group the
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
 * - `ready` — the id of the Group to open, and whether it was retained or
 *   fallen back to. `source` is what lets a caller notice that the retained
 *   Group went away — being removed from a Group is a real event — without
 *   having to compare ids itself.
 *
 * Validation is the point. A retained id is a guess about a membership that
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
