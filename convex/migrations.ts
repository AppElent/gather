/**
 * One-shot data migrations. Each one says here what would retire it, and the
 * document it names in `docs/migrations/` is what records that it has.
 *
 * Nothing in this file is called by the app. They are `internalMutation`s run
 * by hand — `npx convex run migrations:<name> --prod` — so that a migration
 * cannot be triggered by a request, and so that running one is a decision
 * somebody made rather than a side effect of a deploy.
 */

import type { BabyEventType } from '@gather/core/domain'
import { getDocumentSize, v } from 'convex/values'
import { internalMutation } from './_generated/server'
import { noteSearchText } from './lib/noteSearch'

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

const NOTE_BATCH = 100
/** Read per call at most; every note read may be written back with its text. */
const NOTE_BATCH_BYTES = 4 * 1024 * 1024
/** A document holds 1 MiB; a little less, so a note is never refused. */
const NOTE_DOCUMENT_BYTES = 1024 * 1024 - 1024

/**
 * Gives every note its `searchText` (APP-701), which note writes have set since
 * the same deploy.
 *
 * Idempotent: a note whose `searchText` is right is left alone, and nothing
 * else on a note changes (not `updatedAt`, so no note moves). One bounded page
 * per call. Dry unless `{ apply: true }`: run it passing `cursor` until `more`
 * is false, then a dry run from the start where every page reports `missing`
 * zero.
 *
 * A note too long to hold its text twice cannot be filled (APP-805). It is left
 * alone, logged by id and answered in `unfillable`, and the rest of the page is
 * filled. `missing` does not count it. Shortening it in the app fills it.
 *
 * **Retire this**, and its test, with the narrow step of APP-701 (its data
 * model, step 4): `searchText` becomes required and `search_title`,
 * `search_body` and their fallback in `lib/noteSearch.ts` go, once
 * `docs/migrations/README.md` records that it has run on dev and on production.
 */
export const backfillNoteSearchText = internalMutation({
  args: {
    apply: v.optional(v.boolean()),
    cursor: v.optional(v.union(v.string(), v.null())),
    // Rows per call, at most the default; tests use a small one to page.
    batch: v.optional(v.number()),
  },
  returns: v.object({
    apply: v.boolean(),
    scanned: v.number(),
    missing: v.number(),
    unfillable: v.array(v.id('notes')),
    more: v.boolean(),
    cursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const apply = args.apply ?? false
    const page = await ctx.db.query('notes').paginate({
      numItems: Math.max(
        1,
        Math.min(NOTE_BATCH, Math.floor(args.batch ?? NOTE_BATCH)),
      ),
      cursor: args.cursor ?? null,
      maximumBytesRead: NOTE_BATCH_BYTES,
    })
    const unfilled = page.page.filter(
      (note) => note.searchText !== noteSearchText(note),
    )
    const fits = (note: (typeof unfilled)[number]) =>
      getDocumentSize({ ...note, searchText: noteSearchText(note) }) <=
      NOTE_DOCUMENT_BYTES
    const missing = unfilled.filter(fits)
    const unfillable = unfilled
      .filter((note) => !fits(note))
      .map((note) => note._id)
    for (const id of unfillable)
      console.error(`backfillNoteSearchText: note ${id} is too long to fill`)
    if (apply)
      for (const note of missing)
        await ctx.db.patch(note._id, { searchText: noteSearchText(note) })
    return {
      apply,
      scanned: page.page.length,
      missing: missing.length,
      unfillable,
      more: !page.isDone,
      cursor: page.continueCursor,
    }
  },
})
