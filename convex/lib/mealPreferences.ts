/**
 * Validators for `mealPreferences`, mirroring `@gather/core/meal-preferences`.
 * The literal lists come from core, so a diet or allergen added there is
 * accepted here in the same change.
 */
import {
  ALLERGENS,
  COOKING_MINUTES,
  CUISINES,
  DIETS,
  WEEKDAYS,
} from '@gather/core/meal-preferences'
import { v } from 'convex/values'

/** A union of the literals in a core list. */
const literals = <T extends string | number>(values: readonly T[]) =>
  v.union(...values.map((value) => v.literal(value)))

export const weekdayValidator = literals(WEEKDAYS)
export const dietValidator = literals(DIETS)
export const allergenValidator = literals(ALLERGENS)
export const cuisineValidator = literals(CUISINES)
export const cookingMinutesValidator = v.union(
  literals(COOKING_MINUTES),
  v.null(),
)

const slotPlanValidator = v.object({
  enabled: v.boolean(),
  days: v.array(weekdayValidator),
})

export const slotsValidator = v.object({
  breakfast: slotPlanValidator,
  lunch: slotPlanValidator,
  dinner: slotPlanValidator,
})

export const smartValidator = v.object({
  useStock: v.boolean(),
  useCalendar: v.boolean(),
  preferHighRated: v.boolean(),
})

/**
 * The preferences a write may set. Each is optional; absent leaves it as it
 * is. `null` clears the two values whose default is "none".
 *
 * Diets, allergens and dislikes are not here: they change one item at a time
 * (`mealPreferences.setDiet` and friends), so a concurrent edit by another
 * Member is never overwritten by a stale whole list.
 */
export const mealPreferencesPatchValidator = v.object({
  servingsPerMeal: v.optional(v.union(v.number(), v.null())),
  slots: v.optional(slotsValidator),
  cookingMinutes: v.optional(v.array(cookingMinutesValidator)),
  noRepeatDays: v.optional(v.number()),
  meatFreeNights: v.optional(v.number()),
  fishDays: v.optional(v.array(weekdayValidator)),
  leftoverDays: v.optional(v.array(weekdayValidator)),
  weeklyBudgetCents: v.optional(v.union(v.number(), v.null())),
  cuisines: v.optional(v.array(cuisineValidator)),
  smart: v.optional(smartValidator),
})

/** The stored document's preference columns: as above, without the nulls. */
export const mealPreferencesFields = {
  memberDefaults: v.optional(
    v.array(v.object({ userId: v.id('users'), eatsByDefault: v.boolean() })),
  ),
  servingsPerMeal: v.optional(v.number()),
  slots: v.optional(slotsValidator),
  cookingMinutes: v.optional(v.array(cookingMinutesValidator)),
  diets: v.optional(v.array(dietValidator)),
  allergens: v.optional(v.array(allergenValidator)),
  dislikes: v.optional(v.array(v.string())),
  noRepeatDays: v.optional(v.number()),
  meatFreeNights: v.optional(v.number()),
  fishDays: v.optional(v.array(weekdayValidator)),
  leftoverDays: v.optional(v.array(weekdayValidator)),
  weeklyBudgetCents: v.optional(v.number()),
  cuisines: v.optional(v.array(cuisineValidator)),
  smart: v.optional(smartValidator),
}
