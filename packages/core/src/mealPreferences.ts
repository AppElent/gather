/**
 * Meal preferences ("Eetvoorkeuren"): how one Group eats, stored as one
 * document per Group and read through `resolveMealPreferences`, which fills
 * every default. The stored row only holds what somebody changed, so a Group
 * that never opened the screen reads exactly the defaults, and a new
 * preference added later needs no backfill.
 *
 * Weekdays are 0..6, Monday first, everywhere in this module.
 *
 * Dependency-free (ADR-0016): the Convex validators mirror these types in
 * `convex/lib/mealPreferences.ts`, and the client and the server share the
 * defaults and the validation through this file.
 */

export const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const
/** 0 is Monday, 6 is Sunday. */
export type Weekday = (typeof WEEKDAYS)[number]

export const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner'] as const
export type MealSlot = (typeof MEAL_SLOTS)[number]

export const DIETS = [
  'vegetarian',
  'vegan',
  'pescatarian',
  'gluten-free',
  'lactose-free',
  'halal',
] as const
export type Diet = (typeof DIETS)[number]

/** The 14 allergens EU Regulation 1169/2011 (Annex II) requires on a label. */
export const ALLERGENS = [
  'gluten',
  'crustaceans',
  'eggs',
  'fish',
  'peanuts',
  'soy',
  'milk',
  'nuts',
  'celery',
  'mustard',
  'sesame',
  'sulphites',
  'lupin',
  'molluscs',
] as const
export type Allergen = (typeof ALLERGENS)[number]

export const CUISINES = [
  'italian',
  'mexican',
  'asian',
  'dutch',
  'middle-eastern',
  'indian',
] as const
export type Cuisine = (typeof CUISINES)[number]

/** What a cooking-time cell cycles through; `null` is "no maximum". */
export const COOKING_MINUTES = [15, 20, 30, 45, 60, 90] as const
export type CookingMinutes = (typeof COOKING_MINUTES)[number]

export const SMART_SWITCHES = [
  'useStock',
  'useCalendar',
  'preferHighRated',
] as const
export type SmartSwitch = (typeof SMART_SWITCHES)[number]

/** Bounds a write is held to; the screen's steppers stop at the same values. */
export const MEAL_PREFERENCE_LIMITS = {
  servings: { min: 1, max: 30 },
  noRepeatDays: { min: 0, max: 60 },
  meatFreeNights: { min: 0, max: 7 },
  /** €100,000 a week: past any household, short of an overflow. */
  weeklyBudgetCents: { min: 0, max: 10_000_000 },
  dislikes: { count: 50, length: 40 },
} as const

export interface SlotPlan {
  enabled: boolean
  days: Weekday[]
}

/**
 * The stored document, minus Convex's own columns. Every preference is
 * optional: absent means the default. `U` is the user id type (`Id<'users'>`
 * on the server, a string here).
 */
export interface StoredMealPreferences<U extends string = string> {
  /** A Member missing here eats along by default. */
  memberDefaults?: { userId: U; eatsByDefault: boolean }[]
  /** Absent: the same as the number of people eating. */
  servingsPerMeal?: number
  slots?: Record<MealSlot, SlotPlan>
  /** Seven entries, Monday first; `null` is no maximum. */
  cookingMinutes?: (CookingMinutes | null)[]
  diets?: Diet[]
  allergens?: Allergen[]
  dislikes?: string[]
  noRepeatDays?: number
  meatFreeNights?: number
  fishDays?: Weekday[]
  leftoverDays?: Weekday[]
  weeklyBudgetCents?: number
  cuisines?: Cuisine[]
  smart?: Record<SmartSwitch, boolean>
}

export interface ResolvedMealPreferences<U extends string = string> {
  /** One entry per current Member, in the order the Members were given. */
  memberDefaults: { userId: U; eatsByDefault: boolean }[]
  /** Who eats along on an ordinary day. */
  defaultEaterIds: U[]
  /** The stored override, or null when servings follow who eats. */
  servingsOverride: number | null
  /** The override, or the number of default eaters (at least 1). */
  servingsPerMeal: number
  slots: Record<MealSlot, SlotPlan>
  cookingMinutes: (CookingMinutes | null)[]
  diets: Diet[]
  allergens: Allergen[]
  dislikes: string[]
  noRepeatDays: number
  meatFreeNights: number
  fishDays: Weekday[]
  leftoverDays: Weekday[]
  weeklyBudgetCents: number | null
  cuisines: Cuisine[]
  smart: Record<SmartSwitch, boolean>
}

const ALL_DAYS: Weekday[] = [...WEEKDAYS]

/** The defaults of design section 2 (designs/meal-planner/README.md). */
export const DEFAULT_MEAL_PREFERENCES = {
  slots: {
    breakfast: { enabled: false, days: ALL_DAYS },
    lunch: { enabled: true, days: [5, 6] },
    dinner: { enabled: true, days: ALL_DAYS },
  },
  cookingMinutes: [30, 30, 30, 30, 30, 60, 60],
  noRepeatDays: 14,
  meatFreeNights: 0,
  smart: { useStock: true, useCalendar: true, preferHighRated: true },
} as const satisfies {
  slots: Record<MealSlot, SlotPlan>
  cookingMinutes: (CookingMinutes | null)[]
  noRepeatDays: number
  meatFreeNights: number
  smart: Record<SmartSwitch, boolean>
}

const copySlots = (
  slots: Record<MealSlot, SlotPlan>,
): Record<MealSlot, SlotPlan> => ({
  breakfast: { ...slots.breakfast, days: [...slots.breakfast.days] },
  lunch: { ...slots.lunch, days: [...slots.lunch.days] },
  dinner: { ...slots.dinner, days: [...slots.dinner.days] },
})

/**
 * The Group's preferences with every default filled, for these Members.
 *
 * A stored default for somebody who has left the Group is dropped, and a
 * Member with none eats along, so the result always speaks of exactly the
 * current Members.
 */
export function resolveMealPreferences<U extends string>(
  row: StoredMealPreferences<U> | null | undefined,
  members: readonly { userId: U }[],
): ResolvedMealPreferences<U> {
  const stored = new Map(
    (row?.memberDefaults ?? []).map((entry) => [
      entry.userId,
      entry.eatsByDefault,
    ]),
  )
  const memberDefaults = members.map(({ userId }) => ({
    userId,
    eatsByDefault: stored.get(userId) ?? true,
  }))
  const defaultEaterIds = memberDefaults
    .filter((entry) => entry.eatsByDefault)
    .map((entry) => entry.userId)
  const servingsOverride = row?.servingsPerMeal ?? null
  return {
    memberDefaults,
    defaultEaterIds,
    servingsOverride,
    servingsPerMeal: servingsOverride ?? Math.max(1, defaultEaterIds.length),
    slots: copySlots(row?.slots ?? DEFAULT_MEAL_PREFERENCES.slots),
    cookingMinutes:
      row?.cookingMinutes?.length === 7
        ? [...row.cookingMinutes]
        : [...DEFAULT_MEAL_PREFERENCES.cookingMinutes],
    diets: [...(row?.diets ?? [])],
    allergens: [...(row?.allergens ?? [])],
    dislikes: [...(row?.dislikes ?? [])],
    noRepeatDays: row?.noRepeatDays ?? DEFAULT_MEAL_PREFERENCES.noRepeatDays,
    meatFreeNights:
      row?.meatFreeNights ?? DEFAULT_MEAL_PREFERENCES.meatFreeNights,
    fishDays: [...(row?.fishDays ?? [])],
    leftoverDays: [...(row?.leftoverDays ?? [])],
    weeklyBudgetCents: row?.weeklyBudgetCents ?? null,
    cuisines: [...(row?.cuisines ?? [])],
    smart: { ...DEFAULT_MEAL_PREFERENCES.smart, ...row?.smart },
  }
}

/** The next value a cooking-time cell shows when tapped: 15 … 90, none, 15. */
export function nextCookingMinutes(
  current: CookingMinutes | null,
): CookingMinutes | null {
  if (current === null) return COOKING_MINUTES[0]
  const index = COOKING_MINUTES.indexOf(current)
  return index === COOKING_MINUTES.length - 1
    ? null
    : COOKING_MINUTES[index + 1]
}

/**
 * One write from the screen: any subset of the preferences. `null` clears a
 * value back to its default (the servings override, the budget).
 */
export interface MealPreferencesPatch {
  servingsPerMeal?: number | null
  slots?: Record<MealSlot, SlotPlan>
  cookingMinutes?: (CookingMinutes | null)[]
  diets?: Diet[]
  allergens?: Allergen[]
  dislikes?: string[]
  noRepeatDays?: number
  meatFreeNights?: number
  fishDays?: Weekday[]
  leftoverDays?: Weekday[]
  weeklyBudgetCents?: number | null
  cuisines?: Cuisine[]
  smart?: Record<SmartSwitch, boolean>
}

export type MealPreferencesField = keyof MealPreferencesPatch | 'memberDefault'

const isInt = (value: number, min: number, max: number) =>
  Number.isInteger(value) && value >= min && value <= max

const isDayList = (days: readonly number[]) =>
  days.length <= 7 &&
  new Set(days).size === days.length &&
  days.every((day) => isInt(day, 0, 6))

const isUniqueOf = <T>(values: readonly T[], allowed: readonly T[]) =>
  new Set(values).size === values.length &&
  values.every((value) => allowed.includes(value))

/** A dislike as stored: trimmed, single-spaced. */
export function normalizeDislike(text: string): string {
  return text.trim().replace(/\s+/g, ' ')
}

/**
 * The patch as it is stored (days sorted, dislikes trimmed and deduplicated
 * ignoring case), or the first field that is out of bounds. The server
 * refuses on a field; the screen never sends one.
 */
export function normalizeMealPreferencesPatch(
  patch: MealPreferencesPatch,
):
  | { ok: true; patch: MealPreferencesPatch }
  | { ok: false; field: MealPreferencesField } {
  const out: MealPreferencesPatch = { ...patch }
  const L = MEAL_PREFERENCE_LIMITS
  const sortDays = (days: readonly Weekday[]) =>
    [...days].sort((a, b) => a - b) as Weekday[]

  if (
    patch.servingsPerMeal != null &&
    !isInt(patch.servingsPerMeal, L.servings.min, L.servings.max)
  )
    return { ok: false, field: 'servingsPerMeal' }
  if (patch.slots) {
    for (const slot of MEAL_SLOTS) {
      if (!isDayList(patch.slots[slot].days))
        return { ok: false, field: 'slots' }
    }
    out.slots = {
      breakfast: {
        enabled: patch.slots.breakfast.enabled,
        days: sortDays(patch.slots.breakfast.days),
      },
      lunch: {
        enabled: patch.slots.lunch.enabled,
        days: sortDays(patch.slots.lunch.days),
      },
      dinner: {
        enabled: patch.slots.dinner.enabled,
        days: sortDays(patch.slots.dinner.days),
      },
    }
  }
  if (
    patch.cookingMinutes &&
    (patch.cookingMinutes.length !== 7 ||
      !patch.cookingMinutes.every(
        (value) => value === null || COOKING_MINUTES.includes(value),
      ))
  )
    return { ok: false, field: 'cookingMinutes' }
  if (patch.diets && !isUniqueOf(patch.diets, DIETS))
    return { ok: false, field: 'diets' }
  if (patch.allergens && !isUniqueOf(patch.allergens, ALLERGENS))
    return { ok: false, field: 'allergens' }
  if (patch.cuisines && !isUniqueOf(patch.cuisines, CUISINES))
    return { ok: false, field: 'cuisines' }
  if (patch.dislikes) {
    const seen = new Set<string>()
    const dislikes: string[] = []
    for (const raw of patch.dislikes) {
      const text = normalizeDislike(raw)
      if (!text || text.length > L.dislikes.length)
        return { ok: false, field: 'dislikes' }
      const key = text.toLocaleLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      dislikes.push(text)
    }
    if (dislikes.length > L.dislikes.count)
      return { ok: false, field: 'dislikes' }
    out.dislikes = dislikes
  }
  if (
    patch.noRepeatDays !== undefined &&
    !isInt(patch.noRepeatDays, L.noRepeatDays.min, L.noRepeatDays.max)
  )
    return { ok: false, field: 'noRepeatDays' }
  if (
    patch.meatFreeNights !== undefined &&
    !isInt(patch.meatFreeNights, L.meatFreeNights.min, L.meatFreeNights.max)
  )
    return { ok: false, field: 'meatFreeNights' }
  if (patch.fishDays) {
    if (!isDayList(patch.fishDays)) return { ok: false, field: 'fishDays' }
    out.fishDays = sortDays(patch.fishDays)
  }
  if (patch.leftoverDays) {
    if (!isDayList(patch.leftoverDays))
      return { ok: false, field: 'leftoverDays' }
    out.leftoverDays = sortDays(patch.leftoverDays)
  }
  if (
    patch.weeklyBudgetCents != null &&
    !isInt(
      patch.weeklyBudgetCents,
      L.weeklyBudgetCents.min,
      L.weeklyBudgetCents.max,
    )
  )
    return { ok: false, field: 'weeklyBudgetCents' }
  return { ok: true, patch: out }
}

/**
 * A typed weekly budget as cents, or why not. Accepts `12`, `12,50`, `12.5`,
 * `€ 1.250,00`; empty is "no budget" (null). Thousands separators are
 * accepted only in their usual groups of three.
 *
 * With the locale's `decimal` separator, only the other one groups
 * thousands, so English `1.250` is refused rather than read as €1,250. The
 * other separator still reads as a decimal when nothing is grouped (`85.50`
 * typed in Dutch), since that is never a thousands group.
 */
export function parseBudgetCents(
  text: string,
  decimal?: ',' | '.',
): { ok: true; cents: number | null } | { ok: false } {
  const cleaned = text.replace(/[€\s]/g, '')
  if (cleaned === '') return { ok: true, cents: null }
  // "1.250,00" / "1,250.00": the last separator followed by 1-2 digits is the
  // decimal one; any others must group thousands.
  const group = decimal === ',' ? '\\.' : decimal === '.' ? ',' : '[.,]'
  const point = decimal === ',' ? ',' : decimal === '.' ? '\\.' : '[.,]'
  const match =
    new RegExp(`^(\\d{1,3}(?:${group}\\d{3})*|\\d+)(?:${point}(\\d{1,2}))?$`).exec(
      cleaned,
    ) ?? /^(\d+)[.,](\d{1,2})$/.exec(cleaned)
  if (!match) return { ok: false }
  const whole = Number(match[1].replace(/[.,]/g, ''))
  const fraction = match[2] ? Number(match[2].padEnd(2, '0')) : 0
  const cents = whole * 100 + fraction
  return cents <= MEAL_PREFERENCE_LIMITS.weeklyBudgetCents.max
    ? { ok: true, cents }
    : { ok: false }
}

/**
 * A typed budget written back for editing: whole euros as `85`, otherwise two
 * decimals with the locale's separator (`85,50`). `null` is an empty field.
 */
export function budgetText(cents: number | null, decimal: ',' | '.'): string {
  if (cents === null) return ''
  if (cents % 100 === 0) return String(cents / 100)
  const fraction = String(cents % 100).padStart(2, '0')
  return `${Math.floor(cents / 100)}${decimal}${fraction}`
}

/** The resolved preferences back as the stored shape they came from. */
function toStored<U extends string>(
  current: ResolvedMealPreferences<U>,
): StoredMealPreferences<U> {
  return {
    memberDefaults: current.memberDefaults,
    servingsPerMeal: current.servingsOverride ?? undefined,
    slots: current.slots,
    cookingMinutes: current.cookingMinutes,
    diets: current.diets,
    allergens: current.allergens,
    dislikes: current.dislikes,
    noRepeatDays: current.noRepeatDays,
    meatFreeNights: current.meatFreeNights,
    fishDays: current.fishDays,
    leftoverDays: current.leftoverDays,
    weeklyBudgetCents: current.weeklyBudgetCents ?? undefined,
    cuisines: current.cuisines,
    smart: current.smart,
  }
}

const membersOf = <U extends string>(current: ResolvedMealPreferences<U>) =>
  current.memberDefaults.map(({ userId }) => ({ userId }))

/**
 * What `mealPreferences.update` will answer once `patch` is through, for an
 * optimistic update. A patch the server would refuse changes nothing, so the
 * screen never shows a value that is about to bounce.
 */
export function applyMealPreferencesPatch<U extends string>(
  current: ResolvedMealPreferences<U>,
  patch: MealPreferencesPatch,
): ResolvedMealPreferences<U> {
  const normalized = normalizeMealPreferencesPatch(patch)
  if (!normalized.ok) return current
  const { servingsPerMeal, weeklyBudgetCents, ...rest } = normalized.patch
  const stored: StoredMealPreferences<U> = { ...toStored(current), ...rest }
  if (servingsPerMeal !== undefined)
    stored.servingsPerMeal = servingsPerMeal ?? undefined
  if (weeklyBudgetCents !== undefined)
    stored.weeklyBudgetCents = weeklyBudgetCents ?? undefined
  return resolveMealPreferences(stored, membersOf(current))
}

/** What `mealPreferences.setMemberDefault` will answer, optimistically. */
export function applyMemberDefault<U extends string>(
  current: ResolvedMealPreferences<U>,
  userId: U,
  eatsByDefault: boolean,
): ResolvedMealPreferences<U> {
  const stored = toStored(current)
  stored.memberDefaults = current.memberDefaults.map((entry) =>
    entry.userId === userId ? { userId, eatsByDefault } : entry,
  )
  return resolveMealPreferences(stored, membersOf(current))
}

/** Adds `day` to `days`, or takes it out; always Monday first. */
export function toggleDay(days: readonly Weekday[], day: Weekday): Weekday[] {
  return days.includes(day)
    ? days.filter((d) => d !== day)
    : [...days, day].sort((a, b) => a - b)
}

/** Adds `value` to a set kept as a list, or takes it out, keeping order. */
export function toggleIn<T>(values: readonly T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((v) => v !== value)
    : [...values, value]
}

export type { MatchableRecipe, RecipeClash } from './mealPreferenceMatching'
export {
  clashReasons,
  describeClash,
  fitsPreferences,
  recipeClashes,
} from './mealPreferenceMatching'
