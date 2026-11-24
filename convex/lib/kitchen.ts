import { WEEK_PLAN_WISHES } from '@gather/core/week-plan'
import { v } from 'convex/values'

/** The minutes a quick dinner is planned against (phones from before slots). */
export const quickLimitValidator = v.union(
  v.literal(10),
  v.literal(20),
  v.literal(30),
)

/** A meal moment (`MEAL_SLOTS` in `@gather/core/meal-planner`). */
export const mealSlotValidator = v.union(
  v.literal('breakfast'),
  v.literal('lunch'),
  v.literal('dinner'),
)

/** A wish chip on Plan mijn week's start sheet. */
export const weekPlanWishValidator = v.union(
  ...WEEK_PLAN_WISHES.map((wish) => v.literal(wish)),
)
