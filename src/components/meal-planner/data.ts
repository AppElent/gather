import { addDays, isIsoDate, mondayStart, todayIn } from '@gather/core/civil-date'
import type { MealSlot } from '@gather/core/meal-planner'
import {
  daySlots,
  eatersOf,
  mealIn,
  type WeekData as PureWeekData,
  servingsOf,
} from '@gather/core/week-menu'
import { draftIn } from '@gather/core/week-menu-plan'
import type { FunctionReturnType } from 'convex/server'
import { api } from '../../../convex/_generated/api'
import { linkTo } from '../../lib/links'

export type WeekData = FunctionReturnType<typeof api.mealPlan.week>
export type PlannedMeal = WeekData['meals'][number]
export type Draft = FunctionReturnType<typeof api.mealPlanDrafts.list>[number]

/** What the week page's address keeps: the week, and the open meal or draft. */
export interface WeekSearch {
  /** The Monday; absent for the Group's current week. */
  week?: string
  meal?: string
  draft?: string
}

const text = (value: unknown) =>
  typeof value === 'string' && value ? value : undefined

/** The Monday a `?week` names, or nothing when it is not a date. */
export function validWeek(value: unknown): string | undefined {
  return typeof value === 'string' && isIsoDate(value)
    ? mondayStart(value)
    : undefined
}

export function validateWeekSearch(
  search: Record<string, unknown>,
): WeekSearch {
  const week = validWeek(search.week)
  const meal = text(search.meal)
  const draft = text(search.draft)
  return {
    ...(week ? { week } : {}),
    ...(meal ? { meal } : draft ? { draft } : {}),
  }
}

export function validateRecordSearch(search: Record<string, unknown>): {
  week?: string
} {
  const week = validWeek(search.week)
  return week ? { week } : {}
}

/** The week shown: the one in the address, or the Group's own. */
export function weekShown(week: string | undefined, timeZone?: string) {
  const today = todayIn(timeZone)
  const current = mondayStart(today)
  return { today, current, from: week ?? current, to: addDays(week ?? current, 6) }
}

/** The week page, with nothing open. */
export function weekLink(week: string | undefined) {
  return { ...linkTo('meal-planner'), search: (week ? { week } : {}) as WeekSearch }
}

type Selected = { kind: 'meal' | 'draft'; id: string }

/**
 * Where a row goes: the panel from `lg`, a page of its own below it. It names
 * its week, so a kept link still finds the meal when that week has passed.
 */
export function recordLink(
  { kind, id }: Selected,
  week: string,
  desktop: boolean,
) {
  const search: WeekSearch = { week }
  if (desktop)
    return {
      ...linkTo('meal-planner'),
      search: { ...search, [kind]: id },
      // The week stays where it is scrolled.
      resetScroll: false,
    }
  return kind === 'meal'
    ? { ...linkTo('plannedMeal', { mealId: id }), search }
    : { ...linkTo('mealProposal', { draftId: id }), search }
}

/** How many of the week's slots hold a meal, and which slots the Group plans. */
export function weekSummary(data: PureWeekData, from: string) {
  let total = 0
  let planned = 0
  const slots = new Set<MealSlot>()
  for (let index = 0; index < 7; index++) {
    const date = addDays(from, index)
    for (const slot of daySlots(data.preferences, date, data.meals)) {
      total++
      slots.add(slot)
      if (mealIn(data.meals, date, slot)) planned++
    }
  }
  const inOrder = (['breakfast', 'lunch', 'dinner'] as const).filter((slot) =>
    slots.has(slot),
  )
  return { total, planned, slots: inOrder }
}

/** How many a meal, or an empty slot's proposal, is for. */
export function eatingCount(
  data: PureWeekData,
  date: string,
  slot: MealSlot,
  meal?: Pick<PlannedMeal, 'eaterIds' | 'servings'>,
) {
  const eaters = eatersOf(data, date, slot, meal?.eaterIds)
  return servingsOf(data, meal?.servings, eaters.length)
}

/** The drafts whose slot is still free: those the proposal bar counts. */
export function openDrafts(
  data: Pick<PureWeekData, 'meals'>,
  drafts: readonly Draft[],
) {
  return drafts.filter((draft) => !mealIn(data.meals, draft.date, draft.slot))
}

/** The slots a day card shows: the day's own, and any slot with a draft. */
export function cardSlots(
  data: PureWeekData,
  drafts: readonly Draft[],
  date: string,
): MealSlot[] {
  const own = daySlots(data.preferences, date, data.meals)
  return (['breakfast', 'lunch', 'dinner'] as const).filter(
    (slot) => own.includes(slot) || draftIn(drafts, date, slot),
  )
}

/** Whether a meal may be put in this slot on this day. */
export function canMoveTo(
  data: PureWeekData,
  meal: Pick<PlannedMeal, 'date' | 'slot'>,
  date: string,
  slot: MealSlot = meal.slot,
) {
  if (meal.date === date && meal.slot === slot) return false
  return daySlots(data.preferences, date, data.meals).includes(slot)
}
