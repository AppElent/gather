/**
 * A stand-in for APP-318's household meal preferences, so the week view
 * (APP-317) can read enabled slots, default eaters and the picker's filter
 * before that work is on `main`.
 *
 * It mirrors the part of APP-318's `@gather/core/meal-preferences` the week
 * view reads, under the same names: `resolveMealPreferences(row | null,
 * members)`, `recipeClashes(recipe, prefs, weekday)` and `fitsPreferences`.
 * When APP-318 lands, callers change their import to
 * `@gather/core/meal-preferences` and this file is deleted. Until then there
 * is no stored row, so every Group reads the defaults. Nothing here may grow
 * fields APP-318 owns beyond what the week view reads.
 */
import type { MealSlot } from './mealPlanner'

export interface MealSlotSetting {
  enabled: boolean
  /** Monday-first weekdays, 0 to 6. */
  days: readonly number[]
}

/** Most minutes to cook on a day; null is no maximum. */
export type CookingMinutes = 15 | 20 | 30 | 45 | 60 | 90 | null

/** The stored row, as far as the week view reads it. */
export interface MealPreferencesRow {
  memberDefaults?: readonly { userId: string; eatsByDefault: boolean }[]
  servingsOverride?: number | null
  slots?: Partial<Record<MealSlot, MealSlotSetting>>
  /** Per Monday-first weekday. */
  cookingMinutes?: readonly CookingMinutes[]
  dislikes?: readonly string[]
}

export interface ResolvedMealPreferences {
  /** One entry per current Member, in the order given; a missing one eats along. */
  memberDefaults: { userId: string; eatsByDefault: boolean }[]
  defaultEaterIds: string[]
  /** A fixed number of servings for every meal, or null to follow who eats. */
  servingsOverride: number | null
  /** The override, else how many eat by default, at least 1. */
  servingsPerMeal: number
  slots: Record<MealSlot, MealSlotSetting>
  cookingMinutes: CookingMinutes[]
  dislikes: string[]
}

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6]

export const DEFAULT_SLOTS: Record<MealSlot, MealSlotSetting> = {
  breakfast: { enabled: false, days: EVERY_DAY },
  lunch: { enabled: true, days: [5, 6] },
  dinner: { enabled: true, days: EVERY_DAY },
}

/** 30 minutes on weekdays, 60 at the weekend. */
export const DEFAULT_COOKING_MINUTES: CookingMinutes[] = [
  30, 30, 30, 30, 30, 60, 60,
]

export function resolveMealPreferences(
  row: MealPreferencesRow | null,
  members: readonly { userId: string }[],
): ResolvedMealPreferences {
  const chosen = new Map(
    (row?.memberDefaults ?? []).map((entry) => [
      entry.userId,
      entry.eatsByDefault,
    ]),
  )
  const memberDefaults = members.map((member) => ({
    userId: member.userId,
    eatsByDefault: chosen.get(member.userId) ?? true,
  }))
  const defaultEaterIds = memberDefaults
    .filter((entry) => entry.eatsByDefault)
    .map((entry) => entry.userId)
  const servingsOverride = row?.servingsOverride ?? null
  return {
    memberDefaults,
    defaultEaterIds,
    servingsOverride,
    servingsPerMeal: servingsOverride ?? Math.max(1, defaultEaterIds.length),
    slots: {
      breakfast: row?.slots?.breakfast ?? DEFAULT_SLOTS.breakfast,
      lunch: row?.slots?.lunch ?? DEFAULT_SLOTS.lunch,
      dinner: row?.slots?.dinner ?? DEFAULT_SLOTS.dinner,
    },
    cookingMinutes: DEFAULT_COOKING_MINUTES.map((fallback, day) => {
      const own = row?.cookingMinutes?.[day]
      return own === undefined ? fallback : own
    }),
    dislikes: [...(row?.dislikes ?? [])],
  }
}

/** The slots a weekday shows, in day order. */
export function enabledSlots(
  prefs: ResolvedMealPreferences,
  weekday: number,
): MealSlot[] {
  return (['breakfast', 'lunch', 'dinner'] as const).filter(
    (slot) =>
      prefs.slots[slot].enabled && prefs.slots[slot].days.includes(weekday),
  )
}

/**
 * Why a recipe may not fit. `uncertain` is a guess the person should check
 * ("controleer zelf"): it is shown, never hidden.
 */
export type RecipeClash =
  | { kind: 'time'; minutes: number; limit: number; uncertain?: boolean }
  | { kind: 'dislike'; label: string; uncertain?: boolean }
  | {
      kind: 'allergen' | 'diet'
      id: string
      label: string
      uncertain?: boolean
    }

/**
 * Why a recipe does not fit the Group's preferences on a weekday; empty when
 * it fits. The stand-in knows two of APP-318's rules: the cooking time per
 * weekday (a recipe without a time is never hidden for it) and "rather not"
 * words found in the title or an ingredient line.
 */
export function recipeClashes(
  recipe: {
    title: string
    ingredients?: readonly string[]
    tags?: readonly string[]
    prepMinutes?: number
  },
  prefs: ResolvedMealPreferences,
  weekday: number,
): RecipeClash[] {
  const clashes: RecipeClash[] = []
  const limit = prefs.cookingMinutes[weekday]
  if (
    limit !== null &&
    limit !== undefined &&
    recipe.prepMinutes !== undefined &&
    recipe.prepMinutes > limit
  )
    clashes.push({ kind: 'time', minutes: recipe.prepMinutes, limit })
  const text = [recipe.title, ...(recipe.ingredients ?? [])]
    .join('\n')
    .toLocaleLowerCase()
  for (const word of prefs.dislikes) {
    const needle = word.trim().toLocaleLowerCase()
    if (needle && text.includes(needle))
      clashes.push({ kind: 'dislike', label: word.trim() })
  }
  return clashes
}

/** The hide test: a recipe fits unless a clash is certain. */
export function fitsPreferences(clashes: readonly RecipeClash[]) {
  return clashes.every((clash) => clash.uncertain)
}
