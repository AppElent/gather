export const BABY_EVENT_TYPES = [
  'temperature',
  'feeding',
  'diaper',
  'sleep',
  'growth',
  'medication',
  'vaccination',
  'note',
  // A first laugh, a first step. Not a measurement and not a reading — the
  // one thing in this log that is kept because somebody wants to remember it
  // rather than because a doctor might ask.
  'memory',
] as const
export type BabyEventType = (typeof BABY_EVENT_TYPES)[number]

/**
 * The event types one Child's log offers (ADR-0022).
 *
 * **What is stored is the refusals, not the acceptances**, and that is the
 * whole point. The field used to hold the types a household had said yes to,
 * which read naturally and was wrong in one specific way: a type added to the
 * catalogue *after* somebody made their choice is missing from their list, and
 * a list of acceptances cannot tell "they turned this off" apart from "this
 * did not exist when they were asked". Every Child on the deployment stopped
 * being offered Memory the day it shipped, and the only cure was for each
 * household to go and find it in settings.
 *
 * Storing the noes inverts that. A type nobody has refused is offered, so a
 * new one arrives switched on for everybody and stays on until someone says
 * otherwise. The cost is that the field no longer reads as the answer to the
 * question the settings screen asks — which is what `declinedEventTypes` is
 * for, and why nothing outside this module builds the array by hand.
 *
 * Absent means nothing has been refused. An array holding every type is a real
 * choice and offers nothing.
 *
 * **Order is not stored here.** It once was, and the settings screen wrote the
 * bar's arrangement into this array as a side effect of writing the set. That
 * is `barOrder`'s job now (see `babyBarSlots`), so this answers only the
 * question of membership and always answers it in catalogue order.
 *
 * This decides what is *offered*, never what is shown: an entry of a type that
 * is no longer tracked stays in the timeline and stays editable.
 */
export function trackedEventTypes(
  untracked: readonly BabyEventType[] | undefined,
): readonly BabyEventType[] {
  if (!untracked || untracked.length === 0) return BABY_EVENT_TYPES
  return BABY_EVENT_TYPES.filter((type) => !untracked.includes(type))
}

/**
 * The other direction: what to store, given what a household just said yes to.
 *
 * The settings screen and the create form both work in acceptances, because
 * that is the question a person is answering — a row with a switch on it. This
 * is the one place that turns the answer into what the record holds, so no
 * screen has to remember which way round the field is.
 *
 * Unknown entries fall out and duplicates collapse on the way through, since
 * the result is derived from the catalogue rather than from the input.
 */
export function declinedEventTypes(
  tracked: readonly BabyEventType[],
): BabyEventType[] {
  return BABY_EVENT_TYPES.filter((type) => !tracked.includes(type))
}

/**
 * The two things on a Child's log bar that are not log entries.
 *
 * A to-do and a question are what a parent thinks of *while* logging — "ask
 * about the rash", "buy more nappies" — and the bar is where they are within
 * reach. They are ordinary task-list items, not events, which is why they can
 * never be `BabyEventType`s and why `untrackedTypes` cannot hold them.
 */
export const BABY_BAR_SHORTCUTS = ['todo', 'question'] as const
export type BabyBarShortcut = (typeof BABY_BAR_SHORTCUTS)[number]

/** One button on the log bar: an event type, or one of the two shortcuts. */
export type BabyBarSlot = BabyEventType | BabyBarShortcut

export function isBabyBarShortcut(slot: BabyBarSlot): slot is BabyBarShortcut {
  return (BABY_BAR_SHORTCUTS as readonly string[]).includes(slot)
}

/**
 * The log bar, in the order it is drawn.
 *
 * Two stored fields, and deliberately not one: `untrackedTypes` decides **which
 * event types the log offers** (ADR-0022) and `barOrder` decides **where each
 * button sits and whether the two shortcuts are on the bar at all**. Neither
 * can contradict the other, because each is the only authority for its own
 * question — this function reconciles rather than merges:
 *
 * - A stored slot that is an event type survives only if it is still tracked.
 *   Untracking a type removes its button without anybody having to rewrite the
 *   arrangement.
 * - A tracked type the arrangement has never heard of is appended. That is
 *   what makes a type you just turned on appear, and it is what makes an
 *   absent `barOrder` mean "everything, in tracked order, shortcuts last" —
 *   which is what the bar did before the field existed, so no backfill.
 * - A shortcut survives on its own say-so. Absent means somebody turned it
 *   off, which is a thing the settings screen can do and nothing else can.
 */
export function babyBarSlots(
  tracked: readonly BabyEventType[],
  stored: readonly BabyBarSlot[] | undefined,
): readonly BabyBarSlot[] {
  if (!stored) return [...tracked, ...BABY_BAR_SHORTCUTS]

  const seen = new Set<BabyBarSlot>()
  const slots = stored.filter((slot) => {
    if (seen.has(slot)) return false
    if (!isBabyBarShortcut(slot) && !tracked.includes(slot)) return false
    seen.add(slot)
    return true
  })

  return [...slots, ...tracked.filter((type) => !seen.has(type))]
}

/**
 * The offered event types, in the household's own order.
 *
 * The bar is the phone's shape, but the *arrangement* is the household's
 * answer and not the phone's — the web's quick-log buttons are the same set of
 * choices and should come out in the same order the family put them in. This
 * is `babyBarSlots` with the two shortcuts dropped, because a to-do is a task
 * and the web has somewhere else to put those.
 */
export function offeredEventTypes(
  untracked: readonly BabyEventType[] | undefined,
  barOrder: readonly BabyBarSlot[] | undefined,
): readonly BabyEventType[] {
  return babyBarSlots(trackedEventTypes(untracked), barOrder).filter(
    (slot): slot is BabyEventType => !isBabyBarShortcut(slot),
  )
}

/**
 * The same list with one entry moved one place, for the settings screen's
 * arrows. Out-of-bounds moves return the list unchanged rather than wrapping:
 * pressing "up" on the top row should do nothing, not send it to the bottom.
 */
export function moveBarSlot(
  slots: readonly BabyBarSlot[],
  slot: BabyBarSlot,
  direction: -1 | 1,
): BabyBarSlot[] {
  const from = slots.indexOf(slot)
  const to = from + direction
  if (from < 0 || to < 0 || to >= slots.length) return [...slots]
  const next = [...slots]
  next[from] = next[to]
  next[to] = slot
  return next
}

export const NUTRIENT_KEYS = [
  'calories',
  'protein',
  'carbs',
  'sugars',
  'fat',
  'saturatedFat',
  'fiber',
  'salt',
] as const
export type NutrientKey = (typeof NUTRIENT_KEYS)[number]
export type NutritionSource = 'imported' | 'ai' | 'manual'

export const MEAL_NAMES = ['breakfast', 'lunch', 'dinner', 'snack'] as const
export type MealName = (typeof MEAL_NAMES)[number]

export const QUANTITY_UNITS = ['serving', 'g', 'ml', 'piece'] as const
export type QuantityUnit = (typeof QUANTITY_UNITS)[number]
