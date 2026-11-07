import { v } from 'convex/values'

/**
 * A `v.union` of literals, built from a `@gather/core` tuple so that the
 * database, the functions and the screens cannot hold different closed sets.
 */
export function literals<T extends string>(values: readonly T[]) {
  // Convex's union needs at least two members, and every set here has more.
  const [first, second, ...rest] = values.map((value) => v.literal(value))
  return v.union(first, second, ...rest)
}
