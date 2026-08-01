/** Enough of a Group to choose one and address it. */
export interface LandingGroup {
  slug: string
  isPersonal: boolean
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
export function landingGroupSlug(
  groups: readonly LandingGroup[],
): string | null {
  const landing = groups.find((group) => group.isPersonal) ?? groups[0]
  return landing?.slug ?? null
}
