import { todayIn } from '@gather/core/civil-date'
import { z } from 'zod'
import { api } from '../../../../convex/_generated/api'
import { MCP_SCOPES } from '../auth'
import type {
  AgendaEvent,
  RecipeCardResult,
  TaskListResult,
  WeekAgendaResult,
} from '../views/types'
import { calendarsOf, type Event, eventsOf } from './calendar'
import {
  asId,
  defineTool,
  GROUP_NOT_FOUND,
  myGroups,
  type ToolContext,
  ToolInputError,
} from './define'
import { clockOf, day, groupId } from './shared'

/** The most events one week view reads; list_events reads the rest. */
const WEEK_EVENTS = 300

function shiftDay(date: string, days: number) {
  const ms = Date.parse(`${date}T00:00:00Z`) + days * 86_400_000
  return new Date(ms).toISOString().slice(0, 10)
}

/** The Monday on or before a day. */
export function mondayOf(date: string) {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay()
  return shiftDay(date, -((weekday + 6) % 7))
}

function webUrl(value: string | undefined) {
  if (!value) return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? url.href
      : undefined
  } catch {
    return undefined
  }
}

/** The Group's slug and name for an id the caller is a Member of. */
async function groupOf(context: ToolContext, groupId: string) {
  const group = (await myGroups(context)).find((g) => g._id === groupId)
  if (!group) throw new ToolInputError(GROUP_NOT_FOUND)
  return group
}

function agendaEvent(event: Event): AgendaEvent {
  return {
    id: event._id,
    calendar: event.calendarName,
    title: event.title,
    date: event.date,
    allDay: event.allDay,
    start: event.allDay ? undefined : clockOf(event.startMinutes),
    end: event.allDay ? undefined : clockOf(event.endMinutes),
    location: event.location || undefined,
  }
}

export const viewTools = [
  defineTool({
    name: 'show_week_agenda',
    title: 'Show week agenda',
    description:
      "Show a Group's calendar for one Monday-to-Sunday week as an interactive agenda the user can page through. Defaults to the current week.",
    access: 'read',
    view: 'week-agenda',
    input: {
      groupId,
      weekStart: day
        .optional()
        .describe('Any day in the week to show, YYYY-MM-DD; this week if left out'),
    },
    async run({ groupId, weekStart }, context): Promise<WeekAgendaResult> {
      const group = await groupOf(context, groupId)
      const today = todayIn(group.timeZone ?? 'UTC', context.now())
      const monday = mondayOf(weekStart ?? today)
      const sunday = shiftDay(monday, 7)
      const events: Event[] = []
      for (const calendar of await calendarsOf(context, group.slug)) {
        const room = WEEK_EVENTS - events.length
        if (room <= 0) break
        events.push(
          ...(await eventsOf(context, group.slug, calendar._id, monday, sunday, room)),
        )
      }
      const days = Array.from({ length: 7 }, (_, index) => {
        const date = shiftDay(monday, index)
        return {
          date,
          events: events
            .filter((event) => event.date === date)
            .sort(
              (a, b) =>
                Number(!a.allDay) - Number(!b.allDay) ||
                (a.startMinutes ?? 0) - (b.startMinutes ?? 0),
            )
            .map(agendaEvent),
        }
      })
      return {
        view: 'week-agenda',
        groupId,
        groupName: group.name,
        weekStart: monday,
        previousWeekStart: shiftDay(monday, -7),
        nextWeekStart: sunday,
        isCurrentWeek: mondayOf(today) === monday,
        today,
        timeZone: group.timeZone,
        days,
        truncated: events.length >= WEEK_EVENTS,
      }
    },
  }),
  defineTool({
    name: 'show_task_list',
    title: 'Show task list',
    description:
      'Show one task list as an interactive checklist. With write access the user can check tasks off and add tasks in the view.',
    access: 'read',
    view: 'task-list',
    input: { groupId, listId: z.string().min(1) },
    async run({ groupId, listId }, context): Promise<TaskListResult> {
      const group = await groupOf(context, groupId)
      const lists = await context.backend.query(api.taskLists.list, {
        groupSlug: group.slug,
      })
      const list = lists.find((l) => l._id === listId)
      if (!list) throw new ToolInputError('Task list not found.')
      const tasks = list.writable
        ? await context.backend.query(api.tasks.listByList, {
            groupSlug: group.slug,
            listId: asId<'taskLists'>(listId),
          })
        : []
      const scoped = context.access.scopes.has(MCP_SCOPES.write)
      return {
        view: 'task-list',
        groupId,
        groupName: group.name,
        listId,
        listName: list.name,
        canWrite: scoped && list.writable,
        readOnlyReason: !list.writable
          ? 'external'
          : !scoped
            ? 'scope'
            : undefined,
        tasks: tasks.map((t) => ({
          id: t._id,
          title: t.title,
          done: t.done,
          dueDate: t.dueDate,
          priority: t.priority,
          labels: t.labels,
        })),
      }
    },
  }),
  defineTool({
    name: 'show_recipe',
    title: 'Show recipe',
    description:
      'Show one recipe as a card with its photo, ingredients and steps; the user can scale the ingredients to a number of servings.',
    access: 'read',
    view: 'recipe-card',
    input: { groupId, recipeId: z.string().min(1) },
    async run({ groupId, recipeId }, context): Promise<RecipeCardResult> {
      const group = await groupOf(context, groupId)
      const recipe = await context.backend.query(api.recipes.get, {
        groupSlug: group.slug,
        id: asId<'recipes'>(recipeId),
      })
      if (!recipe) throw new ToolInputError('Recipe not found.')
      return {
        view: 'recipe-card',
        groupId,
        groupName: group.name,
        recipe: {
          id: recipe._id,
          title: recipe.title,
          description: recipe.description || undefined,
          imageUrl: recipe.imageUrl ?? undefined,
          ingredients: recipe.ingredients,
          steps: recipe.steps,
          tags: recipe.tags,
          servings: recipe.servings,
          prepMinutes: recipe.prepMinutes,
          rating: recipe.rating,
          // Only a web link reaches the view; the app stores any string.
          sourceUrl: webUrl(recipe.sourceUrl),
          sharedFrom:
            recipe.homeGroupSlug && recipe.homeGroupSlug !== group.slug
              ? (recipe.homeGroupName ?? undefined)
              : undefined,
        },
      }
    },
  }),
]
