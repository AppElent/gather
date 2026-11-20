import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// Shared grocery aisle answers nothing backs any more (ADR-0049).
crons.daily(
  'prune grocery category cache',
  { hourUTC: 3, minuteUTC: 17 },
  internal.groceryCategories.prune,
  {},
)

// Plan mijn week's proposals are kept for 24 hours (APP-319).
crons.hourly(
  'sweep expired meal plan drafts',
  { minuteUTC: 41 },
  internal.mealPlanDrafts.sweep,
  {},
)

export default crons
