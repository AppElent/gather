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

// Plan mijn week's proposals are kept for 24 hours (APP-319).
crons.hourly(
  'sweep expired meal plan drafts',
  { minuteUTC: 41 },
  internal.mealPlanDrafts.sweep,
  {},
)

// Home Assistant's hourly statistics, which it writes just after each hour
// (APP-495).
crons.hourly(
  'sync energy sources',
  { minuteUTC: 20 },
  internal.energySources.startSyncs,
  {},
)

// Home Assistant's corrections to hours already stored (APP-729), between two
// hourly syncs.
crons.daily(
  'pick up energy corrections',
  { hourUTC: 2, minuteUTC: 50 },
  internal.energySources.startSyncs,
  { lookback: true },
)

// Day-ahead prices, published around 13:00 in Amsterdam (APP-493): 13:35 in
// summer, and in winter 12:35, whose retries carry on from there.
crons.daily(
  'fetch energy prices',
  { hourUTC: 11, minuteUTC: 35 },
  internal.energyPrices.startFetches,
  {},
)

export default crons
