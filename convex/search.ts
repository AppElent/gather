import { type Infer, v } from 'convex/values'

import { query } from './_generated/server'
import { isVisibleToGroups, requireGroupBySlug } from './lib/groupAccess'
import { tastingKindValidator } from './lib/tastings'

const RESULT_LIMIT = 30
const GROUP_RECORD_LIMIT = 200
/**
 * At most this many recipes Shared into the Group are searched. They come out
 * of the recipe budget rather than on top of it (the Group's own recipes get
 * what the shares leave), so this query never reads more recipe documents
 * than it did before shares were searched. Rows, not bytes, are what the
 * budgets bound, and a recipe or note can be large.
 */
const SHARED_RECIPE_LIMIT = 50
const PARENT_LIMIT = 20
const CHILD_RECORD_LIMIT = 50

const resultTypeValidator = v.union(
  v.literal('recipe'),
  v.literal('task'),
  v.literal('note'),
  v.literal('tasting'),
  v.literal('calendarEvent'),
  v.literal('loyaltyCard'),
)

type ResultType = Infer<typeof resultTypeValidator>

/**
 * What a caller that names no `accepts` gets: the types the first phone
 * releases can open. An installed app routes an unknown type to the calendar
 * event screen, so a type added later reaches only the clients that ask for it.
 */
const ORIGINAL_TYPES: readonly ResultType[] = [
  'recipe',
  'task',
  'note',
  'tasting',
  'calendarEvent',
]

const resultValidator = v.object({
  id: v.string(),
  type: resultTypeValidator,
  title: v.string(),
  tags: v.array(v.string()),
  excerpt: v.string(),
  listName: v.optional(v.string()),
  dueDate: v.optional(v.string()),
  kind: v.optional(v.string()),
  calendarName: v.optional(v.string()),
  date: v.optional(v.string()),
  startMinutes: v.optional(v.number()),
  endMinutes: v.optional(v.number()),
  /** A task's state, for the phone's Status filter (APP-613). */
  done: v.optional(v.boolean()),
  /**
   * The Member who added the record, for the phone's Who filter (APP-613).
   * Optional so a row from before a type recorded it still validates.
   */
  createdBy: v.optional(v.string()),
  creationTime: v.number(),
})

type SearchResult = Infer<typeof resultValidator> & { rank: number }

function normalized(value: string) {
  return value.trim().toLocaleLowerCase()
}

function matchRank(title: string, supportingText: string[], needle: string) {
  const primary = normalized(title)
  if (primary === needle) return 0
  if (primary.startsWith(needle)) return 1
  if (primary.includes(needle)) return 2
  return supportingText.some((value) => normalized(value).includes(needle))
    ? 3
    : null
}

function matched(
  result: Omit<SearchResult, 'rank'>,
  supportingText: string[],
  needle: string,
): SearchResult | null {
  const rank = matchRank(result.title, supportingText, needle)
  return rank === null ? null : { ...result, rank }
}

/**
 * The first, deliberately curated Group search. It normalizes all selected
 * records in one authorization-aware query so the phone never combines module
 * lists or learns about data it could not otherwise read.
 *
 * The fan-out is globally bounded below Convex's read limit. That is a safety
 * boundary for this pre-indexed first release, not pagination; promote it to a
 * maintained full-text projection when real Group volumes require it.
 */
export const group = query({
  args: {
    groupSlug: v.string(),
    query: v.string(),
    /** The result types this client can open; absent means the original five. */
    accepts: v.optional(v.array(resultTypeValidator)),
    /**
     * One tasting Kind, when the search is narrowed to that tasting Module
     * (APP-613): Wines reads wines, so beers and cheeses cannot crowd it out.
     */
    kind: v.optional(tastingKindValidator),
  },
  returns: v.array(resultValidator),
  handler: async (ctx, args) => {
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    const needle = normalized(args.query)
    if (needle.length < 2) return []
    const accepts = new Set<ResultType>(args.accepts ?? ORIGINAL_TYPES)

    // Only the tables a type the caller asked for lives in are read, newest
    // first, so the bound drops the oldest records rather than the newest.
    const groupId = group._id
    const none = Promise.resolve([])

    // Share rows are small; read first so the Group's own recipes can take
    // whatever of the recipe budget the shares leave.
    const shares = accepts.has('recipe')
      ? await ctx.db
          .query('recipeShares')
          .withIndex('by_group', (q) => q.eq('groupId', groupId))
          .order('desc')
          .take(SHARED_RECIPE_LIMIT)
      : []
    const sharedIds = [...new Set(shares.map((share) => share.recipeId))]

    const [recipes, notes, subjects, calendars, taskLists, loyaltyCards] =
      await Promise.all([
        accepts.has('recipe')
          ? ctx.db
              .query('recipes')
              .withIndex('by_group', (q) => q.eq('groupId', groupId))
              .order('desc')
              .take(GROUP_RECORD_LIMIT - sharedIds.length)
          : none,
        accepts.has('note')
          ? ctx.db
              .query('notes')
              .withIndex('by_group', (q) => q.eq('groupId', groupId))
              .order('desc')
              .take(GROUP_RECORD_LIMIT)
          : none,
        accepts.has('tasting')
          ? args.kind
            ? ctx.db
                .query('tastingSubjects')
                .withIndex('by_group_kind', (q) =>
                  q.eq('groupId', groupId).eq('kind', args.kind!),
                )
                .order('desc')
                .take(GROUP_RECORD_LIMIT)
            : ctx.db
                .query('tastingSubjects')
                .withIndex('by_group', (q) => q.eq('groupId', groupId))
                .order('desc')
                .take(GROUP_RECORD_LIMIT)
          : none,
        accepts.has('calendarEvent')
          ? ctx.db
              .query('calendars')
              .withIndex('by_group', (q) => q.eq('groupId', groupId))
              .take(PARENT_LIMIT)
          : none,
        accepts.has('task')
          ? ctx.db
              .query('taskLists')
              .withIndex('by_group', (q) => q.eq('groupId', groupId))
              .take(PARENT_LIMIT)
          : none,
        accepts.has('loyaltyCard')
          ? ctx.db
              .query('loyaltyCards')
              .withIndex('by_group', (q) => q.eq('groupId', groupId))
              .order('desc')
              .take(GROUP_RECORD_LIMIT)
          : none,
      ])

    // Recipes Shared into the Group are in its collection too
    // (`lib/recipeShares.ts`). Each share row is re-checked against the recipe
    // it names, so one that lags `sharedGroupIds` never shows a recipe the
    // Group cannot see.
    const sharedIn = (await Promise.all(sharedIds.map((id) => ctx.db.get(id)))).filter(
      (recipe): recipe is NonNullable<typeof recipe> =>
        recipe !== null &&
        recipe.groupId !== groupId &&
        isVisibleToGroups(recipe, [groupId]),
    )

    const localLists = taskLists.filter((list) => list.provider === 'local')
    const [tasksByList, eventsByCalendar] = await Promise.all([
      Promise.all(
        localLists.map((list) =>
          ctx.db
            .query('tasks')
            .withIndex('by_list', (q) => q.eq('listId', list._id))
            .order('desc')
            .take(CHILD_RECORD_LIMIT)
            .then((tasks) => ({ list, tasks })),
        ),
      ),
      Promise.all(
        calendars.map((calendar) =>
          ctx.db
            .query('calendarEvents')
            .withIndex('by_calendar', (q) => q.eq('calendarId', calendar._id))
            .order('desc')
            .take(CHILD_RECORD_LIMIT)
            .then((events) => ({ calendar, events })),
        ),
      ),
    ])

    const results: SearchResult[] = [
      ...[...recipes, ...sharedIn].flatMap((recipe) => {
        const found = matched(
          {
            id: recipe._id,
            type: 'recipe',
            title: recipe.title,
            tags: recipe.tags,
            excerpt: '',
            createdBy: recipe.createdByUserId,
            creationTime: recipe._creationTime,
          },
          recipe.tags,
          needle,
        )
        return found ? [found] : []
      }),
      ...notes.flatMap((note) => {
        const found = matched(
          {
            id: note._id,
            type: 'note',
            title: note.title,
            tags: [],
            excerpt:
              note.body
                .split('\n')
                .find((line) => line.trim())
                ?.trim() ?? '',
            createdBy: note.createdBy,
            creationTime: note._creationTime,
          },
          [note.body],
          needle,
        )
        return found ? [found] : []
      }),
      ...subjects.flatMap((subject) => {
        const found = matched(
          {
            id: subject._id,
            type: 'tasting',
            title: subject.name,
            tags: [],
            excerpt: '',
            kind: subject.kind,
            createdBy: subject.createdByUserId,
            creationTime: subject._creationTime,
          },
          [],
          needle,
        )
        return found ? [found] : []
      }),
      ...tasksByList.flatMap(({ list, tasks }) =>
        tasks.flatMap((task) => {
          const found = matched(
            {
              id: task._id,
              type: 'task',
              title: task.title,
              tags: [],
              excerpt: '',
              listName: list.name,
              dueDate: task.dueDate,
              done: task.done,
              createdBy: task.createdBy,
              creationTime: task._creationTime,
            },
            [task.notes ?? '', list.name],
            needle,
          )
          return found ? [found] : []
        }),
      ),
      ...eventsByCalendar.flatMap(({ calendar, events }) =>
        events.flatMap((event) => {
          const found = matched(
            {
              id: event._id,
              type: 'calendarEvent',
              title: event.title,
              tags: [],
              excerpt: '',
              calendarName: calendar.name,
              date: event.date,
              startMinutes: event.startMinutes,
              endMinutes: event.endMinutes,
              createdBy: event.createdBy,
              creationTime: event._creationTime,
            },
            [calendar.name],
            needle,
          )
          return found ? [found] : []
        }),
      ),
      // Found by its store and by whose card it is ("Sam's Bonuskaart").
      ...loyaltyCards.flatMap((card) => {
        const found = matched(
          {
            id: card._id,
            type: 'loyaltyCard',
            title: card.storeName,
            tags: [],
            excerpt: card.holder ?? '',
            createdBy: card.createdByUserId,
            creationTime: card._creationTime,
          },
          [card.holder ?? ''],
          needle,
        )
        return found ? [found] : []
      }),
    ]

    return results
      .filter((result) => accepts.has(result.type))
      .sort(
        (a, b) =>
          a.rank - b.rank ||
          b.creationTime - a.creationTime ||
          a.title.localeCompare(b.title),
      )
      .slice(0, RESULT_LIMIT)
      .map(({ rank: _rank, ...result }) => result)
  },
})
