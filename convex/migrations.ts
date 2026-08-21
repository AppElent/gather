/**
 * One-shot data migrations. Each one says here what would retire it, and the
 * document it names in `docs/migrations/` is what records that it has.
 *
 * Nothing in this file is called by the app. They are `internalMutation`s run
 * by hand — `npx convex run migrations:<name> --prod` — so that a migration
 * cannot be triggered by a request, and so that running one is a decision
 * somebody made rather than a side effect of a deploy.
 */
import { internalMutation } from './_generated/server'
import type { BabyEventType } from './lib/babyEvents'

/**
 * The event catalogue as it stood when `trackedTypes` was the field.
 *
 * This is the load-bearing part of the migration and the reason it cannot be
 * a one-liner. A child's `trackedTypes` is a list of acceptances, so the
 * refusals are "everything that was on offer, minus what they accepted" — and
 * *what was on offer* is this list, not today's catalogue. Deriving the
 * refusals from `BABY_EVENT_TYPES` instead would record Memory as refused by
 * every household on the deployment, which is precisely the bug the new field
 * exists to fix.
 *
 * So it is written down, frozen, and dies with this migration.
 */
const OFFERED_BEFORE_MEMORY = [
  'temperature',
  'feeding',
  'diaper',
  'sleep',
  'growth',
  'medication',
  'vaccination',
  'note',
] as const satisfies readonly BabyEventType[]

/**
 * Turn every child's accepted types into the types they refused.
 *
 * Idempotent, because a hand-run migration gets run twice: a child that already
 * has `untrackedTypes` is left alone, and one that never had `trackedTypes`
 * never made a choice and gets no refusals written for it.
 *
 * **Retire this** — the mutation, `OFFERED_BEFORE_MEMORY`, and the
 * `trackedTypes` column in `convex/schema.ts` — once
 * `docs/migrations/0007-baby-tracked-types-become-declines.md` records that it
 * has run on dev and on production.
 */
export const declineByOmission = internalMutation({
  args: {},
  handler: async (ctx) => {
    const babies = await ctx.db.query('babies').collect()
    let migrated = 0
    let skipped = 0

    for (const baby of babies) {
      if (
        baby.untrackedTypes !== undefined ||
        baby.trackedTypes === undefined
      ) {
        skipped += 1
        continue
      }
      const accepted = baby.trackedTypes
      await ctx.db.patch(baby._id, {
        untrackedTypes: OFFERED_BEFORE_MEMORY.filter(
          (type) => !accepted.includes(type),
        ),
        trackedTypes: undefined,
      })
      migrated += 1
    }

    return { total: babies.length, migrated, skipped }
  },
})
