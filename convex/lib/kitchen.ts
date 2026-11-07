import { v } from 'convex/values'

/** The minutes a quick dinner is planned against. */
export const quickLimitValidator = v.union(
  v.literal(10),
  v.literal(20),
  v.literal(30),
)
