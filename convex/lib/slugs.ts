/**
 * Slug rules for Groups.
 *
 * A slug is the readable, globally unique name a Group is resolved by: every
 * Group-scoped function takes the Current Group as `groupSlug`. This
 * normalises rather than hashes, and collisions get a numbered suffix instead
 * of an error.
 *
 * Pure logic only — nothing here touches Convex. Allocation against the
 * database lives in `groupSlugs.ts`.
 */

/** Longest slug this will ever produce, suffixes aside. */
export const MAX_SLUG_LENGTH = 48

/** Slug for a Group whose name carries nothing sluggable at all. */
const EMPTY_SLUG_FALLBACK = 'group'

/**
 * Latin letters with no canonical decomposition, so NFKD leaves them intact and
 * stripping combining marks does not reach them. Without this they vanish
 * silently and "Søren" becomes "sren".
 */
const TRANSLITERATIONS: ReadonlyArray<readonly [RegExp, string]> = [
  [/æ/g, 'ae'],
  [/œ/g, 'oe'],
  [/ø/g, 'o'],
  [/ß/g, 'ss'],
  [/[đð]/g, 'd'],
  [/þ/g, 'th'],
  [/ł/g, 'l'],
]

function cap(slug: string): string {
  return slug.length <= MAX_SLUG_LENGTH
    ? slug
    : slug.slice(0, MAX_SLUG_LENGTH).replace(/-+$/, '')
}

/**
 * A name reduced to slug characters: lowercase, unaccented, hyphen-separated,
 * capped in length. Returns `group` when nothing usable survives.
 *
 * No segment is reserved and no prefix escaped: the Group is not in a web URL
 * (ADR-0031), and the phone's `gather://g/<slug>/…` link has the slug in a
 * segment of its own.
 */
export function normaliseSlug(name: string): string {
  let slug = name.normalize('NFKD').toLowerCase()
  for (const [pattern, replacement] of TRANSLITERATIONS) {
    slug = slug.replace(pattern, replacement)
  }
  return (
    cap(
      slug
        // Combining marks left behind by NFKD — the accents themselves.
        .replace(/\p{M}+/gu, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, ''),
    ) || EMPTY_SLUG_FALLBACK
  )
}

/**
 * The nth candidate on the collision ladder, counting from 1: the bare base,
 * then `base-2`, `base-3`, … The allocator walks it until one is free.
 *
 * Suffixed candidates may exceed `MAX_SLUG_LENGTH`; keeping the base intact
 * matters more than the cap, which exists for readability rather than storage.
 */
export function nthSlugCandidate(base: string, n: number): string {
  return n <= 1 ? base : `${base}-${n}`
}
