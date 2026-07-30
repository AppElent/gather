import { convexTest } from 'convex-test'
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
