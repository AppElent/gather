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

// Checked grocery items beyond what Recent and the habits read (APP-404).
crons.daily(
  'prune checked groceries',
  { hourUTC: 3, minuteUTC: 47 },
  internal.groceryPrune.pruneCheckedGroceries,
  {},
)

export default crons
