import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'
import { ENTRIES, type Entry } from '../env.manifest.ts'

/**
 * Runtime validation for the variables this app's own code reads.
 *
 * The list is *derived* from `env.manifest.ts` rather than restated here. A
 * second hand-maintained list of variable names is exactly the drift this
 * repo's env work exists to remove — `README.md` described a `wrangler.jsonc`
 * `vars` block that never existed, and this file used to declare a `SERVER_URL`
 * and a `VITE_APP_TITLE` that nothing read.
 *
 * Only two consumers belong here. `vite-build` values are inlined into the
 * client bundle, and `worker-runtime` values are read by server functions.
 * `convex-functions` variables live on a Convex deployment and are read by
 * `convex/`, which cannot import this file; `workflow` and `local-tooling` ones
 * are never read by application code at all.
 */
function schemaFor<T extends string>(
  consumer: 'vite-build' | 'worker-runtime',
) {
  const shape: Record<string, z.ZodType> = {}
  for (const entry of ENTRIES as readonly Entry[]) {
    const landing = entry.lands[consumer]
    if (!landing) continue
    // Everything is optional at the type level: which variables are *required*
    // is a per-environment question the manifest answers and `pnpm run env:check`
    // enforces, with a far better error than a blank page on boot.
    shape[landing.name] = z.string().min(1).optional()
  }
  return shape as Record<T, z.ZodType>
}

export const env = createEnv({
  server: schemaFor('worker-runtime'),

  /**
   * The prefix that client-side variables must have. This is enforced both at
   * a type-level and at runtime.
   */
  clientPrefix: 'VITE_',

  // The manifest's type already guarantees every `vite-build` name starts with
  // VITE_, which is the invariant this parameter checks; the annotation just
  // carries that guarantee across the dynamic construction above.
  client: schemaFor<`VITE_${string}`>('vite-build'),

  /**
   * What object holds the environment variables at runtime. This is usually
   * `process.env` or `import.meta.env`.
   */
  runtimeEnv: import.meta.env,

  /**
   * Treat `FOO=` as absent rather than as an empty string, so an unset optional
   * variable does not read as a present-but-blank one.
   */
  emptyStringAsUndefined: true,
})
