/**
 * Plan mijn week's arithmetic, without React (APP-319, designs/meal-planner
 * §3): which days the start sheet may fill, which slots it offers, the
 * "Gather houdt rekening met" rows, and a draft's reason line. The server
 * decides what is actually empty again when it plans; this is what the sheet
 * shows before asking.
 */
import { addDays } from '@gather/core/civil-date'
import { fmt, type Locale, plural } from '@gather/core/i18n'
import { MEAL_SLOTS, type MealSlot, weekdayIndex } from '@gather/core/meal-planner'
import type { FunctionReturnType } from 'convex/server'

import type { api } from '../../../convex/api'
import type { Messages } from '../../../i18n'
import {
  awayAt,
  busyEvent,
  clock,
  eatersOf,
  joinNames,
  mealIn,
  type WeekData,
  weekdayName,
} from './week'

export type Draft = FunctionReturnType<typeof api.mealPlanDrafts.list>[number]
type Words = Messages['mealPlanner']
type PrefWords = Messages['mealPreferences']

export type PlanDayState = 'planned' | 'fill' | 'skip'

export interface PlanSlotChoice {
  slot: MealSlot
  /** The weekdays the Group plans this slot, Monday first. */
  days: number[]
}

/** The slots the Group plans at all, with their weekdays, breakfast first. */
export function planSlotChoices(
  preferences: WeekData['preferences'],
): PlanSlotChoice[] {
  return MEAL_SLOTS.filter((slot) => preferences.slots[slot].enabled)
    .map((slot) => ({ slot, days: [...preferences.slots[slot].days].sort() }))
    .filter((choice) => choice.days.length > 0)
}

/** The slots on by default: dinner when the Group plans it, else the first. */
export function defaultPlanSlots(choices: readonly PlanSlotChoice[]): MealSlot[] {
  if (choices.some((choice) => choice.slot === 'dinner')) return ['dinner']
  return choices.slice(0, 1).map((choice) => choice.slot)
}

/** A slot chip's label: "Lunch (za, zo)", or the slot alone on every day. */
export function slotChipLabel(
  choice: PlanSlotChoice,
  words: Words,
  prefWords: PrefWords,
) {
  const name = words.slots[choice.slot]
  if (choice.days.length === 7) return name
  return fmt(words.plan.slotDays, {
    slot: name,
    days: choice.days.map((day) => prefWords.dayShort[day]).join(', '),
  })
}

/** The chosen slots a day has, by the Group's plan for that weekday. */
function slotsOn(
  choices: readonly PlanSlotChoice[],
  slots: readonly MealSlot[],
  date: string,
): MealSlot[] {
  const weekday = weekdayIndex(date)
  return choices
    .filter((choice) => slots.includes(choice.slot) && choice.days.includes(weekday))
    .map((choice) => choice.slot)
}

/**
 * Whether a day has nothing left to fill for these slots: every chosen slot
 * the Group plans that day holds a meal, or none is planned that day at all.
 */
export function dayIsPlanned(
  data: Pick<WeekData, 'meals'>,
  choices: readonly PlanSlotChoice[],
  slots: readonly MealSlot[],
  date: string,
) {
  return slotsOn(choices, slots, date).every((slot) => mealIn(data.meals, date, slot))
}

/** The empty slots the plan would fill on these days. */
export function emptyTargets(
  data: Pick<WeekData, 'meals'>,
  choices: readonly PlanSlotChoice[],
  slots: readonly MealSlot[],
  dates: readonly string[],
) {
  return dates.flatMap((date) =>
    slotsOn(choices, slots, date)
      .filter((slot) => !mealIn(data.meals, date, slot))
      .map((slot) => ({ date, slot })),
  )
}

/**
 * Each day of the week as the grid shows it: planned (locked), or fill or
 * skip. A day starts as fill from today on and as skip before it; `flipped`
 * holds the days the person turned the other way.
 */
export function planDays(
  weekStart: string,
  data: Pick<WeekData, 'meals'>,
  choices: readonly PlanSlotChoice[],
  slots: readonly MealSlot[],
  flipped: ReadonlySet<string>,
  today: string,
): { date: string; state: PlanDayState }[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index)
    if (dayIsPlanned(data, choices, slots, date))
      return { date, state: 'planned' as const }
    const fill = date >= today !== flipped.has(date)
    return { date, state: fill ? ('fill' as const) : ('skip' as const) }
  })
}

/** One "Gather houdt rekening met" row; a row with nothing to say is left out. */
export interface PlanUse {
  kind: 'preferences' | 'calendar' | 'eaters' | 'stock'
  label: string
  sub: string
}

export function planUses({
  data,
  dates,
  lowNames,
  stockNames,
  words,
  prefWords,
  locale,
}: {
  data: WeekData
  /** The days the plan fills. */
  dates: readonly string[]
  lowNames: readonly string[]
  stockNames: readonly string[]
  words: Words
  prefWords: PrefWords
  locale: Locale
}): PlanUse[] {
  const plan = words.plan
  const prefs = data.preferences
  const parts = [
    ...prefs.allergens.map((allergen) =>
      fmt(plan.noAllergen, {
        name: prefWords.allergies.names[allergen].toLocaleLowerCase(locale),
      }),
    ),
    ...prefs.diets.map((diet) => prefWords.diet.names[diet].toLocaleLowerCase(locale)),
    ...prefs.dislikes.slice(0, 2).map((name) => fmt(plan.dislike, { name })),
    prefs.meatFreeNights > 0
      ? plural(locale, prefs.meatFreeNights, plan.meatFree)
      : null,
    prefs.fishDays.length > 0
      ? fmt(plan.fishDay, {
          days: prefs.fishDays.map((day) => prefWords.dayShort[day]).join(', '),
        })
      : null,
  ].filter((part): part is string => Boolean(part))
  const weekdayMax = prefs.cookingMinutes.slice(0, 5)
  if (parts.length === 0 && weekdayMax.every((m) => m !== null && m === weekdayMax[0]))
    parts.push(fmt(plan.maxMinutes, { minutes: weekdayMax[0] as number }))
  const uses: PlanUse[] = [
    {
      kind: 'preferences',
      label: plan.usesPreferences,
      sub: parts.length > 0 ? parts.join(' · ') : plan.usesPreferencesNone,
    },
  ]
  if (prefs.smart.useCalendar) {
    const busy = dates.flatMap((date) => {
      const event = busyEvent(data.events, date)
      return event
        ? [
            fmt(plan.busyEvening, {
              day: weekdayName(date, locale),
              title: event.title,
              time: clock(event.startMinutes),
            }),
          ]
        : []
    })
    if (busy.length > 0)
      uses.push({ kind: 'calendar', label: plan.usesCalendar, sub: busy.join(' · ') })
    if (data.members.length > 1) {
      const fewer = dates.flatMap((date) => {
        const away = awayAt(data.events, date, 'dinner')
        if (away.size === 0) return []
        const names = data.members
          .filter((member) => away.has(member.userId))
          .map((member) => member.name)
        if (names.length === 0) return []
        return [
          fmt(plan.fewerEaters, {
            day: weekdayName(date, locale),
            names: joinNames(names, words),
            count: eatersOf(data, date, 'dinner').length,
          }),
        ]
      })
      if (fewer.length > 0)
        uses.push({ kind: 'eaters', label: plan.usesEaters, sub: fewer.join(' · ') })
    }
  }
  if (prefs.smart.useStock && lowNames.length + stockNames.length > 0) {
    const stock = [
      ...lowNames.slice(0, 2).map((name) => fmt(plan.runningLow, { name })),
      ...stockNames.slice(0, 3).map((name) => name.toLocaleLowerCase(locale)),
    ]
    uses.push({ kind: 'stock', label: plan.usesStock, sub: stock.join(' · ') })
  }
  return uses
}

/**
 * A draft's line under its title: the model's reason and the minutes, or,
 * for a pick the rules made, the minutes and "volgens jullie regels".
 */
export function draftReason(draft: Pick<Draft, 'reason' | 'prepMinutes'>, words: Words) {
  const minutes = draft.prepMinutes
    ? fmt(words.minutes, { minutes: draft.prepMinutes })
    : null
  if (draft.reason) return [draft.reason, minutes].filter(Boolean).join(' · ')
  return [minutes, words.proposal.byRules].filter(Boolean).join(' · ')
}

/** The draft for one slot, if the open proposal has one. */
export function draftIn(drafts: readonly Draft[], date: string, slot: MealSlot) {
  return drafts.find((draft) => draft.date === date && draft.slot === slot)
}
