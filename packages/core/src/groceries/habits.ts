/**
 * What a household usually buys, read from the grocery items it checked
 * (APP-311; `designs/groceries/README.md`, section 1 item 2 and section 2):
 * how often each name was bought, its usual interval and amount, and which
 * names are probably due again. A plain rule, no AI. Convex computes the
 * suggestions with it; the phone formats them.
 */
import type { GroceryAisle } from './aisles'
import type { GroceryUnit } from './parse'

export const DAY_MS = 86_400_000

/**
 * Checks of one name closer together than this are one purchase: two rows of
 * milk checked on the same trip, or a check, an uncheck and a check again.
 */
export const SAME_TRIP_MS = 12 * 60 * 60 * 1000

/** A name needs this many purchases before it has a usual interval. */
export const HABIT_MIN_PURCHASES = 3

/** The usual interval is the median of the newest gaps, at most this many. */
export const HABIT_GAPS = 10

/** The usual amount is the most common one among the newest purchases. */
const AMOUNT_WINDOW = 5

/** The most suggestions a list shows (the strip). */
export const SUGGESTIONS_LIMIT = 8

/**
 * A name stops being suggested once it is this many usual intervals overdue,
 * or 30 days, whichever is longer: by then the household stopped buying it,
 * while a fortnight away from home does not drop the weekly milk.
 */
const STALE_INTERVALS = 3
const STALE_MIN_MS = 30 * DAY_MS

/** One checked grocery item: a name bought at a moment. */
export interface GroceryPurchase {
  /** `groceryKey` of the name, so "Melk" and "2 pakken melk" are one. */
  key: string
  /** The name as it was on the list. */
  title: string
  at: number
  quantity?: number
  unit?: GroceryUnit
  category?: GroceryAisle
}

/** A name the household bought, with how it usually buys it. */
export interface GroceryHabit {
  key: string
  /** The newest name it was on the list as. */
  title: string
  /** Purchases, with checks on the same trip counted once. */
  count: number
  /**
   * Days between purchases, the median of the newest gaps; null below
   * `HABIT_MIN_PURCHASES`.
   */
  intervalDays: number | null
  /** When it was last bought. */
  lastAt: number
  /** The usual amount: the most common among the newest purchases. */
  quantity?: number
  unit?: GroceryUnit
  /** The newest aisle it had. */
  category?: GroceryAisle
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2
}

/** The most common amount, the newest winning a tie. Newest first in. */
function usualAmount(
  newestFirst: readonly GroceryPurchase[],
): Pick<GroceryPurchase, 'quantity' | 'unit'> {
  const window = newestFirst.slice(0, AMOUNT_WINDOW)
  const id = (purchase: GroceryPurchase) =>
    `${purchase.quantity ?? ''}|${purchase.unit ?? ''}`
  const counts = new Map<string, number>()
  for (const purchase of window)
    counts.set(id(purchase), (counts.get(id(purchase)) ?? 0) + 1)
  // Newest first, so the first amount with the top count is the newest one.
  let best = window[0]
  for (const purchase of window)
    if ((counts.get(id(purchase)) ?? 0) > (counts.get(id(best)) ?? 0))
      best = purchase
  return {
    ...(best.quantity !== undefined ? { quantity: best.quantity } : {}),
    ...(best.unit !== undefined ? { unit: best.unit } : {}),
  }
}

/**
 * Every name bought, most bought first (then the most recently bought):
 * checks within `SAME_TRIP_MS` of the purchase before them count once.
 * Purchases may come in any order; an empty key is skipped.
 */
export function groceryHabits(
  purchases: readonly GroceryPurchase[],
): GroceryHabit[] {
  const byKey = new Map<string, GroceryPurchase[]>()
  for (const purchase of purchases) {
    if (!purchase.key) continue
    const list = byKey.get(purchase.key)
    if (list) list.push(purchase)
    else byKey.set(purchase.key, [purchase])
  }
  const habits: GroceryHabit[] = []
  for (const [key, list] of byKey) {
    const oldestFirst = [...list].sort((a, b) => a.at - b.at)
    // One purchase per trip; a trip starts at its first check, and a check
    // within `SAME_TRIP_MS` of that start belongs to it.
    const tripStarts: number[] = []
    for (const purchase of oldestFirst) {
      const start = tripStarts.at(-1)
      if (start === undefined || purchase.at - start >= SAME_TRIP_MS)
        tripStarts.push(purchase.at)
    }
    const gaps = tripStarts
      .slice(1)
      .map((at, index) => at - tripStarts[index])
      .slice(-HABIT_GAPS)
    const newestFirst = oldestFirst.reverse()
    const newest = newestFirst[0]
    const category = newestFirst.find((purchase) => purchase.category)?.category
    habits.push({
      key,
      title: newest.title,
      count: tripStarts.length,
      intervalDays:
        tripStarts.length >= HABIT_MIN_PURCHASES ? median(gaps) / DAY_MS : null,
      lastAt: newest.at,
      ...usualAmount(newestFirst),
      ...(category ? { category } : {}),
    })
  }
  return habits.sort((a, b) => b.count - a.count || b.lastAt - a.lastAt)
}

/**
 * Whether a name is probably needed again: bought at least
 * `HABIT_MIN_PURCHASES` times, its usual interval has passed since it was
 * last bought, and it is not so long overdue that it was given up.
 */
export function isGroceryHabitDue(habit: GroceryHabit, now: number): boolean {
  if (habit.intervalDays === null) return false
  const interval = habit.intervalDays * DAY_MS
  const since = now - habit.lastAt
  if (since < interval) return false
  return since <= Math.max(STALE_INTERVALS * interval, STALE_MIN_MS)
}

/**
 * The "Maybe needed" strip: due names that are not on the list and were not
 * hidden, most bought first, at most `SUGGESTIONS_LIMIT`.
 */
export function grocerySuggestions(
  habits: readonly GroceryHabit[],
  options: {
    now: number
    /** Keys already open on the list, and keys a Member hid. */
    exclude: ReadonlySet<string>
    limit?: number
  },
): GroceryHabit[] {
  return habits
    .filter(
      (habit) =>
        !options.exclude.has(habit.key) && isGroceryHabitDue(habit, options.now),
    )
    .slice(0, options.limit ?? SUGGESTIONS_LIMIT)
}

/** How often, in words: one of the `cadence` messages and its count. */
export type GroceryCadence =
  | { unit: 'day' }
  | { unit: 'days'; count: number }
  | { unit: 'week' }
  | { unit: 'weeks'; count: number }
  | { unit: 'month' }
  | { unit: 'months'; count: number }

/** A usual interval as people say it: every 4 days, every week, every month. */
export function groceryCadence(intervalDays: number): GroceryCadence {
  const days = Math.max(1, Math.round(intervalDays))
  if (days === 1) return { unit: 'day' }
  if (days <= 5) return { unit: 'days', count: days }
  if (days <= 10) return { unit: 'week' }
  if (days < 25) return { unit: 'weeks', count: Math.max(2, Math.round(days / 7)) }
  const months = Math.round(days / 30)
  return months <= 1 ? { unit: 'month' } : { unit: 'months', count: months }
}

/** Whole calendar days between two moments, in the device's time zone. */
export function daysAgo(at: number, now: number): number {
  const start = (moment: number) => {
    const date = new Date(moment)
    return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  }
  return Math.max(0, Math.round((start(now) - start(at)) / DAY_MS))
}
