/**
 * The week menu's arithmetic, without React: which slots a day shows, who
 * eats along, and the words that say so. The screen and the sheets draw from
 * here so the day header, the row meta and the meal sheet never disagree.
 */
import { addDays, localMidnight } from '@gather/core/civil-date'
import { fmt, type Locale, plural } from '@gather/core/i18n'
import {
  awayFromEvents,
  defaultEaters,
  eveningEvents,
  MEAL_SLOTS,
  type MealSlot,
  mealEaters,
  mealServings,
  weekdayIndex,
} from '@gather/core/meal-planner'
import {
  enabledSlots,
  type ResolvedMealPreferences,
} from '@gather/core/meal-preferences'
import type { FunctionReturnType } from 'convex/server'

import type { api } from '../../../convex/api'
import type { Messages } from '../../../i18n'

export type WeekData = FunctionReturnType<typeof api.mealPlan.week>
export type PlannedMeal = WeekData['meals'][number]
export type Member = WeekData['members'][number]
export type EveningEvent = WeekData['events'][number]
type Words = Messages['mealPlanner']

/**
 * "16 – 22 nov" in Dutch, "Nov 16 – 22" in English, and both months when the
 * week crosses one. Built by hand: Hermes' `formatRange` repeats the month.
 */
export function weekRange(from: string, locale: string) {
  const start = localMidnight(from)
  const end = localMidnight(addDays(from, 6))
  const format = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
  })
  const both = `${format.format(start)} – ${format.format(end)}`
  if (start.getMonth() !== end.getMonth()) return both
  const parts = format.formatToParts?.(start)
  if (!parts) return both
  const order = parts.map((part) => part.type)
  return order.indexOf('month') < order.indexOf('day')
    ? `${format.format(start)} – ${end.getDate()}`
    : `${start.getDate()} – ${format.format(end)}`
}

/** Dutch writes "donderdag"; as a heading it wants its first capital. */
export const sentenceCase = (text: string) =>
  text.charAt(0).toLocaleUpperCase() + text.slice(1)

export function weekdayName(date: string, locale: string) {
  return sentenceCase(
    localMidnight(date).toLocaleDateString(locale, { weekday: 'long' }),
  )
}

/**
 * The weekday inside a sentence: "voor donderdag", "for Thursday". Dutch
 * writes weekdays in lower case; `weekdayName` is for the start of a line.
 */
export function weekdayInText(date: string, locale: string) {
  const name = localMidnight(date).toLocaleDateString(locale, { weekday: 'long' })
  return locale === 'nl' ? name.toLocaleLowerCase(locale) : sentenceCase(name)
}

/** "26 Nov". */
export function shortDate(date: string, locale: string) {
  return localMidnight(date).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
  })
}

/** "Thursday 26 Nov". */
export function dayTitle(date: string, locale: string) {
  return `${weekdayName(date, locale)} ${shortDate(date, locale)}`
}

/** "Sanne", "Sanne and Daan", "Sanne, Daan and Noor". */
export function joinNames(names: readonly string[], words: Words) {
  if (names.length <= 1) return names[0] ?? ''
  return fmt(words.and, {
    rest: names.slice(0, -1).join(', '),
    last: names[names.length - 1],
  })
}

/** HH:MM from minutes after midnight. */
export function clock(minutes: number | undefined) {
  if (minutes === undefined) return ''
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * The slots a day shows, breakfast first: the ones the Group plans that
 * weekday, plus any slot that already holds a meal, so turning lunch off
 * never hides a lunch someone planned.
 */
export function daySlots(
  preferences: ResolvedMealPreferences,
  date: string,
  meals: readonly PlannedMeal[],
): MealSlot[] {
  const enabled = new Set(enabledSlots(preferences, weekdayIndex(date)))
  for (const meal of meals) if (meal.date === date) enabled.add(meal.slot)
  return MEAL_SLOTS.filter((slot) => enabled.has(slot))
}

export function mealIn(
  meals: readonly PlannedMeal[],
  date: string,
  slot: MealSlot,
) {
  return meals.find((meal) => meal.date === date && meal.slot === slot)
}

/**
 * Who eats a meal, in Member order: its own list when someone chose one,
 * otherwise the Group's defaults, and at dinner minus whoever the calendar
 * has out that evening. Without a meal it is that slot's default.
 */
export function eatersOf(
  data: Pick<WeekData, 'members' | 'events' | 'preferences'>,
  date: string,
  slot: MealSlot,
  eaterIds?: readonly string[],
): string[] {
  const defaults = defaultEaters(
    data.preferences.memberDefaults,
    awayAt(data.events, date, slot),
  )
  return mealEaters(
    eaterIds,
    data.members.map((member) => member.userId),
    defaults,
  )
}

/** Who the calendar has out for a meal: an evening event only empties dinner. */
export function awayAt(
  events: readonly EveningEvent[],
  date: string,
  slot: MealSlot,
) {
  return slot === 'dinner'
    ? awayFromEvents(events, date)
    : new Map<string, EveningEvent>()
}

export function servingsOf(
  data: Pick<WeekData, 'preferences'>,
  servings: number | undefined,
  eaters: number,
) {
  return mealServings(servings, data.preferences.servingsOverride, eaters)
}

/** The Members not eating, by name. */
export function absentNames(
  members: readonly Member[],
  eaters: readonly string[],
) {
  const eating = new Set(eaters)
  return members
    .filter((member) => !eating.has(member.userId))
    .map((member) => member.name)
}

/** The coin group's one accessibility label. */
export function eatingLabel(
  members: readonly Member[],
  eaters: readonly string[],
  words: Words,
  locale: Locale,
) {
  const without = absentNames(members, eaters)
  if (eaters.length === 0) return words.noneEating
  if (without.length === 0)
    return plural(locale, eaters.length, words.allEating)
  return fmt(words.eatingWithout, {
    count: eaters.length,
    names: joinNames(without, words),
  })
}

/** A planned row's meta: "45 min · 3 people, without Daan". */
export function mealMeta(
  meal: PlannedMeal,
  data: Pick<WeekData, 'members' | 'events' | 'preferences'>,
  words: Words,
  locale: Locale,
) {
  const eaters = eatersOf(data, meal.date, meal.slot, meal.eaterIds)
  const servings = servingsOf(data, meal.servings, eaters.length)
  const parts = [
    meal.prepMinutes ? fmt(words.minutes, { minutes: meal.prepMinutes }) : null,
    plural(locale, servings, words.people),
  ].filter(Boolean)
  const without = absentNames(data.members, eaters)
  const tail =
    without.length > 0 && data.members.length > 1
      ? fmt(words.without, { names: joinNames(without, words) })
      : ''
  return `${parts.join(' · ')}${tail}`
}

/** The day's first evening event, for the busy pill. */
export function busyEvent(events: readonly EveningEvent[], date: string) {
  return eveningEvents(events, date)[0]
}

/** The dinners planned this week, for the header's summary. */
export function dinnersPlanned(meals: readonly PlannedMeal[], from: string) {
  const days = new Set(Array.from({ length: 7 }, (_, i) => addDays(from, i)))
  return meals.filter((meal) => meal.slot === 'dinner' && days.has(meal.date))
    .length
}

/** Plain text for the share sheet: one line per planned meal. */
export function shareText(
  data: Pick<WeekData, 'meals'>,
  from: string,
  words: Words,
  locale: string,
) {
  const lines = [fmt(words.shareTitle, { range: weekRange(from, locale) })]
  const planned = data.meals.filter(
    (meal) => meal.date >= from && meal.date <= addDays(from, 6),
  )
  if (planned.length === 0) lines.push(words.shareEmpty)
  for (const meal of planned)
    lines.push(
      `${dayTitle(meal.date, locale)} · ${words.slots[meal.slot]}: ${meal.title}`,
    )
  return lines.join('\n')
}
