/**
 * Which Groups to draw while the live list may be momentarily missing.
 *
 * Convex removes a query result while it recovers a socket or a token, and the
 * shell keeps the last list across that gap rather than collapsing to a loading
 * screen. The retained list is only ever *this account's*: on a sign-out or an
 * account switch it is dropped, never shown to the next person.
 */

/** A resolved Groups list, and the Clerk user it was resolved for. */
export interface RetainedGroups<T> {
  account: string
  groups: T[]
}

export function groupsForSurface<T>(
  current: T[] | undefined,
  retained: RetainedGroups<T> | undefined,
  account: string | null | undefined,
): T[] | undefined {
  if (current !== undefined) return current
  if (typeof account !== 'string' || retained?.account !== account) {
    return undefined
  }
  return retained.groups
}

/**
 * The retention to keep after this render. Returns `retained` itself when
 * nothing changed, so a component can adjust state during render and converge.
 */
export function retainGroups<T>(
  retained: RetainedGroups<T> | undefined,
  current: T[] | undefined,
  account: string | null | undefined,
): RetainedGroups<T> | undefined {
  if (typeof account !== 'string') return undefined
  if (current === undefined) {
    return retained?.account === account ? retained : undefined
  }
  if (retained?.account === account && retained.groups === current) {
    return retained
  }
  return { account, groups: current }
}
