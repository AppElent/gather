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
 * for its meal. Every line tops the list up rather than adding to it.
 */
export function weekGroceryLines(input: WeekLinesInput): WeekLines {
  const toCheck: PlannedMeal[] = []
  const read: Array<{ line: GroceryAddLine; meal: PlannedMeal; via: Via }> = []
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

  const seen = new Map<string, number>()
  const combined = combineGroceryLines(read.map((entry) => entry.line)).map(
    (line): SourceLine => {
      const from = line.from.map((index) => read[index])
      const meals = [...new Map(from.map(({ meal }) => [meal._id, meal])).values()]
      // Stable while the days change, so a row keeps its tick: the item's
      // name, and which of the lines with that name it is.
      const key = groceryKey(line.title) || line.title
      const nth = seen.get(key) ?? 0
      seen.set(key, nth + 1)
      const readAs: LineRead = {
        kind: 'read',
        via: viaOf(from.map((entry) => entry.via)),
        name: line.title,
        ...(line.quantity !== undefined ? { quantity: line.quantity } : {}),
        ...(line.unit !== undefined ? { unit: line.unit } : {}),
      }
      return {
        key: `item:${key}:${nth}`,
        text: line.title,
        read: readAs,
        detail: input.label(meals),
        topUp: true,
      }
    },
  )
  return { lines: [...combined, ...unread], toCheck }
}

type Via = Extract<LineRead, { kind: 'read' }>['via']

/** A line the AI read just now says so; one read earlier says that. */
function viaOf(vias: readonly Via[]): Via {
  if (vias.includes('ai')) return 'ai'
  if (vias.includes('ai-earlier')) return 'ai-earlier'
  return 'local'
}
