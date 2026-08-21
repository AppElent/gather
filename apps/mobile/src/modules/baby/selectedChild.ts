/**
 * Which Child the Baby log opens on.
 *
 * The Module's root *is* a Child's log rather than a list of them — there is no
 * redirect, so there is no "back into a screen that forwards again" loop — and
 * most households have exactly one Child, so a list you always pass through is
 * a tap that never pays.
 *
 * Nothing native is imported here on purpose: the persistence lives in
 * `prefs/localPreference.ts` with every other preference, and what is left is
 * a pure function a test can call with no device and no React tree.
 */

/**
 * The Child to show, out of the ones this Group actually has.
 *
 * A remembered id that is no longer in the list — deleted, or belonging to a
 * Group this phone has since left — falls back to the first Child rather than
 * to an empty screen. Resolving against the list instead of trusting what was
 * stored is the whole point.
 */
export function resolveSelectedChild<T extends { _id: string }>(
  children: readonly T[],
  remembered: string | null,
): T | null {
  if (children.length === 0) return null
  return (
    children.find((child) => child._id === remembered) ?? children[0] ?? null
  )
}
