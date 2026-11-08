import type { WithoutSystemFields } from 'convex/server'
import { convexTest } from 'convex-test'
import type { Doc, Id } from '../convex/_generated/dataModel'
import type { MutationCtx } from '../convex/_generated/server'
import schema from '../convex/schema'

// convex-test discovers Convex function modules by globbing for them, and its
// own built-in glob is relative to its package directory — which pnpm's
// content-addressed layout puts nowhere near this repo's `convex/`. So the
// module map is built here instead and handed over explicitly.
//
// This file lives outside `convex/` on purpose: everything inside that
// directory is loaded by the Convex bundler at push time, and `import.meta.glob`
// is Vite-only syntax that would throw there.
export const modules = import.meta.glob('../convex/**/*.*s')

/**
 * A running Convex backend for one test, on the schema the app really has.
 *
 * A migration test needs the schema as it was *before* the migration, which the
 * app's own schema can no longer express — build that one with
 * `convexTest(legacySchema, modules)`, reusing the exported module map.
 *
 * Seed with `t.run(...)` for direct database access, then call real queries and
 * mutations — `t.withIdentity({ subject })` to act as a given person, or the
 * bare `t` to act as a signed-out caller.
 */
export function testConvex() {
  return convexTest(schema, modules)
}

/** The people tests act as: `t.withIdentity(alice)`. */
export const alice = {
  subject: 'clerk_alice',
  name: 'Alice',
  email: 'a@example.com',
}
export const bob = { subject: 'clerk_bob', name: 'Bob', email: 'b@example.com' }
export const carol = {
  subject: 'clerk_carol',
  name: 'Carol',
  email: 'c@example.com',
}
export const carla = {
  subject: 'clerk_carla',
  name: 'Carla',
  email: 'c@example.com',
}

/** A Group row, without saying more about it than the test cares about. */
export async function seedGroup(
  ctx: Pick<MutationCtx, 'db'>,
  group: Omit<WithoutSystemFields<Doc<'groups'>>, 'inviteCode'> & {
    inviteCode?: string
  },
): Promise<Id<'groups'>> {
  return await ctx.db.insert('groups', {
    inviteCode: `${group.slug}-code`,
    ...group,
  })
}

export async function seedMember(
  ctx: Pick<MutationCtx, 'db'>,
  groupId: Id<'groups'>,
  userId: Id<'users'>,
  role: Doc<'memberships'>['role'] = 'member',
): Promise<Id<'memberships'>> {
  return await ctx.db.insert('memberships', { groupId, userId, role })
}
