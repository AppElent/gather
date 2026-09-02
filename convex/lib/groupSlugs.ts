import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { nthSlugCandidate, sharedSlugBase } from './slugs'

interface AllocateArgs {
  /** The Group's name, as a person typed it. */
  name: string
  /** A Group renaming itself does not collide with its own current slug. */
  excludeGroupId?: Id<'groups'>
  /**
   * Slugs already spoken for in this transaction but not necessarily written —
   * a dry-run backfill allocates without inserting, and would otherwise hand
   * the same slug to every Group. Allocated slugs are added to it.
   */
  taken?: Set<string>
}

/**
 * The one place a Group's slug is chosen. Walks the collision ladder and
 * returns the first free candidate, so a name that is already taken produces a
 * distinct slug rather than an error — a household should not have to rename
 * itself because a stranger got there first.
 */
export async function allocateGroupSlug(
  ctx: MutationCtx,
  { name, excludeGroupId, taken }: AllocateArgs,
): Promise<string> {
  const base = sharedSlugBase(name)

  for (let n = 1; ; n++) {
    const candidate = nthSlugCandidate(base, n)
    if (taken?.has(candidate)) continue

    const holders = await ctx.db
      .query('groups')
      .withIndex('by_slug', (q) => q.eq('slug', candidate))
      .collect()

    if (holders.every((group) => group._id === excludeGroupId)) {
      taken?.add(candidate)
      return candidate
    }
  }
}
