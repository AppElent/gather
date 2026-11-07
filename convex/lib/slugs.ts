/**
 * Slug rules for Groups.
 *
 * A slug is the readable, globally unique name identifying a Group in a URL
 * (`/g/<slug>/…`, ADR-0002). Readability is the point: it is how someone
 * notices which Group they are acting in, which is why this normalises rather
 * than hashes, and why collisions get a numbered suffix instead of an error.
 *
 * Pure logic only — nothing here touches Convex. Allocation against the
 * database lives in `groupSlugs.ts`.
 */

/** Longest slug this will ever produce, suffixes aside. */
export const MAX_SLUG_LENGTH = 48

/**
 * Segments a slug may never equal, because each one either is or could become a
 * Group-level or top-level route. A name that would land on one is escaped
 * rather than rejected — see `sharedSlugBase`.
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  'g',
  'api',
  'about',
  'account',
  'settings',
  'sign-in',
  'sign-up',
  'forgot-password',
  'integrations',
  // The food Catalog. It has routes at both levels but is not a Module — no
  // registry entry, no sidebar row — so nothing else claims the segment on its
  // behalf, and `groupPaths.segments.test.ts` holds it here instead.
  'foods',
  // The Combos library, reserved for the same reason as `foods` above: it has a
  // Group-level route and is not a Module — a Combo is Personal (ADR-0012), so
  // there is no registry entry to claim the segment on its behalf.
  'combos',
  'new',
  'all',
  'home',
  'group-settings',
  'me',
  'admin',
  'groups',
  'invite',
  'join',
])

/**
 * Kept out of a new Group's slug so that a household named "Me and Bob" can never
 * take an address that reads like one person's, beside the existing Groups that
 * hold this prefix (ADR-0002).
 */
export const PERSONAL_SLUG_PREFIX = 'me-'

/** Prefix escaping a Group out of a reserved or `me-` slug. */
const SHARED_ESCAPE_PREFIX = 'g-'

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
 * The sluggable part of a name, or the empty string when there is none.
 * `normaliseSlug` is the same thing with a fallback; the callers that need to
 * tell "nothing usable" apart from a Group genuinely named "Group" use this.
 */
function sluggablePart(name: string): string {
  let slug = name.normalize('NFKD').toLowerCase()
  for (const [pattern, replacement] of TRANSLITERATIONS) {
    slug = slug.replace(pattern, replacement)
  }
  return cap(
    slug
      // Combining marks left behind by NFKD — the accents themselves.
      .replace(/\p{M}+/gu, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, ''),
  )
}

/**
 * A name reduced to slug characters: lowercase, unaccented, hyphen-separated,
 * capped in length. Returns `group` when nothing usable survives.
 */
export function normaliseSlug(name: string): string {
  return sluggablePart(name) || EMPTY_SLUG_FALLBACK
}

/**
 * The slug a Group starts from, escaped out of the reserved segments and the
 * `me-` prefix so the ladder below can only ever produce a usable
 * slug. "Me and Bob" becomes `g-me-and-bob`, not `me-and-bob`.
 */
export function sharedSlugBase(name: string): string {
  const slug = normaliseSlug(name)
  const collides =
    RESERVED_SLUGS.has(slug) || slug.startsWith(PERSONAL_SLUG_PREFIX)
  return collides ? cap(`${SHARED_ESCAPE_PREFIX}${slug}`) : slug
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
