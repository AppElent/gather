import { ConvexError } from 'convex/values'
import { internalMutation, mutation } from './_generated/server'
import {
  applyCatalog,
  applySample,
  applyTastingCatalog,
  ensureSeedUser,
  resetSample,
} from './lib/seed/apply'
import { getCurrentUser } from './lib/sharing'

/**
 * Seed entrypoints. Two mechanisms with deliberately opposite rules, kept as
 * two plain functions rather than one abstraction (ADR 0004):
 *
 * - **Catalog** (`seedCatalog`) — reference data the app needs to work, in
 *   every environment including production. Reconciled by `seedKey`; the seed
 *   always wins.
 * - **Sample household** (`seedPreview`, `loadSampleData`) — fake content for
 *   dev and preview only. Wiped and recreated on every run so its dates stay
 *   anchored to now.
 *
 * Fixtures and the logic live under `lib/seed/`; this file is only the
 * callable surface, because anything exporting a function under `convex/`
 * becomes deployed API.
 */

/**
 * The Clerk subject of the shared test user on the Clerk *test* instance —
 * the account `@appelent/auth`'s test-login button signs into on previews.
 *
 * Hardcoded rather than configured: `--preview-run` takes a function name and
 * no arguments, so a preview seed can only read its configuration from the
 * deployment, and this is a public identifier for a throwaway test account,
 * not a secret. If the Clerk test user is ever recreated this value must be
 * updated, or previews will seed a household nobody can sign into.
 */
const PREVIEW_TEST_USER = {
  clerkId: 'user_2tTlbmSTh4kbXmg9v6EN7YW3B4d',
  name: 'Test User',
  email: 'test@example.invalid',
}

/**
 * Reconcile the food Catalog. Safe and expected to run in production — it is
 * a step in `deploy:prod` / `deploy:dev`, since Convex offers no post-deploy
 * hook outside previews.
 */
export const seedCatalog = internalMutation({
  args: {},
  handler: async (ctx) => await applyCatalog(ctx),
})

/**
 * Reconcile the tasting Catalog — the well-known cheeses the subject picker
 * offers (#199, ADR-0024). Production too, and for the same reason: it is
 * reference data the Module needs to work, and it is a step in `deploy:dev` /
 * `deploy:prod` beside `seedCatalog`.
 *
 * A second entrypoint rather than a line inside `seedCatalog`, because the two
 * catalogs are different kinds of thing and a deploy should be able to say
 * which one it just reconciled.
 */
export const seedTastingCatalog = internalMutation({
  args: {},
  handler: async (ctx) => await applyTastingCatalog(ctx),
})

/**
 * The preview entrypoint, named in `--preview-run`. Reconciles the Catalog,
 * then rebuilds the Sample household against the shared test user so that
 * clicking test-login on a PR preview lands in a populated household.
 */
export const seedPreview = internalMutation({
  args: {},
  handler: async (ctx) => {
    const catalog = await applyCatalog(ctx)
    const tastingCatalog = await applyTastingCatalog(ctx)
    const reset = await resetSample(ctx)
    const ownerId = await ensureSeedUser(
      ctx,
      PREVIEW_TEST_USER.clerkId,
      PREVIEW_TEST_USER.name,
      PREVIEW_TEST_USER.email,
    )
    const sample = await applySample(ctx, ownerId, Date.now())
    return { catalog, tastingCatalog, reset, sample }
  },
})

/**
 * Guard for the two publicly callable seed mutations.
 *
 * These are reachable by anyone who knows the deployment URL, so unlike the
 * internal entrypoints they cannot rely on nobody calling them. Production
 * simply never sets `ENABLE_SAMPLE_DATA`, and without it they refuse.
 */
function requireSampleDataEnabled() {
  if (process.env.ENABLE_SAMPLE_DATA !== 'true') {
    throw new ConvexError(
      'Sample data is disabled on this deployment. Set ENABLE_SAMPLE_DATA=true to enable it (never on production).',
    )
  }
}

/**
 * Rebuild the Sample household around the *signed-in* user, so a developer
 * gets sample content in their own environment under their own account.
 * Backs the Developer panel in Settings.
 */
export const loadSampleData = mutation({
  args: {},
  handler: async (ctx) => {
    requireSampleDataEnabled()
    const user = await getCurrentUser(ctx)
    if (!user) throw new ConvexError('Not authenticated')
    const catalog = await applyCatalog(ctx)
    const tastingCatalog = await applyTastingCatalog(ctx)
    const reset = await resetSample(ctx)
    const sample = await applySample(ctx, user._id, Date.now())
    return { catalog, tastingCatalog, reset, sample }
  },
})

/** Remove the Sample household without rebuilding it — the empty state. */
export const resetSampleData = mutation({
  args: {},
  handler: async (ctx) => {
    requireSampleDataEnabled()
    const user = await getCurrentUser(ctx)
    if (!user) throw new ConvexError('Not authenticated')
    return await resetSample(ctx)
  },
})
