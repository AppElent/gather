/**
 * A stand-in for APP-318's household meal preferences, so the week view
 * (APP-317) can read enabled slots, default eaters and the picker's filter
 * before that work is on `main`.
 *
 * Same signature and defaults as APP-318's `resolveMealPreferences(row |
 * null, members)` and its recipe matcher. When APP-318 lands, its module
 * replaces this one: the callers change their import and this file is
 * deleted. Until then there is no stored row, so every Group reads the
 * defaults. Nothing here may grow fields APP-318 owns beyond what the week
 * view reads.
 */
import type { MealSlot } from './mealPlanner'

export interface MealSlotSetting {
  enabled: boolean
  /** Monday-first weekdays, 0 to 6. */
  days: readonly number[]
}

/** The stored row, as far as the week view reads it. */
export interface MealPreferencesRow {
  memberDefaults?: readonly { userId: string; eatsByDefault: boolean }[]
  servingsPerMeal?: number
  slots?: Partial<Record<MealSlot, MealSlotSetting>>
  /** Most minutes to cook per Monday-first weekday; null is no maximum. */
  minutesPerWeekday?: readonly (number | null)[]
  dislikes?: readonly string[]
}

export interface ResolvedMealPreferences {
  /** One entry per Member, in the order given; a missing one eats along. */
  memberDefaults: { userId: string; eatsByDefault: boolean }[]
  /** Absent: as many servings as people eating. */
  servingsPerMeal?: number
  slots: Record<MealSlot, MealSlotSetting>
  minutesPerWeekday: (number | null)[]
  dislikes: string[]
}

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6]

export const DEFAULT_SLOTS: Record<MealSlot, MealSlotSetting> = {
  breakfast: { enabled: false, days: EVERY_DAY },
  lunch: { enabled: true, days: [5, 6] },
  dinner: { enabled: true, days: EVERY_DAY },
}

/** 30 minutes on weekdays, 60 at the weekend. */
export const DEFAULT_MINUTES_PER_WEEKDAY = [30, 30, 30, 30, 30, 60, 60]

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
  return {
    memberDefaults: members.map((member) => ({
      userId: member.userId,
      eatsByDefault: chosen.get(member.userId) ?? true,
    })),
    servingsPerMeal: row?.servingsPerMeal,
    slots: {
      breakfast: row?.slots?.breakfast ?? DEFAULT_SLOTS.breakfast,
      lunch: row?.slots?.lunch ?? DEFAULT_SLOTS.lunch,
      dinner: row?.slots?.dinner ?? DEFAULT_SLOTS.dinner,
    },
    minutesPerWeekday: DEFAULT_MINUTES_PER_WEEKDAY.map(
      (fallback, day) => row?.minutesPerWeekday?.[day] ?? fallback,
    ),
    dislikes: [...(row?.dislikes ?? [])],
  }
}

/** The slots a weekday shows, in day order. */
export function enabledSlots(
  prefs: ResolvedMealPreferences,
  weekday: number,
): MealSlot[] {
  return (['breakfast', 'lunch', 'dinner'] as const).filter(
    (slot) => prefs.slots[slot].enabled && prefs.slots[slot].days.includes(weekday),
  )
}

export interface RecipeClash {
  kind: 'allergen' | 'diet' | 'dislike' | 'time'
  /** What clashes: an ingredient word, or the minutes. */
  label: string
  /** True when the match is a guess and the person should check. */
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
  const most = prefs.minutesPerWeekday[weekday]
  if (
    most !== null &&
    most !== undefined &&
    recipe.prepMinutes !== undefined &&
    recipe.prepMinutes > most
  )
    clashes.push({ kind: 'time', label: String(recipe.prepMinutes) })
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
