export interface DinnerCandidate {
  id: string
  title: string
  prepMinutes?: number
}

/** Candidates a date may draw from; an unset limit means an ordinary dinner. */
export function eligibleDinnerCandidates<T extends DinnerCandidate>(
  candidates: readonly T[],
  quickLimit?: number,
): T[] {
  if (quickLimit === undefined) return [...candidates]
  return candidates.filter(
    (candidate) =>
      candidate.prepMinutes !== undefined &&
      candidate.prepMinutes <= quickLimit,
  )
}

/** A meal moment, in the order a day shows them (ADR-0027). */
export const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner'] as const
export type MealSlot = (typeof MEAL_SLOTS)[number]

/** The picker's time chips: "up to 20 / 30 / 60 minutes". */
export const PICK_TIME_LIMITS = [20, 30, 60] as const
export type PickTimeLimit = (typeof PICK_TIME_LIMITS)[number]

/** Monday-first weekday of a `YYYY-MM-DD` day: 0 is Monday, 6 is Sunday. */
export function weekdayIndex(date: string): number {
  const [year, month, day] = date.split('-').map(Number)
  return (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7
}

/** The evening a busy mark looks at: an event overlapping 17:00 to 20:00. */
export const EVENING_START = 17 * 60
export const EVENING_END = 20 * 60

export interface PlannerEvent {
  date: string
  title: string
  allDay?: boolean
  startMinutes?: number
  endMinutes?: number
  assigneeIds?: readonly string[]
}

/**
 * Whether an event takes the evening. An all-day event or one without a time
 * does not: a birthday is not a reason to cook fast. One without an end counts
 * as an hour.
 */
export function isEveningEvent(event: PlannerEvent): boolean {
  if (event.allDay || event.startMinutes === undefined) return false
  const end = event.endMinutes ?? event.startMinutes + 60
  return event.startMinutes < EVENING_END && end > EVENING_START
}

/** A day's evening events, earliest first. */
export function eveningEvents<T extends PlannerEvent>(
  events: readonly T[],
  date: string,
): T[] {
  return events
    .filter((event) => event.date === date && isEveningEvent(event))
    .sort((a, b) => (a.startMinutes ?? 0) - (b.startMinutes ?? 0))
}

/**
 * Who an evening's events take away from the table: the Members assigned to
 * any of them, with the first event that does. An event nobody is assigned to
 * marks the evening busy but takes nobody.
 */
export function awayFromEvents<T extends PlannerEvent>(
  events: readonly T[],
  date: string,
): Map<string, T> {
  const away = new Map<string, T>()
  for (const event of eveningEvents(events, date))
    for (const id of event.assigneeIds ?? [])
      if (!away.has(id)) away.set(id, event)
  return away
}

/**
 * Who eats along on an evening when nobody chose: everyone whose default is to
 * eat along, minus whoever an evening event takes away. In Member order.
 */
export function defaultEaters(
  memberDefaults: readonly { userId: string; eatsByDefault: boolean }[],
  away: ReadonlySet<string> | ReadonlyMap<string, unknown>,
): string[] {
  return memberDefaults
    .filter((member) => member.eatsByDefault && !away.has(member.userId))
    .map((member) => member.userId)
}

/**
 * Who eats along with a Planned meal: its own `eaterIds` when someone chose,
 * else the evening's defaults. A chosen id that is no longer a Member drops.
 */
export function mealEaters(
  eaterIds: readonly string[] | undefined,
  memberIds: readonly string[],
  defaults: readonly string[],
): string[] {
  if (!eaterIds) return [...defaults]
  const chosen = new Set(eaterIds)
  return memberIds.filter((id) => chosen.has(id))
}

/**
 * A meal's servings: its own number, else the Group's fixed override, else
 * who eats along (at least 1).
 */
export function mealServings(
  servings: number | undefined,
  servingsOverride: number | null | undefined,
  eaters: number,
): number {
  return servings ?? servingsOverride ?? Math.max(1, eaters)
}

export interface SlotAddress {
  date: string
  slot: MealSlot
}

/**
 * What moving a meal to another day or slot does: nothing when it is already
 * there, a swap when the place holds another meal, a move into an empty one.
 */
export function planMove<T extends { id: string; date: string; slot: MealSlot }>(
  meals: readonly T[],
  mealId: string,
  to: SlotAddress,
):
  | { kind: 'stay' }
  | { kind: 'move'; meal: T }
  | { kind: 'swap'; meal: T; other: T }
  | { kind: 'missing' } {
  const meal = meals.find((row) => row.id === mealId)
  if (!meal) return { kind: 'missing' }
  if (meal.date === to.date && meal.slot === to.slot) return { kind: 'stay' }
  const other = meals.find(
    (row) =>
      row.id !== mealId && row.date === to.date && row.slot === to.slot,
  )
  return other ? { kind: 'swap', meal, other } : { kind: 'move', meal }
}
