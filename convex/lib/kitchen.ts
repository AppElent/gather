import { v } from 'convex/values'

/** The minutes a quick dinner is planned against (legacy, from phones before slots). */
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
