import { v } from 'convex/values'

import { query } from './_generated/server'
import { requireGroupBySlug } from './lib/groupAccess'

const RESULT_LIMIT = 30
const GROUP_RECORD_LIMIT = 200
const PARENT_LIMIT = 20
const CHILD_RECORD_LIMIT = 50

const resultValidator = v.object({
  id: v.string(),
  type: v.union(
    v.literal('recipe'),
    v.literal('task'),
    v.literal('note'),
    v.literal('tasting'),
    v.literal('calendarEvent'),
  ),
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
  creationTime: v.number(),
})

type SearchResult = {
  id: string
  type: 'recipe' | 'task' | 'note' | 'tasting' | 'calendarEvent'
  title: string
  tags: string[]
  excerpt: string
  listName?: string
  dueDate?: string
  kind?: string
  calendarName?: string
  date?: string
  startMinutes?: number
  endMinutes?: number
  creationTime: number
  rank: number
}

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
  args: { groupSlug: v.string(), query: v.string() },
  returns: v.array(resultValidator),
  handler: async (ctx, args) => {
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    const needle = normalized(args.query)
    if (needle.length < 2) return []

    const [recipes, notes, subjects, calendars, taskLists] = await Promise.all([
      ctx.db
        .query('recipes')
        .withIndex('by_group', (q) => q.eq('groupId', group._id))
        .take(GROUP_RECORD_LIMIT),
      ctx.db
        .query('notes')
        .withIndex('by_group', (q) => q.eq('groupId', group._id))
        .take(GROUP_RECORD_LIMIT),
      ctx.db
        .query('tastingSubjects')
        .withIndex('by_group', (q) => q.eq('groupId', group._id))
        .take(GROUP_RECORD_LIMIT),
      ctx.db
        .query('calendars')
        .withIndex('by_group', (q) => q.eq('groupId', group._id))
        .take(PARENT_LIMIT),
      ctx.db
        .query('taskLists')
        .withIndex('by_group', (q) => q.eq('groupId', group._id))
        .take(PARENT_LIMIT),
    ])

    const localLists = taskLists.filter((list) => list.provider === 'local')
    const [tasksByList, eventsByCalendar] = await Promise.all([
      Promise.all(
        localLists.map((list) =>
          ctx.db
            .query('tasks')
            .withIndex('by_list', (q) => q.eq('listId', list._id))
            .take(CHILD_RECORD_LIMIT)
            .then((tasks) => ({ list, tasks })),
        ),
      ),
      Promise.all(
        calendars.map((calendar) =>
          ctx.db
            .query('calendarEvents')
            .withIndex('by_calendar', (q) => q.eq('calendarId', calendar._id))
            .take(CHILD_RECORD_LIMIT)
            .then((events) => ({ calendar, events })),
        ),
      ),
    ])

    const results: SearchResult[] = [
      ...recipes.flatMap((recipe) => {
        const found = matched(
          {
            id: recipe._id,
            type: 'recipe',
            title: recipe.title,
            tags: recipe.tags,
            excerpt: '',
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
              creationTime: event._creationTime,
            },
            [calendar.name],
            needle,
          )
          return found ? [found] : []
        }),
      ),
    ]

    return results
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
