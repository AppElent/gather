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
 * **What is stored is the refusals, not the acceptances.** A list of
 * acceptances cannot tell "they turned this off" apart from "this did not
 * exist when they were asked", so a type added to the catalogue later would be
 * missing for every Child. A type nobody has refused is offered, so a new one
 * arrives switched on for everybody and stays on until someone says otherwise.
 * The cost is that the field does not read as the answer to the question the
 * settings screen asks — which is what `declinedEventTypes` is for, and why
 * nothing outside this module builds the array by hand.
 *
 * Absent means nothing has been refused. An array holding every type is a real
 * choice and offers nothing.
 *
 * **Order is not stored here**: that is `barOrder`'s job (see `babyBarSlots`),
 * so this answers only the question of membership, in catalogue order.
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
 *   absent `barOrder` mean "everything, in tracked order, shortcuts last", so
 *   no backfill.
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
/** All values per serving (recipes) or per 100 g/ml (foods). Calories in kcal, everything else grams. */
export type NutritionFacts = Partial<Record<NutrientKey, number>>
export const NUTRITION_SOURCES = ['imported', 'ai', 'manual'] as const
export type NutritionSource = (typeof NUTRITION_SOURCES)[number]

/**
 * The barcode a search term is, or `null` when it is ordinary text.
 *
 * One definition of "plausible barcode" for the lookup and for the search box
 * that decides to make one (#80).
 *
 * Eight digits is EAN-8, the shortest symbology gather reads, and it is also
 * what keeps a number still being typed out of barcode mode: fewer digits is
 * somebody part-way through, and falls through to the text search it was
 * already getting. The caller debounces, so the intermediate lengths of a
 * barcode being typed never reach here at all.
 */
export function barcodeTerm(term: string): string | null {
  const trimmed = term.trim()
  return /^\d{8,14}$/.test(trimmed) ? trimmed : null
}

export const EXTERNAL_PROVIDER_IDS = ['notion', 'todoist'] as const
export type ExternalProviderId = (typeof EXTERNAL_PROVIDER_IDS)[number]
/** Where a task list keeps its tasks. */
export const TASK_PROVIDER_IDS = ['local', ...EXTERNAL_PROVIDER_IDS] as const
export type TaskProviderId = (typeof TASK_PROVIDER_IDS)[number]

export const MEAL_NAMES = ['breakfast', 'lunch', 'dinner', 'snack'] as const
export type MealName = (typeof MEAL_NAMES)[number]

export const QUANTITY_UNITS = ['serving', 'g', 'ml', 'piece'] as const
export type QuantityUnit = (typeof QUANTITY_UNITS)[number]
