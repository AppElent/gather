/**
 * The week menu's groceries (APP-321, `designs/meal-planner/README.md`
 * section 5), without React: which days count, and the lines of every meal in
 * them, each scaled to that meal's servings and combined across recipes into
 * one line per item. Meals without ingredients to read come back as meals to
 * check. The sheet itself is APP-312's (`add-to-groceries/`), which merges
 * the lines into the list as top-ups: a second run adds only what is missing.
 */
import { addDays } from '@gather/core/civil-date'
import {
  combineGroceryLines,
  type GroceryAddLine,
  type GroceryUnit,
  groceryKey,
  scaleGroceryQuantity,
} from '@gather/core/groceries'

import type { LineRead, SourceLine } from '../add-to-groceries/pick'
import type { PlannedMeal } from './week'

/** The seven days of the week that starts on `from`, Monday first. */
export function weekDays(from: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(from, index))
}

/**
 * The days that count when the sheet opens: from today to the end of the
 * week, from Monday for a week still to come, and the whole week for one
 * that is over. Only days with a meal can count.
 */
export function defaultDays(
  from: string,
  today: string,
  meals: readonly Pick<PlannedMeal, 'date'>[],
): Set<string> {
  const days = weekDays(from)
  const last = days[days.length - 1]
  const start = today > last ? from : today > from ? today : from
  const planned = new Set(meals.map((meal) => meal.date))
  return new Set(days.filter((day) => day >= start && planned.has(day)))
}

/** A Recipe planned this week, as `mealPlan.weekIngredients` returns it. */
export interface WeekRecipe {
  _id: string
  title: string
  servings?: number
}

/** A meal that counts, with the servings it is planned for. */
export interface CountedMeal {
  meal: PlannedMeal
  servings: number
}

export interface WeekLinesInput {
  meals: readonly CountedMeal[]
  /** The Recipes planned, by id; a meal whose Recipe is missing is a meal to check. */
  recipes: ReadonlyMap<string, WeekRecipe>
  /** Each Recipe's ingredients as read (`useIngredientLines`), by Recipe id. */
  lines: ReadonlyMap<string, readonly SourceLine[]>
  /**
   * Where a line comes from, for the list and the row: one meal ("Shakshuka ·
   * di"), two ("Shakshuka di, Tacos do"), or more ("3 recepten").
   */
  label: (meals: readonly PlannedMeal[]) => string
  /**
   * Keys of the rows the person ticked, unticked or retyped (the sheet's
   * `ticks` and `edits`). A line they touched while it was still being read
   * stays a row of its own once read instead of joining the item's row, so
   * what they did applies to that meal's amount only (APP-479).
   */
  touched?: ReadonlySet<string>
  /**
   * The item rows each line has been in, by the line's key while it is read
   * (`rowsOfLines`). A row takes on what the person did to a row its lines
   * were in before, so an untick holds when a day leaves and the row's
   * measure changes (a line without an amount stays behind, APP-590).
   */
  formerRows?: ReadonlyMap<string, ReadonlySet<string>>
}

export interface WeekLines {
  /** One line per item, scaled and combined, for the sheet. */
  lines: SourceLine[]
  /** Meals with nothing to read: quick meals, Recipes without ingredients. */
  toCheck: PlannedMeal[]
}

/**
 * The sheet's lines for the meals that count. A line the phone has read is
 * scaled from its Recipe's servings to the meal's, then combined with the
 * same item from other meals (`combineGroceryLines`, APP-312's merge rule).
 * A line still being read, or only readable as text, stays a line of its own
 * for its meal; once read it joins an item's line, which remembers the key it
 * had (`was`), so a tick or a retype made meanwhile is not lost (APP-423). A
 * line the person touched while it was being read does not join: it stays
 * its own row, so their tick or retype cannot take the other meals' amounts
 * with it (APP-479). Every line tops the list up rather than adding to it.
 */
export function weekGroceryLines(input: WeekLinesInput): WeekLines {
  const toCheck: PlannedMeal[] = []
  const read: Array<{
    line: GroceryAddLine
    meal: PlannedMeal
    via: Via
    /** The key this line has while it is still being read. */
    unreadKey: string
  }> = []
  const unread: SourceLine[] = []

  for (const { meal, servings } of input.meals) {
    const recipe = meal.recipeId ? input.recipes.get(meal.recipeId) : undefined
    const lines = recipe ? (input.lines.get(recipe._id) ?? []) : []
    if (!recipe || lines.length === 0) {
      toCheck.push(meal)
      continue
    }
    for (const line of lines) {
      if (line.read.kind !== 'read') {
        unread.push({
          key: `${meal._id}:${line.key}`,
          text: line.text,
          read: line.read,
          detail: input.label([meal]),
          topUp: true,
        })
        continue
      }
      const factor =
        recipe.servings && servings > 0 ? servings / recipe.servings : 1
      read.push({
        meal,
        via: line.read.via,
        unreadKey: `${meal._id}:${line.key}`,
        line: {
          title: line.read.name,
          ...(line.read.quantity !== undefined
            ? {
                quantity: scaleGroceryQuantity(
                  line.read.quantity,
                  line.read.unit,
                  factor,
                ),
              }
            : {}),
          ...(line.read.unit !== undefined ? { unit: line.read.unit } : {}),
        },
      })
    }
  }

  // What the person touched while it was being read keeps to itself.
  const alone = read.filter((entry) => input.touched?.has(entry.unreadKey))
  const joining = read.filter((entry) => !input.touched?.has(entry.unreadKey))
  const own = alone.map((entry): SourceLine => {
    const name = entry.line.title
    return {
      key: `item:${groceryKey(name) || name}:${entry.unreadKey}`,
      was: [entry.unreadKey],
      text: name,
      read: {
        kind: 'read',
        via: entry.via,
        name,
        ...(entry.line.quantity !== undefined
          ? { quantity: entry.line.quantity }
          : {}),
        ...(entry.line.unit !== undefined ? { unit: entry.line.unit } : {}),
      },
      detail: input.label([entry.meal]),
      topUp: true,
    }
  })

  const used = new Set<string>()
  const combined = combineGroceryLines(joining.map((entry) => entry.line)).map(
    (line): SourceLine => {
      const from = line.from.map((index) => joining[index])
      const meals = [...new Map(from.map(({ meal }) => [meal._id, meal])).values()]
      // Stable while the days change, a line is read, or a touched line
      // stays apart, so a row keeps its tick: the item's name and the measure
      // its amount is in. Lines of one name and measure always combine, so
      // no other line of that name can shift it (APP-590).
      const name = groceryKey(line.title) || line.title
      const base = `item:${name}:${measureOf(line.unit)}`
      let key = base
      for (let n = 1; used.has(key); n++) key = `${base}:${n}`
      used.add(key)
      const readAs: LineRead = {
        kind: 'read',
        via: viaOf(from.map((entry) => entry.via)),
        name: line.title,
        ...(line.quantity !== undefined ? { quantity: line.quantity } : {}),
        ...(line.unit !== undefined ? { unit: line.unit } : {}),
      }
      return {
        key,
        // What the person did to it while the AI was still reading it.
        was: from.map((entry) => entry.unreadKey),
        // Else to a row its lines were in before (a day unticked, APP-590).
        former: [
          ...new Set(
            from.flatMap((entry) => [
              ...(input.formerRows?.get(entry.unreadKey) ?? []),
            ]),
          ),
        ].filter((former) => former !== key),
        text: line.title,
        read: readAs,
        detail: input.label(meals),
        topUp: true,
      }
    },
  )
  // A row still shown keeps its own state: another row never takes it on,
  // even when a line was in both at some point (APP-590).
  const all = [...combined, ...own, ...unread]
  const shown = new Set(all.map((line) => line.key))
  return {
    lines: all.map((line) =>
      line.former?.some((former) => shown.has(former))
        ? { ...line, former: line.former.filter((former) => !shown.has(former)) }
        : line,
    ),
    toCheck,
  }
}

/**
 * Adds to `rows` the item row each line is in now, by the line's key while
 * it is read, for `formerRows` on the next call.
 */
export function rowsOfLines(
  lines: readonly SourceLine[],
  rows: Map<string, Set<string>>,
): void {
  for (const line of lines) {
    if (!line.key.startsWith('item:')) continue
    for (const source of line.was ?? []) {
      const seen = rows.get(source) ?? new Set<string>()
      seen.add(line.key)
      rows.set(source, seen)
    }
  }
}

/**
 * The measure an amount is in, for a row key: lines of one name in the same
 * measure add up (`addGroceryAmounts`), so it tells an item's rows apart.
 */
function measureOf(unit: GroceryUnit | undefined): string {
  if (unit === undefined || unit === 'stuks') return 'count'
  if (unit === 'g' || unit === 'kg') return 'mass'
  if (unit === 'ml' || unit === 'cl' || unit === 'dl' || unit === 'l') return 'volume'
  return unit
}

type Via = Extract<LineRead, { kind: 'read' }>['via']

/** A line the AI read just now says so; one read earlier says that. */
function viaOf(vias: readonly Via[]): Via {
  if (vias.includes('ai')) return 'ai'
  if (vias.includes('ai-earlier')) return 'ai-earlier'
  return 'local'
}
