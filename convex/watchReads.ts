/**
 * What a paired watch reads (APP-653). Internal, one query per Module, called
 * by `lib/watchHttp.ts` with the hash of the watch's key; each resolves the key
 * and the Membership again (`lib/watchAccess.ts`).
 *
 * The watch keeps the last answer and draws it offline, so an answer holds what
 * a screen shows and no more: ids, words and numbers, no file URLs. Words of
 * the app (an aisle, a unit, a meal's slot) travel as their ids and the watch
 * says them in its own language.
 */
import {
  filterCalendarEvents,
  orderCalendarEvents,
} from '@gather/core/calendar'
import { addDays, compareIsoDates } from '@gather/core/civil-date'
import {
  aisleSections,
  checkedOncePerName,
  inCheckedSection,
  onShoppingList,
} from '@gather/core/grocery-list'
import { compareLoyaltyCards } from '@gather/core/loyalty-cards'
import { MEAL_SLOTS } from '@gather/core/meal-planner'
import { bySmartOrder, inSmartList } from '@gather/core/smart-lists'
import { v } from 'convex/values'
import type { Doc } from './_generated/dataModel'
import { internalQuery, type QueryCtx } from './_generated/server'
import { normalizedEvent } from './lib/calendar'
import { isGroceryList, OPEN_ITEMS_SCAN_LIMIT } from './lib/groceryCategories'
import { completionDay } from './lib/taskRepeat'
import {
  resolveWatch,
  type WatchCaller,
  watchGroceryList,
} from './lib/watchAccess'
import { withLiveRecipe } from './mealPlan'

/** Checked items, tasks and cards a watch is sent at most. */
export const WATCH_ROWS = 200

const args = { keyHash: v.string() }

/**
 * A read that depends on the day also takes the moment it was asked, from the
 * HTTP action: `Date.now()` inside a cached query would keep yesterday's
 * answer past midnight until the rows change (APP-991).
 */
const dayArgs = { keyHash: v.string(), now: v.number() }

/** The version of each Module's answer; it moves when a shape changes. */
export const WATCH_MODULES = { groceries: 1, today: 1, cards: 1 } as const

async function openGroceries(ctx: QueryCtx, list: Doc<'taskLists'>) {
  return await ctx.db
    .query('tasks')
    .withIndex('by_list_and_done', (q) =>
      q.eq('listId', list._id).eq('done', false),
    )
    .take(OPEN_ITEMS_SCAN_LIMIT)
}

/**
 * The open items the grocery list shows: a repeating item checked off waits
 * for its next due date off the list (APP-520).
 */
async function onGroceryList(
  ctx: QueryCtx,
  list: Doc<'taskLists'>,
  today: string,
) {
  return (await openGroceries(ctx, list)).filter((task) =>
    onShoppingList(task, today),
  )
}

async function checkedGroceries(ctx: QueryCtx, list: Doc<'taskLists'>) {
  const clearedAt = list.checkedClearedAt ?? null
  const rows = await ctx.db
    .query('tasks')
    .withIndex('by_list_and_done_at', (q) => {
      const own = q.eq('listId', list._id)
      return clearedAt === null ? own : own.gt('doneAt', clearedAt)
    })
    .order('desc')
    .take(WATCH_ROWS)
  return rows.filter((task) => inCheckedSection(task, clearedAt))
}

/** The caller's calendars' events on a day, as their own agenda shows them. */
async function eventsOn(
  ctx: QueryCtx,
  { group, membership }: WatchCaller,
  date: string,
) {
  const calendars = await ctx.db
    .query('calendars')
    .withIndex('by_group', (q) => q.eq('groupId', group._id))
    .collect()
  const perCalendar = await Promise.all(
    calendars.map(async (calendar) =>
      (
        await ctx.db
          .query('calendarEvents')
          .withIndex('by_calendar_date', (q) =>
            q.eq('calendarId', calendar._id).eq('date', date),
          )
          .take(WATCH_ROWS)
      ).map((event) => normalizedEvent(event, calendar)),
    ),
  )
  return orderCalendarEvents(
    filterCalendarEvents(
      perCalendar.flat(),
      membership.hiddenCalendarIds ?? [],
      membership.calendarPeopleFilter ?? null,
    ),
  ).map((event) => ({
    id: event.id,
    title: event.title,
    allDay: event.allDay,
    startMinutes: event.startMinutes,
    endMinutes: event.endMinutes,
    location: event.location,
    color: event.color,
  }))
}

/** Open tasks due today or before, as the phone's Today list has them. */
async function tasksDue(ctx: QueryCtx, caller: WatchCaller, today: string) {
  const { group, user } = caller
  const lists = await ctx.db
    .query('taskLists')
    .withIndex('by_group', (q) => q.eq('groupId', group._id))
    .collect()
  const scope = { today, me: user._id as string }
  const perList = await Promise.all(
    lists
      .filter((list) => list.provider === 'local')
      .map(async (list) => {
        const of = {
          kind: list.kind ?? ('plain' as const),
          grocery: isGroceryList(group, list),
        }
        return (await openGroceries(ctx, list))
          .filter((task) => inSmartList('today', task, of, scope))
          .map((task) => ({ task, list }))
      }),
  )
  return perList
    .flat()
    .sort((a, b) => bySmartOrder(a.task, b.task))
    .slice(0, WATCH_ROWS)
}

/** What each Module holds, for the watch's start list. */
export const modules = internalQuery({
  args: dayArgs,
  handler: async (ctx, { keyHash, now }) => {
    const caller = await resolveWatch(ctx, keyHash)
    if (!caller.ok) return caller
    const list = await watchGroceryList(ctx, caller)
    const today = completionDay(undefined, caller.group.timeZone, now)
    const cards = await ctx.db
      .query('loyaltyCards')
      .withIndex('by_group', (q) => q.eq('groupId', caller.group._id))
      .take(WATCH_ROWS)
    return {
      ok: true as const,
      data: {
        version: 1,
        group: { name: caller.group.name },
        modules: [
          {
            id: 'groceries' as const,
            version: WATCH_MODULES.groceries,
            open: list ? (await onGroceryList(ctx, list, today)).length : 0,
          },
          {
            id: 'today' as const,
            version: WATCH_MODULES.today,
            events: (await eventsOn(ctx, caller, today)).length,
            tasks: (await tasksDue(ctx, caller, today)).length,
          },
          {
            id: 'cards' as const,
            version: WATCH_MODULES.cards,
            cards: cards.length,
          },
        ],
      },
    }
  },
})

/** The watch's grocery list: open items by aisle, then what is in the basket. */
export const groceries = internalQuery({
  args: dayArgs,
  handler: async (ctx, { keyHash, now }) => {
    const caller = await resolveWatch(ctx, keyHash)
    if (!caller.ok) return caller
    const list = await watchGroceryList(ctx, caller)
    const today = completionDay(undefined, caller.group.timeZone, now)
    const open = list ? await onGroceryList(ctx, list, today) : []
    open.sort((a, b) => a.order - b.order)
    const checked = list ? await checkedGroceries(ctx, list) : []
    const item = (task: Doc<'tasks'>) => ({
      id: task._id,
      title: task.title,
      quantity: task.quantity ?? null,
      unit: task.unit ?? null,
      note: task.notes ?? null,
    })
    return {
      ok: true as const,
      data: {
        version: WATCH_MODULES.groceries,
        list: list ? { id: list._id, name: list.name } : null,
        sections: aisleSections(open, list?.aisleOrder).map((section) => ({
          aisle: section.aisle,
          items: section.tasks.map(item),
        })),
        checked: checkedOncePerName([...open, ...checked], checked).map(item),
      },
    }
  },
})

/** Today: appointments, then tasks, then meals; and tomorrow's first. */
export const today = internalQuery({
  args: dayArgs,
  handler: async (ctx, { keyHash, now }) => {
    const caller = await resolveWatch(ctx, keyHash)
    if (!caller.ok) return caller
    const { group } = caller
    const date = completionDay(undefined, group.timeZone, now)
    const due = await tasksDue(ctx, caller, date)
    const meals = await Promise.all(
      (
        await ctx.db
          .query('plannedDinners')
          .withIndex('by_group_date', (q) =>
            q.eq('groupId', group._id).eq('date', date),
          )
          .collect()
      ).map((meal) => withLiveRecipe(ctx, group._id, meal)),
    )
    return {
      ok: true as const,
      data: {
        version: WATCH_MODULES.today,
        date,
        timeZone: group.timeZone ?? null,
        events: await eventsOn(ctx, caller, date),
        tasks: due.map(({ task, list }) => ({
          id: task._id,
          title: task.title,
          listName: list.name,
          /** Sent back as `occurrence` with `task.done`. */
          dueDate: task.dueDate ?? null,
          overdue:
            task.dueDate !== undefined &&
            compareIsoDates(task.dueDate, date) < 0,
          repeats: task.repeat !== undefined,
          note: task.notes ?? null,
        })),
        meals: meals
          .sort(
            (a, b) => MEAL_SLOTS.indexOf(a.slot) - MEAL_SLOTS.indexOf(b.slot),
          )
          .map((meal) => ({ id: meal._id, slot: meal.slot, title: meal.title })),
        tomorrow: (await eventsOn(ctx, caller, addDays(date, 1)))[0] ?? null,
      },
    }
  },
})

/** The Group's cards in its order; `lib/watchHttp.ts` adds the barcodes. */
export const cards = internalQuery({
  args,
  handler: async (ctx, { keyHash }) => {
    const caller = await resolveWatch(ctx, keyHash)
    if (!caller.ok) return caller
    const rows = await ctx.db
      .query('loyaltyCards')
      .withIndex('by_group', (q) => q.eq('groupId', caller.group._id))
      .take(WATCH_ROWS)
    return {
      ok: true as const,
      data: {
        version: WATCH_MODULES.cards,
        cards: rows.sort(compareLoyaltyCards).map((card) => ({
          id: card._id,
          storeName: card.storeName,
          catalogKey: card.catalogKey ?? null,
          brandColor: card.brandColor ?? null,
          holder: card.holder ?? null,
          number: card.cardNumber,
          format: card.barcodeFormat,
        })),
      },
    }
  },
})
