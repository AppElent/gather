import type { BabyEventType } from '@gather/core/domain'
import { tastingKindSpec } from '@gather/core/tastings'
import { v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'
import { query } from './_generated/server'
import { requireGroupBySlug } from './lib/groupAccess'

/**
 * What has been happening in a Group.
 *
 * Derived from the tables that already exist rather than from an events table.
 * An audit table would need a backfill, would need every mutation ever written
 * to remember to append to it, and would still read as empty on the first visit
 * for a household that has been using the app for months. Deriving costs one
 * bounded read per source and is populated the moment there is anything to
 * show. A household's volume is small; when it stops being small, this is one
 * function to replace and nothing else moves.
 *
 * ## What is in the stream, and what is not
 *
 * Four sources, and they are exactly the Group-scoped tables that record who
 * did the thing:
 *
 * - `recipes` — lives in a Group (`groupId`), attributed by `createdByUserId`.
 * - `tasks` — reached through the Group's `taskLists`, attributed by
 *   `createdBy`.
 * - `babyEvents` — reached through the Group's `babies`, attributed by
 *   `loggedBy`.
 * - `tastings` — lives in a Group (`groupId`), attributed by
 *   `createdByUserId`. **The Tasting testifies and the subject does not**
 *   (ADR-0008, #199 story 28): creating a cheese produces no entry of its own,
 *   because one act of logging must produce one line.
 *
 * Deliberately absent:
 *
 * - `consumptionEntries` — a food diary is **Personal** (ADR-0003). It is a
 *   record *about a person*, follows them across every Group and belongs to no
 *   Group's activity. Making it one would mean a diary entry showed up in a
 *   Group's stream, which is precisely the thing a Personal record is defined
 *   not to do.
 * - `foods` — **Catalog** (ADR-0003). It has no `groupId` at all: it is owned by
 *   nobody and readable by everybody, so there is no Group whose activity it
 *   could belong to.
 * - `taskLists` and `babies` — Group-scoped, but neither carries an attribution
 *   field, so "a list was added" and "a child was added" cannot say who did it.
 *   Adding a `createdBy` column to two tables for the sake of two lines in this
 *   stream is a schema change this ticket does not need; leaving them out costs
 *   two entry kinds and no correctness.
 */

interface ActivityEntryBase {
  /** The source row's id — unique across tables, so it keys the list. */
  id: string
  /** When it appeared in the Group. */
  at: number
  /**
   * Attribution: who did it (GLOSSARY.md). A display name and never a user id —
   * reading the stream must not turn into fanning out over the `users` table
   * from the client. Null when the row it named has gone.
   */
  byName: string | null
  /** Where it sits: the list a task is in, the child a log entry is about. */
  context: string | null
  /**
   * The row a link can point at, for the client to build a URL from through
   * `groupPaths.ts`. Never a path: assembling one here would put a route in a
   * string the router never type-checks. Null where the Module has no page for
   * the individual thing.
   */
  targetId: string | null
}

/**
 * What changed, by kind.
 *
 * A `title` is content in the words of the thing itself, shown as somebody typed
 * it. A log entry has no such sentence: what changed is *a temperature*, *a
 * feed*, whose name is chrome, so it carries the `eventType` and the client looks
 * the word up (ADR-0011).
 *
 * `moduleId` is there because Cheeses, Wines and Beers are three Modules over one
 * pair of tables, so `kind` cannot say which. It is an id from the catalogue both
 * clients hold (`@gather/core`), never a path.
 */
export type GroupActivityEntry = ActivityEntryBase &
  (
    | { kind: 'recipe'; title: string }
    | { kind: 'task'; title: string }
    | { kind: 'babyEvent'; eventType: BabyEventType }
    | { kind: 'tasting'; title: string; moduleId: string }
  )

/** Which Module a stream entry came out of, from the reader's point of view. */
export type ActivityKind = GroupActivityEntry['kind']

/**
 * How much of the stream is shown, and how much of it any one source may take.
 *
 * The quota exists because of the baby log: a newborn generates dozens of
 * entries a day, so a plain "newest thirty" would be thirty feeds and nappies
 * and the recipe someone added yesterday would not be in the stream at all.
 * That is not "what has been happening in this Group" — it is what has been
 * happening in one Module of it.
 *
 * So the quota decides what is *in* the stream; time alone decides the order.
 * Every source gets its first `PER_KIND_QUOTA` entries admitted before anything
 * is admitted beyond that, and whatever room is left over is filled from the
 * rest in plain reverse-chronological order. A Group with nothing but a baby
 * log still sees a full page of it — there is nothing else to show — and a
 * Group with both always sees both, with the older thing further down the page
 * where it belongs.
 */
const ACTIVITY_LIMIT = 30
const PER_KIND_QUOTA = 10

/** Newest first, with a deterministic tiebreak for rows written in the same ms. */
function byNewest(a: GroupActivityEntry, b: GroupActivityEntry): number {
  return b.at - a.at || a.id.localeCompare(b.id)
}

/**
 * Merge the sources into one stream: quota first, then top up, then order.
 *
 * Both passes walk in reverse-chronological order and the final sort restores
 * it, so an entry admitted by the top-up sits exactly where its time puts it —
 * nothing is ever promoted or demoted, only left out.
 */
export function mergeActivity(
  candidates: readonly GroupActivityEntry[],
  limit: number = ACTIVITY_LIMIT,
  quota: number = PER_KIND_QUOTA,
): GroupActivityEntry[] {
  const newestFirst = [...candidates].sort(byNewest)
  const taken: GroupActivityEntry[] = []
  const spare: GroupActivityEntry[] = []
  const used: Record<ActivityKind, number> = {
    recipe: 0,
    task: 0,
    babyEvent: 0,
    tasting: 0,
  }

  for (const entry of newestFirst) {
    if (taken.length < limit && used[entry.kind] < quota) {
      used[entry.kind] += 1
      taken.push(entry)
    } else {
      spare.push(entry)
    }
  }
  for (const entry of spare) {
    if (taken.length >= limit) break
    taken.push(entry)
  }

  return taken.sort(byNewest)
}

/**
 * Resolve every attribution in one pass.
 *
 * One `get` per distinct person rather than one per entry: thirty nappies
 * logged by the same parent is one read, not thirty.
 */
async function displayNames(
  ctx: QueryCtx,
  userIds: readonly Id<'users'>[],
): Promise<Map<string, string>> {
  const distinct = [...new Set(userIds)]
  const rows = await Promise.all(distinct.map((id) => ctx.db.get(id)))
  const names = new Map<string, string>()
  for (const row of rows) if (row) names.set(row._id, row.name)
  return names
}

/**
 * The Group's own recipes, newest first, bounded.
 *
 * `by_group` and not the visibility rule: a recipe **shared into** this Group
 * is readable here but was not added here. Its attribution is somebody from the
 * other household, who is not a Member of this one, and the moment it records
 * is the moment it appeared there. Putting it in this Group's stream would say
 * a thing happened here that did not.
 */
async function recentRecipes(ctx: QueryCtx, groupId: Id<'groups'>) {
  return await ctx.db
    .query('recipes')
    .withIndex('by_group', (q) => q.eq('groupId', groupId))
    .order('desc')
    .take(ACTIVITY_LIMIT)
}

/**
 * The Group's tasks, newest first per list, bounded per list.
 *
 * A task carries no Group of its own — it hangs off a list — so the Group is
 * read on the lists and the tasks follow from them, exactly as `tasks.ts`
 * does it. Only local lists have rows here; an external list's items live in
 * Notion or Todoist and were never written by anyone in this app, so there is
 * no attribution for them and nothing to put in the stream.
 */
async function recentTasks(ctx: QueryCtx, groupId: Id<'groups'>) {
  const lists = await ctx.db
    .query('taskLists')
    .withIndex('by_group', (q) => q.eq('groupId', groupId))
    .collect()
  const perList = await Promise.all(
    lists.map(async (list) => ({
      list,
      tasks: await ctx.db
        .query('tasks')
        .withIndex('by_list', (q) => q.eq('listId', list._id))
        .order('desc')
        .take(ACTIVITY_LIMIT),
    })),
  )
  return perList
}

/** The Group's children's log entries, newest first per child, bounded per child. */
async function recentBabyEvents(ctx: QueryCtx, groupId: Id<'groups'>) {
  const babies = await ctx.db
    .query('babies')
    .withIndex('by_group', (q) => q.eq('groupId', groupId))
    .collect()
  return await Promise.all(
    babies.map(async (baby) => ({
      baby,
      events: await ctx.db
        .query('babyEvents')
        .withIndex('by_baby', (q) => q.eq('babyId', baby._id))
        .order('desc')
        .take(ACTIVITY_LIMIT),
    })),
  )
}

/**
 * The Group's Tastings, newest first, bounded.
 *
 * Ordered and dated by `_creationTime` rather than by `tastedAt`: the stream
 * answers "what has been happening", and somebody writing up Saturday's dinner
 * on Monday happened on Monday. The day it was *tasted* is on the Tasting and
 * is what the subject's own page orders by.
 */
async function recentTastings(ctx: QueryCtx, groupId: Id<'groups'>) {
  const tastings = await ctx.db
    .query('tastings')
    .withIndex('by_group', (q) => q.eq('groupId', groupId))
    .order('desc')
    .take(ACTIVITY_LIMIT)
  // One read per distinct subject, not per Tasting: a wine club rating the
  // same bottle four times is one read.
  const subjects = new Map<string, Doc<'tastingSubjects'>>()
  for (const id of new Set(tastings.map((t) => t.subjectId))) {
    const subject = await ctx.db.get(id)
    if (subject) subjects.set(subject._id, subject)
  }
  return { tastings, subjects }
}

/**
 * One ordered stream of what has happened in the Group the URL names.
 *
 * Authorised through `requireGroupBySlug` like every other Group-scoped query:
 * the Group arrives with the request and everything below reads from that one
 * `groupId`, so a Member of two Groups gets each Group's own stream at each
 * Group's own address, and never a union of the two.
 *
 * A single list rather than a panel per Module, on purpose: it is the surface a
 * composer is added to later, and a set of independent panels would have to be
 * taken apart first.
 */
export const forGroup = query({
  args: { groupSlug: v.string() },
  handler: async (ctx, args): Promise<GroupActivityEntry[]> => {
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)

    const [recipes, taskLists, babies, tastings] = await Promise.all([
      recentRecipes(ctx, group._id),
      recentTasks(ctx, group._id),
      recentBabyEvents(ctx, group._id),
      recentTastings(ctx, group._id),
    ])

    const actorIds: Id<'users'>[] = [
      ...recipes.map((r) => r.createdByUserId),
      ...taskLists.flatMap(({ tasks }) => tasks.map((t) => t.createdBy)),
      ...babies.flatMap(({ events }) => events.map((e) => e.loggedBy)),
      ...tastings.tastings.map((t) => t.createdByUserId),
    ]
    const names = await displayNames(ctx, actorIds)
    const nameOf = (id: Id<'users'>) => names.get(id) ?? null

    const candidates: GroupActivityEntry[] = [
      ...recipes.map(
        (recipe: Doc<'recipes'>): GroupActivityEntry => ({
          id: recipe._id,
          kind: 'recipe',
          at: recipe._creationTime,
          byName: nameOf(recipe.createdByUserId),
          title: recipe.title,
          context: null,
          targetId: recipe._id,
        }),
      ),
      ...taskLists.flatMap(({ list, tasks }) =>
        tasks.map(
          (task): GroupActivityEntry => ({
            id: task._id,
            kind: 'task',
            at: task._creationTime,
            byName: nameOf(task.createdBy),
            title: task.title,
            context: list.name,
            // Tasks has a page per Group and none per task, so the entry links
            // to the Module rather than pretending an address exists.
            targetId: null,
          }),
        ),
      ),
      ...babies.flatMap(({ baby, events }) =>
        events.map(
          (event): GroupActivityEntry => ({
            id: event._id,
            kind: 'babyEvent',
            at: event._creationTime,
            byName: nameOf(event.loggedBy),
            eventType: event.type,
            context: baby.name,
            targetId: baby._id,
          }),
        ),
      ),
      ...tastings.tastings.flatMap((tasting): GroupActivityEntry[] => {
        const subject = tastings.subjects.get(tasting.subjectId)
        // A Tasting whose subject has gone was deleted with it in the same
        // transaction, so this only fires on a read racing that delete.
        if (!subject) return []
        return [
          {
            id: tasting._id,
            kind: 'tasting',
            at: tasting._creationTime,
            byName: nameOf(tasting.createdByUserId),
            // The subject's name — content, shown as somebody typed it, and
            // never translated (story 30). Which Kind of thing it was is the
            // `context` below, and that one *is* a key.
            title: subject.name,
            moduleId: tastingKindSpec(subject.kind).moduleId,
            // Nothing hangs off the sentence: the Module's own name already
            // says it was a cheese, and repeating it would read as a place.
            context: null,
            targetId: subject._id,
          },
        ]
      }),
    ]

    return mergeActivity(candidates)
  },
})
