import {
  isValidTastingRating,
  type TastingKind,
  tastingAverage,
  tastingKindSpec,
} from '@gather/core/tastings'
import { ConvexError, v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { mutation, query } from './_generated/server'
import { requireGroupBySlug } from './lib/groupAccess'
import { getCurrentUser } from './lib/sharing'
import { deleteStoredFile, replaceStoredFile } from './lib/storedFiles'
import {
  checkedAttributes,
  tastingAttributesValidator,
  tastingKindValidator,
} from './lib/tastings'

/**
 * The three tasting Modules, over one backend (#199, ADR-0024).
 *
 * Every function here is Group-scoped and authorises through
 * `requireGroupBySlug` — the Group arrives with the request (ADR-0002 on the
 * web, ambient and passed explicitly on the phone under ADR-0015), so a
 * Member of two Groups gets each Group's own cheeses and never a union.
 *
 * ## The Kind is an argument, and the route decides it
 *
 * A subject is only ever read through the Kind that owns it: `listByKind`
 * takes one, and `getSubject` refuses a subject whose Kind is not the one
 * asked for. That is what stops `/wines` showing a cheese, and it is checked
 * here rather than trusted from the client because a deep link is a claim.
 *
 * ## Averages are computed on read
 *
 * A subject has a handful of Tastings. A stored average would be a cache that
 * every edit and every delete invalidates, and getting that wrong shows the
 * household a number nobody voted for.
 */

// ---------------------------------------------------------------------------
// Shapes the client reads
// ---------------------------------------------------------------------------

export interface TastingSubjectSummary {
  _id: Id<'tastingSubjects'>
  kind: TastingKind
  name: string
  attributes: Doc<'tastingSubjects'>['attributes']
  catalogKey?: string
  photoUrl: string | null
  /** Null until somebody has tasted it. Never shown without `count`. */
  average: number | null
  count: number
}

export interface TastingEntry {
  _id: Id<'tastings'>
  rating: number
  tastedAt: string
  attributes: Doc<'tastings'>['attributes']
  /** Attribution: a name, never a user id, so a list is not a fan-out. */
  byName: string | null
  /** Whether the reader wrote it — which is what gates Edit (story 18). */
  mine: boolean
  createdByUserId: Id<'users'>
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

async function tastingsOf(ctx: QueryCtx, subjectId: Id<'tastingSubjects'>) {
  return await ctx.db
    .query('tastings')
    .withIndex('by_subject', (q) => q.eq('subjectId', subjectId))
    .collect()
}

async function summarize(
  ctx: QueryCtx,
  subject: Doc<'tastingSubjects'>,
): Promise<TastingSubjectSummary> {
  const rows = await tastingsOf(ctx, subject._id)
  const summary = tastingAverage(rows.map((row) => row.rating))
  return {
    _id: subject._id,
    kind: subject.kind,
    name: subject.name,
    attributes: subject.attributes,
    catalogKey: subject.catalogKey,
    photoUrl: subject.photoId
      ? await ctx.storage.getUrl(subject.photoId)
      : null,
    average: summary?.average ?? null,
    count: summary?.count ?? 0,
  }
}

/**
 * One Module's index: everything this Group has tasted of one Kind.
 *
 * Ordered by name, because the index is a library rather than a feed — the
 * feed is the Group's activity, and it already exists. A subject with no
 * Tastings comes back with `average: null`; the client draws no score rather
 * than a zero.
 */
export const listByKind = query({
  args: { groupSlug: v.string(), kind: tastingKindValidator },
  handler: async (ctx, args): Promise<TastingSubjectSummary[]> => {
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    const subjects = await ctx.db
      .query('tastingSubjects')
      .withIndex('by_group_kind', (q) =>
        q.eq('groupId', group._id).eq('kind', args.kind),
      )
      .collect()
    const summaries = await Promise.all(
      subjects.map((subject) => summarize(ctx, subject)),
    )
    return summaries.sort((a, b) => a.name.localeCompare(b.name))
  },
})

/**
 * The shipped suggestions for one Kind.
 *
 * Public, signed-in-only and deliberately not Group-scoped: the catalog is the
 * same list for everybody, exactly like the foods Catalog, and unlike it these
 * rows are copied rather than referenced (ADR-0024). Wine and beer answer with
 * an empty list, which the picker draws as no section at all rather than as an
 * empty one.
 *
 * Deliberately uncached. A client cache can be added later without moving the
 * data; ADR-0024 records the one condition that would revisit it.
 */
export const catalogByKind = query({
  args: { kind: tastingKindValidator },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) return []
    if (!tastingKindSpec(args.kind).catalog) return []
    const rows = await ctx.db
      .query('tastingCatalog')
      .withIndex('by_kind', (q) => q.eq('kind', args.kind))
      .collect()
    return rows
      .map((row) => ({
        seedKey: row.seedKey,
        name: row.name,
        attributes: row.attributes,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  },
})

/**
 * Resolve a subject through the Group and the Kind the caller claims.
 *
 * Both claims are checked, and a wrong one answers exactly as a missing
 * subject does: "not found" for a subject in another Group, for a cheese asked
 * for as a wine, and for a Group the caller is not in — the Group's single
 * undifferentiated refusal (ADR-0009).
 */
async function findSubject(
  ctx: QueryCtx,
  groupSlug: string,
  id: Id<'tastingSubjects'>,
  kind?: TastingKind,
) {
  const { group, user } = await requireGroupBySlug(ctx, groupSlug)
  const subject = await ctx.db.get(id)
  if (!subject || subject.groupId !== group._id) return null
  if (kind && subject.kind !== kind) return null
  return { subject, group, user }
}

/** One subject's page: its facts, its photo, and the household's history. */
export const getSubject = query({
  args: {
    groupSlug: v.string(),
    id: v.id('tastingSubjects'),
    kind: v.optional(tastingKindValidator),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    subject: TastingSubjectSummary
    tastings: TastingEntry[]
  } | null> => {
    const found = await findSubject(ctx, args.groupSlug, args.id, args.kind)
    if (!found) return null
    const { subject, user } = found

    const rows = await tastingsOf(ctx, subject._id)
    // One read per distinct person, not per Tasting — the same rule the
    // activity stream follows, for the same reason.
    const names = new Map<string, string>()
    for (const id of new Set(rows.map((row) => row.createdByUserId))) {
      const author = await ctx.db.get(id)
      if (author) names.set(author._id, author.name)
    }

    return {
      subject: await summarize(ctx, subject),
      tastings: rows
        // Newest first, and by the day it was tasted rather than the day it
        // was typed up: a tasting logged on Monday for Saturday belongs where
        // Saturday is (story 12).
        .sort(
          (a, b) =>
            b.tastedAt.localeCompare(a.tastedAt) ||
            b._creationTime - a._creationTime,
        )
        .map((row) => ({
          _id: row._id,
          rating: row.rating,
          tastedAt: row.tastedAt,
          attributes: row.attributes,
          byName: names.get(row.createdByUserId) ?? null,
          mine: row.createdByUserId === user._id,
          createdByUserId: row.createdByUserId,
        })),
    }
  },
})

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new ConvexError('Not authenticated')
    return await ctx.storage.generateUploadUrl()
  },
})

/** `YYYY-MM-DD`, and nothing else. A date is not a moment (story 12). */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function checkedRating(rating: number): number {
  // A key rather than a sentence: the form resolves it (ADR-0011).
  if (!isValidTastingRating(rating)) throw new ConvexError('needsScore')
  return rating
}

function checkedDate(tastedAt: string): string {
  if (!ISO_DATE.test(tastedAt)) throw new ConvexError('Invalid date')
  return tastedAt
}

function checkedName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) throw new ConvexError('needsName')
  return trimmed
}

/**
 * Which thing was tasted.
 *
 * Either one the Group already has, or one that comes into being now — from
 * the catalog, or typed. The last two are the same branch on purpose: choosing
 * a catalog entry only *prefills* the composer, so what arrives here is a name
 * and a set of facts either way, and `catalogKey` is Provenance riding along
 * (ADR-0024).
 */
const subjectRefValidator = v.union(
  v.object({ subjectId: v.id('tastingSubjects') }),
  v.object({
    name: v.string(),
    attributes: v.optional(tastingAttributesValidator),
    catalogKey: v.optional(v.string()),
  }),
)

/**
 * Resolve — or create — the subject a Tasting is about.
 *
 * Materialising a catalog entry is **idempotent on `(groupId, kind,
 * catalogKey)`**: tasting the catalog's Gouda twice gives one Gouda and two
 * Tastings. Nothing else is deduplicated, and that is the decision rather than
 * an omission: two Barolos from two producers are two subjects, so a name that
 * matches an existing one is a *warning in the picker* and never a refusal
 * here (story 5).
 */
async function resolveSubject(
  ctx: MutationCtx,
  groupId: Id<'groups'>,
  userId: Id<'users'>,
  kind: TastingKind,
  ref:
    | { subjectId: Id<'tastingSubjects'> }
    | {
        name: string
        attributes?: Record<string, unknown>
        catalogKey?: string
      },
): Promise<Id<'tastingSubjects'>> {
  if ('subjectId' in ref) {
    const subject = await ctx.db.get(ref.subjectId)
    if (!subject || subject.groupId !== groupId || subject.kind !== kind) {
      throw new ConvexError('Subject not found')
    }
    return subject._id
  }

  if (ref.catalogKey) {
    const existing = await ctx.db
      .query('tastingSubjects')
      .withIndex('by_group_kind_catalogKey', (q) =>
        q
          .eq('groupId', groupId)
          .eq('kind', kind)
          .eq('catalogKey', ref.catalogKey),
      )
      .first()
    // The facts are deliberately *not* refreshed from the payload: the Group's
    // copy is the Group's, and somebody who corrected its vintage last month
    // must not have that undone by the next person choosing the same entry.
    if (existing) return existing._id

    const entry = await ctx.db
      .query('tastingCatalog')
      .withIndex('by_seedKey', (q) => q.eq('seedKey', ref.catalogKey as string))
      .unique()
    if (!entry || entry.kind !== kind) {
      throw new ConvexError('Unknown catalog entry')
    }
  }

  return await ctx.db.insert('tastingSubjects', {
    groupId,
    kind,
    name: checkedName(ref.name),
    attributes: checkedAttributes(kind, 'subject', ref.attributes),
    catalogKey: ref.catalogKey,
    createdByUserId: userId,
  })
}

/**
 * Log a Tasting — the one act this Module is for.
 *
 * The subject and the Tasting are written in one mutation because a Convex
 * mutation is a transaction: a subject that comes into being for a Tasting
 * that then fails validation is a name in a list nobody ever tasted, and there
 * is no order of client calls that could prevent it.
 *
 * Creating the subject produces **no activity entry** (story 28) — the Tasting
 * testifies (ADR-0008), and one act of logging is one line.
 */
export const logTasting = mutation({
  args: {
    groupSlug: v.string(),
    kind: tastingKindValidator,
    subject: subjectRefValidator,
    rating: v.number(),
    tastedAt: v.string(),
    attributes: v.optional(tastingAttributesValidator),
  },
  handler: async (ctx, args) => {
    const { group, user } = await requireGroupBySlug(ctx, args.groupSlug)
    const rating = checkedRating(args.rating)
    const tastedAt = checkedDate(args.tastedAt)
    const attributes = checkedAttributes(args.kind, 'tasting', args.attributes)

    const subjectId = await resolveSubject(
      ctx,
      group._id,
      user._id,
      args.kind,
      args.subject,
    )

    const tastingId = await ctx.db.insert('tastings', {
      subjectId,
      groupId: group._id,
      rating,
      tastedAt,
      attributes,
      createdByUserId: user._id,
    })

    return { subjectId, tastingId }
  },
})

/**
 * Correct your own Tasting.
 *
 * Only the author, and that is the one place in gather where Attribution
 * decides a permission: a mis-tapped score is fixable (story 17), and nothing
 * appears under your name that you did not say (story 18).
 */
export const updateTasting = mutation({
  args: {
    groupSlug: v.string(),
    id: v.id('tastings'),
    rating: v.number(),
    tastedAt: v.string(),
    attributes: v.optional(tastingAttributesValidator),
  },
  handler: async (ctx, args) => {
    const { group, user } = await requireGroupBySlug(ctx, args.groupSlug)
    const tasting = await ctx.db.get(args.id)
    // One answer for "no such tasting" and "another Group's" (ADR-0009).
    if (!tasting || tasting.groupId !== group._id) {
      throw new ConvexError('Tasting not found')
    }
    // A separate, *differentiated* refusal, on purpose: the reader can see the
    // row and is being told the rule, not being kept from knowing it exists.
    if (tasting.createdByUserId !== user._id) {
      throw new ConvexError('notYourTasting')
    }
    const subject = await ctx.db.get(tasting.subjectId)
    if (!subject) throw new ConvexError('Tasting not found')

    await ctx.db.patch(args.id, {
      rating: checkedRating(args.rating),
      tastedAt: checkedDate(args.tastedAt),
      attributes: checkedAttributes(subject.kind, 'tasting', args.attributes),
    })
  },
})

/**
 * Delete a Tasting — anybody in the Group may (story 19).
 *
 * The asymmetry with `updateTasting` is deliberate and is the whole permission
 * rule: editing another Member's score puts words in their mouth; removing a
 * test entry or a duplicate is ordinary tidying by whoever notices it.
 *
 * The subject is left standing even when its last Tasting goes. It is still a
 * thing the household has, with facts and a photo, and deleting it silently
 * here would make "tidy a duplicate" occasionally mean "lose the cheese".
 */
export const removeTasting = mutation({
  args: { groupSlug: v.string(), id: v.id('tastings') },
  handler: async (ctx, args) => {
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    const tasting = await ctx.db.get(args.id)
    if (!tasting || tasting.groupId !== group._id) {
      throw new ConvexError('Tasting not found')
    }
    await ctx.db.delete(args.id)
  },
})

/**
 * Correct a subject's facts, including one that came from the catalog
 * (story 21).
 *
 * Editable by any Member: the subject is the household's, not the author's.
 * `catalogKey` is never touched — it is Provenance, and a corrected vintage
 * does not make this a different entry.
 */
export const updateSubject = mutation({
  args: {
    groupSlug: v.string(),
    id: v.id('tastingSubjects'),
    name: v.string(),
    attributes: v.optional(tastingAttributesValidator),
    /** Absent leaves the photo alone; `null` takes it off. */
    photoId: v.optional(v.union(v.id('_storage'), v.null())),
  },
  handler: async (ctx, args) => {
    const found = await findSubject(ctx, args.groupSlug, args.id)
    if (!found) throw new ConvexError('Subject not found')
    const { subject } = found
    const { photoId } = args

    await ctx.db.patch(args.id, {
      name: checkedName(args.name),
      attributes: checkedAttributes(subject.kind, 'subject', args.attributes),
      ...(photoId !== undefined ? { photoId: photoId ?? undefined } : {}),
    })
    // Behind the access check, and after the row has let go of the old blob.
    await replaceStoredFile(ctx, subject.photoId, photoId)
  },
})

/**
 * Delete a subject, and everything anybody ever thought about it.
 *
 * A Tasting without a subject has no identity — it is a score attached to
 * nothing — so this cascades rather than orphaning. The client confirms first
 * with the count in the sentence (story 22), reading it off the `count` the
 * page is already showing, and this returns what actually went so a caller
 * that raced somebody else's delete is not left asserting a stale number.
 */
export const removeSubject = mutation({
  args: { groupSlug: v.string(), id: v.id('tastingSubjects') },
  handler: async (ctx, args) => {
    const found = await findSubject(ctx, args.groupSlug, args.id)
    if (!found) throw new ConvexError('Subject not found')
    const { subject } = found

    const rows = await tastingsOf(ctx, subject._id)
    for (const row of rows) await ctx.db.delete(row._id)
    await ctx.db.delete(subject._id)
    // After the row is gone, so the subject being deleted is not itself found
    // still holding its photo.
    await deleteStoredFile(ctx, subject.photoId)

    return { deletedTastings: rows.length }
  },
})
